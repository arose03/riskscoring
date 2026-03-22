// Core submission data model for HABGEN Underwriting Engine

export type ConstructionType = 'FRAME' | 'JM' | 'NC' | 'FR';
export type OccupancyType = 'student_housing' | 'conventional_mf';
export type EntityType = 'Corporation' | 'LLC' | 'Partnership' | 'Individual' | 'Trust' | 'Joint Venture' | 'Other';
export type FlagType = 'DECLINE' | 'REFERRAL' | 'INFO';
export type Recommendation = 'BIND' | 'CONDITIONAL_BIND' | 'DECLINE';
export type ChecklistStatus = 'received' | 'missing' | 'stale' | 'na';
export type ITVFlag = 'green' | 'yellow' | 'red';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

export interface BuildingValues {
  building: number;
  bpp: number;
  bi: number;
  total_tiv: number;
}

export interface BuildingRating {
  base_rate: number;
  construction_factor: number;
  age_factor: number;
  scatter_factor: number;
  operator_factor: number;
  dscr_factor: number;
  work_order_factor: number;
  cat_load: number;
  schedule_factor: number;
  final_rate: number;
  premium: number;
}

export interface HazardData {
  flood_zone?: string;
  wildfire_score?: string;
  hail_zone?: string;
  wind_zone?: string;
  earthquake_zone?: string;
  crime_score?: string;
  hurricane_score?: string;
  tornado_score?: string;
  protection_class?: number;
}

export interface ReviewData {
  google_rating?: number;
  review_count?: number;
  negative_themes?: string[];
  uw_risk_relevance?: string;
  management_company?: string;
}

export interface Building {
  building_number: number;
  address: Address;
  year_built: number;
  year_renovated?: number | null;
  stories: number;
  num_units: number;
  num_beds?: number | null;
  square_footage: number;
  construction_type: ConstructionType;
  sprinkler_status: boolean;
  protection_class: number;
  roof_type?: string;
  roof_year?: number | null;
  electrical_year?: number | null;
  plumbing_year?: number | null;
  hvac_year?: number | null;
  values: BuildingValues;
  rating: BuildingRating;
  hazard_data: HazardData;
  reviews: ReviewData;
  itv_per_sqft: number;
  itv_flag: ITVFlag;
}

export interface GLScorerFactors {
  vsa_score: number;      // Violence & Sexual Assault (20%)
  sf_score: number;       // Substance & Fraternity (20%)
  party_score: number;    // Party Culture (15%)
  security_score: number; // Security (15%)
  game_day_score: number; // Game Day (10%)
  greek_score: number;    // Greek Life (10%)
  litigation_score: number; // Litigation (10%)
  composite_score: number;
  rate_modification: number; // decimal, e.g. 0.25 = +25%
}

export interface UniversityInfo {
  name: string | null;
  gl_scorer?: GLScorerFactors;
}

export interface Location {
  location_number: number;
  buildings: Building[];
  university?: UniversityInfo;
  location_tiv: number;
  location_property_premium: number;
  location_gl_premium: number;
  num_units_total: number;
}

export interface Claim {
  claim_number?: string;
  date_of_loss: string;
  date_reported?: string;
  claim_type: string;
  claim_status: 'open' | 'closed' | 'reopened' | string;
  description?: string;
  total_incurred: number;
  total_paid: number;
  total_reserved: number;
  location?: string;
  claimant?: string;
}

export interface LossHistory {
  claims: Claim[];
  total_claims_5yr: number;
  paid_claims_over_50k: number;
  incurred_loss_ratio_5yr: number;
  largest_single_loss: number;
  single_cat_loss_over_100k: boolean;
  claim_frequency: number;
  loss_run_date?: string; // date the loss run was generated
  is_stale?: boolean;
}

export interface Flag {
  flag_type: FlagType;
  category: string;
  description: string;
  locations_affected: number[];
  source: string;
}

export interface PremiumSummary {
  total_property_premium: number;
  total_gl_premium: number;
  total_premium: number;
  blended_property_rate: number;
  blended_gl_rate_per_unit: number;
  total_tiv: number;
  total_units: number;
}

export interface Checklist {
  acord_125: ChecklistStatus;
  acord_140: ChecklistStatus;
  sov: ChecklistStatus;
  loss_runs: ChecklistStatus;
  gl_supplemental: ChecklistStatus;
  prior_dec_page: ChecklistStatus;
  rent_roll: ChecklistStatus;
  inspection_report: ChecklistStatus;
  photos: ChecklistStatus;
}

export interface Broker {
  name: string;
  agency: string;
  email?: string;
  phone?: string;
  license?: string;
}

export interface NamedInsured {
  name: string;
  dba?: string;
  entity_type?: EntityType;
  fein?: string;
  mailing_address?: Address;
}

export interface PolicyPeriod {
  effective_date?: string;
  expiration_date?: string;
  term_months?: number;
}

export interface PriorInsurance {
  carrier?: string;
  policy_number?: string;
  effective_date?: string;
  expiration_date?: string;
  premium?: number;
  limits?: string;
  deductible?: number;
  years_with_carrier?: number;
}

export interface Submission {
  submission_id: string;
  received_at: string;
  source: 'file_drop' | 'email';
  broker: Broker;
  named_insured: NamedInsured;
  policy_period: PolicyPeriod;
  prior_insurance: PriorInsurance;
  occupancy_type: OccupancyType;
  locations: Location[];
  loss_history: LossHistory;
  flags: Flag[];
  recommendation: Recommendation;
  premium_summary: PremiumSummary;
  checklist: Checklist;
  operator_name?: string;
  operator_tier?: string;
  dscr?: number;
  data_gaps: string[];
  processing_notes: string[];
}

// Parsed raw data from documents (before engine processing)
export interface RawBuildingData {
  location_number?: number;
  building_number?: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  year_built?: number;
  year_renovated?: number | null;
  stories?: number;
  num_units?: number;
  num_beds?: number | null;
  square_footage?: number;
  construction_type?: string; // raw before normalization
  sprinkler_status?: boolean;
  protection_class?: number;
  building_value?: number;
  bpp_value?: number;
  bi_value?: number;
  total_insured_value?: number;
  occupancy?: string;
  roof_type?: string;
  roof_year?: number | null;
  electrical_year?: number | null;
  plumbing_year?: number | null;
  hvac_year?: number | null;
}

export interface ParsedACORD125 {
  named_insured?: string;
  dba?: string;
  mailing_address?: string;
  entity_type?: string;
  fein?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  producer_name?: string;
  producer_agency?: string;
  producer_license?: string;
  effective_date?: string;
  expiration_date?: string;
  prior_carrier?: string;
  prior_policy_number?: string;
  prior_premium?: number;
  prior_limits?: string;
  prior_deductible?: number;
}

export interface ParsedGLSupplemental {
  university_name?: string;
  violence_sexual_assault_notes?: string;
  substance_and_fraternity_notes?: string;
  party_culture_notes?: string;
  security_measures?: string;
  game_day_info?: string;
  greek_life_info?: string;
  litigation_environment?: string;
}

export interface DocumentParseResult {
  acord_125?: ParsedACORD125;
  sov_buildings?: RawBuildingData[];
  claims?: Claim[];
  gl_supplemental?: ParsedGLSupplemental;
  loss_run_date?: string;
  parse_errors: string[];
  document_types_found: string[];
}
