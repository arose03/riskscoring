import { Building, ConstructionType, BuildingRating, ITVFlag } from '../types/submission';
import catZones from '../../../config/cat_zones.json';
import operatorTiers from '../../../config/operator_tiers.json';

// Base rates per $100 TIV
const BASE_RATES: Record<string, number> = {
  student_housing_sprinklered: 0.23,
  student_housing_non_sprinklered: 0.2875, // 0.23 * 1.25
  conventional_mf_standard: 0.20,
  conventional_mf_low: 0.18,
  conventional_mf_high: 0.22,
};

// Construction factors
const CONSTRUCTION_FACTORS: Record<ConstructionType, number> = {
  FRAME: 1.10,
  JM: 1.00,
  NC: 0.92,
  FR: 0.88,
};

// Minimum premium per building (floored at $500 to make total min $5000 across portfolio)
const MIN_BUILDING_PREMIUM = 500;

export function getBaseRate(
  occupancyType: 'student_housing' | 'conventional_mf',
  sprinklered: boolean
): number {
  if (occupancyType === 'student_housing') {
    return sprinklered
      ? BASE_RATES.student_housing_sprinklered
      : BASE_RATES.student_housing_non_sprinklered;
  }
  return BASE_RATES.conventional_mf_standard;
}

export function getConstructionFactor(constructionType: ConstructionType): number {
  return CONSTRUCTION_FACTORS[constructionType] ?? 1.00;
}

export function getAgeFactor(
  yearBuilt: number,
  yearRenovated: number | null | undefined,
  currentYear?: number
): number {
  const year = currentYear ?? new Date().getFullYear();
  const age = year - yearBuilt;

  // Check for gut rehab: all four systems must have been updated within the last 20 years
  const hasGutRehab = yearRenovated != null && (year - yearRenovated) <= 20;

  if (age <= 15) return 1.00;
  if (age <= 25) return 1.05;
  if (age <= 30) {
    return hasGutRehab ? 1.05 : 1.10;
  }
  // > 30 years
  return hasGutRehab ? 1.10 : 1.25; // flagged separately for decline; this factor is used if accepted on ACV
}

export function getScatterFactor(totalBuildingCount: number): number {
  if (totalBuildingCount === 1) return 1.00;
  if (totalBuildingCount <= 5) return 0.98;
  if (totalBuildingCount <= 15) return 0.95;
  if (totalBuildingCount <= 30) return 0.92;
  return 0.90;
}

export function getOperatorFactor(operatorTier: string): number {
  const tiers = operatorTiers.tiers as Record<string, { factor: number }>;
  return tiers[operatorTier]?.factor ?? 1.00;
}

export function getDSCRFactor(dscr: number | null | undefined): number {
  if (dscr == null) return 1.00;
  if (dscr >= 1.60) return 0.90;
  if (dscr >= 1.30) return 0.95;
  if (dscr >= 1.20) return 1.00;
  if (dscr >= 1.00) return 1.05;
  return 1.10;
}

export function getWorkOrderFactor(score: number | null | undefined): number {
  if (score == null) return 1.00;
  const factors: Record<number, number> = {
    1: 0.90,
    2: 0.95,
    3: 1.00,
    4: 1.05,
    5: 1.10,
  };
  return factors[Math.round(score)] ?? 1.00;
}

export function getCATLoad(state: string, county?: string, isCoastal?: boolean): number {
  const stateLoads = catZones.state_loads as Record<
    string,
    { default: number; coastal?: number; north_panhandle?: number; notes: string }
  >;
  const stateData = stateLoads[state.toUpperCase()];
  if (!stateData) return 1.00;

  if (isCoastal && stateData.coastal) {
    return stateData.coastal;
  }
  return stateData.default;
}

export function calculateITVPerSqft(tiv: number, sqft: number): number {
  if (!sqft || sqft === 0) return 0;
  return tiv / sqft;
}

export function getITVFlag(itvPerSqft: number): ITVFlag {
  if (itvPerSqft >= 200) return 'green';
  if (itvPerSqft >= 150) return 'yellow';
  return 'red';
}

export interface RatingInputs {
  occupancyType: 'student_housing' | 'conventional_mf';
  building: Building;
  totalBuildingCount: number;
  operatorTier: string;
  dscr?: number | null;
  workOrderScore?: number | null;
  isCoastal?: boolean;
  scheduleFactor?: number;
}

export function rateBuilding(inputs: RatingInputs): BuildingRating {
  const {
    occupancyType,
    building,
    totalBuildingCount,
    operatorTier,
    dscr,
    workOrderScore,
    isCoastal,
    scheduleFactor = 1.00,
  } = inputs;

  const base_rate = getBaseRate(occupancyType, building.sprinkler_status);
  const construction_factor = getConstructionFactor(building.construction_type);
  const age_factor = getAgeFactor(building.year_built, building.year_renovated);
  const scatter_factor = getScatterFactor(totalBuildingCount);
  const operator_factor = getOperatorFactor(operatorTier);
  const dscr_factor = getDSCRFactor(dscr);
  const work_order_factor = getWorkOrderFactor(workOrderScore);
  const cat_load = getCATLoad(building.address.state, building.address.county, isCoastal);

  const final_rate =
    base_rate *
    construction_factor *
    age_factor *
    scatter_factor *
    operator_factor *
    dscr_factor *
    work_order_factor *
    cat_load *
    scheduleFactor;

  const tiv = building.values.total_tiv;
  const premium = Math.max(MIN_BUILDING_PREMIUM, (tiv / 100) * final_rate);

  return {
    base_rate: roundTo4(base_rate),
    construction_factor: roundTo4(construction_factor),
    age_factor: roundTo4(age_factor),
    scatter_factor: roundTo4(scatter_factor),
    operator_factor: roundTo4(operator_factor),
    dscr_factor: roundTo4(dscr_factor),
    work_order_factor: roundTo4(work_order_factor),
    cat_load: roundTo4(cat_load),
    schedule_factor: roundTo4(scheduleFactor),
    final_rate: roundTo4(final_rate),
    premium: Math.round(premium),
  };
}

function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function getOperatorTierFromName(operatorName: string | undefined): string {
  if (!operatorName) return 'small_unknown';

  const nameLower = operatorName.toLowerCase();
  const tiers = operatorTiers.tiers as Record<
    string,
    { factor: number; operators?: string[] }
  >;

  for (const [tier, data] of Object.entries(tiers)) {
    if (data.operators) {
      for (const op of data.operators) {
        if (nameLower.includes(op.toLowerCase()) || op.toLowerCase().includes(nameLower)) {
          return tier;
        }
      }
    }
  }

  return 'small_unknown';
}
