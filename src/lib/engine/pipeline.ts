/**
 * Main submission processing pipeline.
 * Orchestrates document parsing → enrichment → scoring → output.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Submission,
  Location,
  Building,
  BuildingValues,
  HazardData,
  RawBuildingData,
  DocumentParseResult,
  OccupancyType,
} from '../types/submission';
import { rateBuilding, calculateITVPerSqft, getITVFlag, getOperatorTierFromName } from './property_rater';
import { scoreLocationsGL } from './gl_scorer';
import { checkEligibility, generateDataGapFlags } from './eligibility';
import { deriveRecommendation, computePremiumSummary } from './recommendation';
import { callLLMJSON } from '../llm/client';
import { EXECUTIVE_SUMMARY_SYSTEM, OPERATOR_IDENTIFIER_SYSTEM } from '../llm/prompts';

export interface PipelineInput {
  parseResult: DocumentParseResult;
  occupancyType?: OccupancyType;
  manualOverrides?: {
    dscr?: number;
    workOrderScore?: number;
    operatorName?: string;
    hazardData?: Record<number, HazardData>; // keyed by location number
    scheduleFactor?: number;
  };
}

export interface PipelineOutput {
  submission: Submission;
  strengths: string[];
  concerns: string[];
}

function inferOccupancyType(buildings: RawBuildingData[]): OccupancyType {
  for (const b of buildings) {
    const occ = (b.occupancy ?? '').toLowerCase();
    if (occ.includes('student') || occ.includes('beds') || b.num_beds != null) {
      return 'student_housing';
    }
  }
  return 'conventional_mf';
}

function normalizeAddress(raw: RawBuildingData) {
  return {
    street: raw.address ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    zip: raw.zip ?? '',
    county: raw.county,
  };
}

function groupBuildingsIntoLocations(rawBuildings: RawBuildingData[]): Map<number, RawBuildingData[]> {
  const groups = new Map<number, RawBuildingData[]>();
  let nextLoc = 1;

  for (const b of rawBuildings) {
    const locNum = b.location_number ?? nextLoc++;
    if (!groups.has(locNum)) {
      groups.set(locNum, []);
      nextLoc = Math.max(nextLoc, locNum + 1);
    }
    groups.get(locNum)!.push(b);
  }

  return groups;
}

async function identifyOperator(operatorName: string | undefined): Promise<{name: string; tier: string}> {
  if (!operatorName) return { name: 'Unknown', tier: 'small_unknown' };

  const quickTier = getOperatorTierFromName(operatorName);
  if (quickTier !== 'small_unknown') return { name: operatorName, tier: quickTier };

  // LLM fallback for unknown operators
  try {
    const result = await callLLMJSON<{ operator_name: string; tier: string }>(
      OPERATOR_IDENTIFIER_SYSTEM,
      `Identify this property management company: "${operatorName}"`
    );
    return { name: result.operator_name ?? operatorName, tier: result.tier ?? 'small_unknown' };
  } catch {
    return { name: operatorName, tier: 'small_unknown' };
  }
}

async function generateNarrative(
  submission: Submission
): Promise<{ strengths: string[]; concerns: string[] }> {
  const summary = {
    occupancy: submission.occupancy_type,
    total_tiv: submission.premium_summary.total_tiv,
    total_premium: submission.premium_summary.total_premium,
    recommendation: submission.recommendation,
    flags: submission.flags.map((f) => f.description),
    operator: submission.operator_name,
    dscr: submission.dscr,
    locations: submission.locations.length,
    buildings: submission.locations.flatMap((l) => l.buildings).length,
  };

  try {
    const result = await callLLMJSON<{ strengths: string[]; concerns: string[] }>(
      EXECUTIVE_SUMMARY_SYSTEM,
      `Generate executive summary bullets for this submission:\n${JSON.stringify(summary, null, 2)}`
    );
    return result;
  } catch {
    return { strengths: ['Submission received for review'], concerns: [] };
  }
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { parseResult, manualOverrides } = input;
  const { acord_125, sov_buildings = [], claims = [], gl_supplemental, loss_run_date } = parseResult;

  // Determine occupancy type
  const occupancyType: OccupancyType =
    input.occupancyType ?? inferOccupancyType(sov_buildings);

  // Identify operator
  const operatorOverride = manualOverrides?.operatorName ?? acord_125?.named_insured;
  const { name: operatorName, tier: operatorTier } = await identifyOperator(operatorOverride);

  const dscr = manualOverrides?.dscr;
  const workOrderScore = manualOverrides?.workOrderScore;
  const scheduleFactor = manualOverrides?.scheduleFactor ?? 1.00;

  // Group buildings into locations
  const locGroups = groupBuildingsIntoLocations(sov_buildings);
  const totalBuildingCount = sov_buildings.length;

  // Build locations
  const locations: Location[] = [];
  for (const [locNum, rawBldgs] of Array.from(locGroups.entries())) {
    const buildings: Building[] = rawBldgs.map((raw: RawBuildingData, idx: number): Building => {
      const bNum = raw.building_number ?? idx + 1;
      const values: BuildingValues = {
        building: raw.building_value ?? 0,
        bpp: raw.bpp_value ?? 0,
        bi: raw.bi_value ?? 0,
        total_tiv: raw.total_insured_value ??
          (raw.building_value ?? 0) + (raw.bpp_value ?? 0) + (raw.bi_value ?? 0),
      };
      const constructionType = (raw.construction_type as Building['construction_type']) ?? 'FRAME';
      const hazardDataOverride = manualOverrides?.hazardData?.[locNum] ?? {};
      const protectionClass = hazardDataOverride.protection_class ?? raw.protection_class ?? 5;

      const itvPerSqft = calculateITVPerSqft(values.total_tiv, raw.square_footage ?? 1);
      const itvFlag = getITVFlag(itvPerSqft);

      const rating = rateBuilding({
        occupancyType,
        building: {
          building_number: bNum,
          address: normalizeAddress(raw),
          year_built: raw.year_built ?? 2000,
          year_renovated: raw.year_renovated,
          stories: raw.stories ?? 1,
          num_units: raw.num_units ?? 0,
          num_beds: raw.num_beds,
          square_footage: raw.square_footage ?? 0,
          construction_type: constructionType,
          sprinkler_status: raw.sprinkler_status ?? false,
          protection_class: protectionClass,
          roof_type: raw.roof_type,
          roof_year: raw.roof_year,
          electrical_year: raw.electrical_year,
          plumbing_year: raw.plumbing_year,
          hvac_year: raw.hvac_year,
          values,
          rating: {} as Building['rating'], // placeholder
          hazard_data: hazardDataOverride,
          reviews: {},
          itv_per_sqft: itvPerSqft,
          itv_flag: itvFlag,
        },
        totalBuildingCount,
        operatorTier,
        dscr,
        workOrderScore,
        scheduleFactor,
      });

      return {
        building_number: bNum,
        address: normalizeAddress(raw),
        year_built: raw.year_built ?? 2000,
        year_renovated: raw.year_renovated,
        stories: raw.stories ?? 1,
        num_units: raw.num_units ?? 0,
        num_beds: raw.num_beds,
        square_footage: raw.square_footage ?? 0,
        construction_type: constructionType,
        sprinkler_status: raw.sprinkler_status ?? false,
        protection_class: protectionClass,
        roof_type: raw.roof_type,
        roof_year: raw.roof_year,
        electrical_year: raw.electrical_year,
        plumbing_year: raw.plumbing_year,
        hvac_year: raw.hvac_year,
        values,
        rating,
        hazard_data: hazardDataOverride,
        reviews: {},
        itv_per_sqft: itvPerSqft,
        itv_flag: itvFlag,
      };
    });

    const locationTIV = buildings.reduce((s, b) => s + b.values.total_tiv, 0);
    const locationPropertyPremium = buildings.reduce((s, b) => s + b.rating.premium, 0);
    const numUnitsTotal = buildings.reduce((s, b) => s + b.num_units, 0);

    // University info from GL supplemental
    const universityInfo = gl_supplemental?.university_name
      ? { name: gl_supplemental.university_name }
      : undefined;

    locations.push({
      location_number: locNum,
      buildings,
      university: universityInfo,
      location_tiv: locationTIV,
      location_property_premium: locationPropertyPremium,
      location_gl_premium: 0, // will be filled by GL scorer
      num_units_total: numUnitsTotal,
    });
  }

  // Run GL Scorer
  const scoredLocations = scoreLocationsGL(locations, occupancyType);

  // Build loss history
  const lossHistory = {
    claims,
    total_claims_5yr: claims.length,
    paid_claims_over_50k: claims.filter((c) => c.total_paid > 50_000 && c.claim_status.toLowerCase() === 'closed').length,
    incurred_loss_ratio_5yr: 0,
    largest_single_loss: claims.reduce((m, c) => Math.max(m, c.total_incurred ?? 0), 0),
    single_cat_loss_over_100k: false,
    claim_frequency: 0,
    loss_run_date: loss_run_date ?? undefined,
    is_stale: loss_run_date ? (new Date().getTime() - new Date(loss_run_date).getTime()) / (1000 * 60 * 60 * 24) > 90 : false,
  };

  // Parse policy period
  const effectiveDate = acord_125?.effective_date;
  const expirationDate = acord_125?.expiration_date;
  let termMonths: number | undefined;
  if (effectiveDate && expirationDate) {
    const diff = (new Date(expirationDate).getTime() - new Date(effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    termMonths = Math.round(diff);
  }

  // Build full submission object
  const submission: Submission = {
    submission_id: uuidv4(),
    received_at: new Date().toISOString(),
    source: 'file_drop',
    broker: {
      name: acord_125?.producer_name ?? '',
      agency: acord_125?.producer_agency ?? '',
      email: acord_125?.contact_email,
      phone: acord_125?.contact_phone,
      license: acord_125?.producer_license,
    },
    named_insured: {
      name: acord_125?.named_insured ?? '',
      dba: acord_125?.dba,
      entity_type: acord_125?.entity_type as Submission['named_insured']['entity_type'],
      fein: acord_125?.fein,
      mailing_address: acord_125?.mailing_address
        ? { street: acord_125.mailing_address, city: '', state: '', zip: '' }
        : undefined,
    },
    policy_period: {
      effective_date: effectiveDate,
      expiration_date: expirationDate,
      term_months: termMonths,
    },
    prior_insurance: {
      carrier: acord_125?.prior_carrier,
      policy_number: acord_125?.prior_policy_number,
      premium: acord_125?.prior_premium,
      limits: acord_125?.prior_limits,
      deductible: acord_125?.prior_deductible,
    },
    occupancy_type: occupancyType,
    locations: scoredLocations,
    loss_history: lossHistory,
    flags: [],
    recommendation: 'BIND',
    premium_summary: {
      total_property_premium: 0,
      total_gl_premium: 0,
      total_premium: 0,
      blended_property_rate: 0,
      blended_gl_rate_per_unit: 0,
      total_tiv: 0,
      total_units: 0,
    },
    checklist: {
      acord_125: parseResult.document_types_found.includes('ACORD_125') ? 'received' : 'missing',
      acord_140: parseResult.document_types_found.includes('ACORD_140') ? 'received' : 'missing',
      sov: parseResult.document_types_found.includes('SOV') ? 'received' : 'missing',
      loss_runs: parseResult.document_types_found.includes('LOSS_RUNS')
        ? (lossHistory.is_stale ? 'stale' : 'received')
        : 'missing',
      gl_supplemental: parseResult.document_types_found.includes('GL_SUPPLEMENTAL')
        ? 'received'
        : (occupancyType === 'student_housing' ? 'missing' : 'na'),
      prior_dec_page: parseResult.document_types_found.includes('PRIOR_DEC') ? 'received' : 'missing',
      rent_roll: parseResult.document_types_found.includes('RENT_ROLL') ? 'received' : 'missing',
      inspection_report: parseResult.document_types_found.includes('INSPECTION_REPORT') ? 'received' : 'missing',
      photos: parseResult.document_types_found.includes('PHOTOS') ? 'received' : 'missing',
    },
    operator_name: operatorName,
    operator_tier: operatorTier,
    dscr,
    data_gaps: [],
    processing_notes: parseResult.parse_errors,
  };

  // Compute premium summary
  submission.premium_summary = computePremiumSummary(submission);

  // Run eligibility checks
  const { flags: eligibilityFlags } = checkEligibility(submission);
  const dataGapFlags = generateDataGapFlags(submission);
  submission.flags = [...eligibilityFlags, ...dataGapFlags];

  // Collect data gaps
  const dataGaps: string[] = [
    ...dataGapFlags.map((f) => f.description),
    ...parseResult.parse_errors,
  ];
  if (!dscr) dataGaps.push('DSCR not available - defaulted to 1.00 factor');
  if (!acord_125?.named_insured) dataGaps.push('Named insured not extracted from ACORD 125');
  submission.data_gaps = dataGaps;

  // Set recommendation
  submission.recommendation = deriveRecommendation(submission.flags, submission.data_gaps);

  // Generate narrative
  const { strengths, concerns } = await generateNarrative(submission);

  return { submission, strengths, concerns };
}
