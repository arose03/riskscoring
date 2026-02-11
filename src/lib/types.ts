// ============================================================
// HABGEN Risk Scorer – Core Types
// ============================================================

export interface University {
  id: number;
  name: string;
  party_score: number;
  tier: 1 | 2 | 3;
  campus_lat: number | null;
  campus_lng: number | null;
}

export type ScoreValue = 1 | 2 | 3 | 4 | 5;

export type SourceType = 'AUTO' | 'AI_EST' | 'MANUAL' | 'OVERRIDE';

export interface FactorScore {
  factorKey: string;
  score: ScoreValue | null;
  source: SourceType;
  originalSource?: SourceType;
  aiReasoning?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
}

export interface ScoringFactor {
  key: string;
  label: string;
  weight: number; // decimal, e.g. 0.12 for 12%
  autoType: 'AUTO' | 'AI_EST' | 'MANUAL';
  scoreGuide: ScoreGuideEntry[];
}

export interface ScoreGuideEntry {
  score: ScoreValue;
  label: string;
  criteria: string;
}

export type RiskGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

export interface GradeInfo {
  grade: RiskGrade;
  label: string;
  action: string;
  actionType: 'BIND' | 'REFER' | 'DECLINE';
  rateMod: number; // e.g. -15 for -15%
  minScore: number;
  maxScore: number;
}

export interface ScoringResult {
  weightedScore: number | null;
  grade: GradeInfo | null;
  completedFactors: number;
  totalFactors: number;
  isComplete: boolean;
}

export interface PropertyInfo {
  address: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  universityId: number | null;
  universityName: string;
  tiv: string;
  units: string;
  yearBuilt: string;
  stories: string;
  construction: string;
  sprinkler: string;
  occupancy: string;
  sponsorTier: string;
  dscr: string;
  actualRent: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

export interface DistanceResult {
  miles: number;
  auto_score: ScoreValue;
}

export interface AIEstimateResult {
  score: ScoreValue;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  estimated_market_rent?: number;
  sources?: string[];
}
