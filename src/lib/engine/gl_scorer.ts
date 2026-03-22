import { GLScorerFactors, Location } from '../types/submission';
import universityScores from '../../../config/university_scores.json';

// Factor weights (must sum to 1.0)
const WEIGHTS = {
  vsa: 0.20,       // Violence & Sexual Assault
  sf: 0.20,        // Substance & Fraternity
  party: 0.15,     // Party Culture
  security: 0.15,  // Security
  game_day: 0.10,  // Game Day
  greek: 0.10,     // Greek Life
  litigation: 0.10, // Litigation Environment
};

// GL Base rates per unit
const GL_BASE_RATES = {
  student_housing_standard: 100,   // per unit
  student_housing_premium: 125,    // SEC, Big 12, Big Ten party schools
  conventional_mf_standard: 90,   // per unit
  florida_flat: 400,               // FL flat rate regardless of scorer
  min_premium: 5000,               // portfolio minimum
};

// Premium market schools (SEC, Big 12, Big Ten party schools)
const PREMIUM_MARKET_SCHOOLS = [
  'Alabama', 'LSU', 'Georgia', 'Tennessee', 'Arkansas', 'Auburn', 'Mississippi',
  'Ole Miss', 'South Carolina', 'Vanderbilt', 'Florida', 'Kentucky',
  'Penn State', 'Michigan', 'Ohio State', 'Michigan State', 'Wisconsin',
  'Minnesota', 'Iowa', 'Indiana', 'Purdue', 'Nebraska', 'Northwestern',
  'Rutgers', 'Maryland', 'Illinois',
  'Texas', 'Oklahoma', 'Baylor', 'Texas Tech', 'Kansas State',
  'Oklahoma State', 'Kansas', 'TCU', 'Iowa State', 'West Virginia',
  'Texas A&M', 'Missouri',
];

export interface UniversityScoreRecord {
  name: string;
  vsa_score: number;
  sf_score: number;
  party_score: number;
  security_score: number;
  game_day_score: number;
  greek_score: number;
  litigation_score: number;
  composite_score: number;
  state: string;
}

export function lookupUniversityScores(universityName: string): UniversityScoreRecord | null {
  const nameLower = universityName.toLowerCase().trim();
  const scores = universityScores.universities as UniversityScoreRecord[];

  // Exact match first
  const exact = scores.find(
    (u) => u.name.toLowerCase() === nameLower
  );
  if (exact) return exact;

  // Partial match
  const partial = scores.find(
    (u) =>
      u.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(u.name.toLowerCase())
  );
  if (partial) return partial;

  // Fuzzy: check if any word in the query matches
  const words = nameLower.split(/\s+/).filter((w) => w.length > 3);
  for (const score of scores) {
    const scoreLower = score.name.toLowerCase();
    if (words.some((w) => scoreLower.includes(w))) {
      return score;
    }
  }

  return null;
}

export function computeCompositeScore(factors: Omit<GLScorerFactors, 'composite_score' | 'rate_modification'>): number {
  const composite =
    factors.vsa_score * WEIGHTS.vsa +
    factors.sf_score * WEIGHTS.sf +
    factors.party_score * WEIGHTS.party +
    factors.security_score * WEIGHTS.security +
    factors.game_day_score * WEIGHTS.game_day +
    factors.greek_score * WEIGHTS.greek +
    factors.litigation_score * WEIGHTS.litigation;

  return Math.round(composite * 100) / 100;
}

export function getRateModification(compositeScore: number): number {
  if (compositeScore >= 8.0) return 1.00;    // +100%
  if (compositeScore >= 7.0) return 0.625;   // +62.5% (midpoint of 50-75%)
  if (compositeScore >= 6.0) return 0.375;   // +37.5% (midpoint of 25-50%)
  if (compositeScore >= 5.0) return 0.125;   // +12.5% (midpoint of 0-25%)
  if (compositeScore >= 4.0) return 0.00;    // standard
  if (compositeScore >= 3.0) return -0.075;  // -7.5% (midpoint of -5 to -10%)
  return -0.125;                              // -12.5% (midpoint of -10 to -15%)
}

export function getGLBaseRate(
  universityName: string | null,
  state: string,
  occupancyType: 'student_housing' | 'conventional_mf'
): number {
  if (state.toUpperCase() === 'FL') return GL_BASE_RATES.florida_flat;

  if (occupancyType === 'conventional_mf') return GL_BASE_RATES.conventional_mf_standard;

  // Check if premium market school
  if (universityName) {
    const nameLower = universityName.toLowerCase();
    if (PREMIUM_MARKET_SCHOOLS.some((s) => nameLower.includes(s.toLowerCase()))) {
      return GL_BASE_RATES.student_housing_premium;
    }
  }

  return GL_BASE_RATES.student_housing_standard;
}

export function calculateGLPremium(
  numUnits: number,
  baseRate: number,
  rateModification: number,
  state: string
): number {
  let premium: number;
  if (state.toUpperCase() === 'FL') {
    // FL: flat rate, no modification
    premium = baseRate * numUnits;
  } else {
    const modifiedRate = baseRate * (1 + rateModification);
    premium = modifiedRate * numUnits;
  }
  return Math.round(Math.max(GL_BASE_RATES.min_premium, premium));
}

export function buildGLScorer(
  universityName: string | null,
  supplementalData?: {
    vsa?: number;
    sf?: number;
    party?: number;
    security?: number;
    game_day?: number;
    greek?: number;
    litigation?: number;
  }
): GLScorerFactors | null {
  let scores: Partial<GLScorerFactors> = {};

  // First try university lookup
  if (universityName) {
    const dbScores = lookupUniversityScores(universityName);
    if (dbScores) {
      scores = {
        vsa_score: dbScores.vsa_score,
        sf_score: dbScores.sf_score,
        party_score: dbScores.party_score,
        security_score: dbScores.security_score,
        game_day_score: dbScores.game_day_score,
        greek_score: dbScores.greek_score,
        litigation_score: dbScores.litigation_score,
      };
    }
  }

  // Override with supplemental data if provided
  if (supplementalData) {
    if (supplementalData.vsa != null) scores.vsa_score = supplementalData.vsa;
    if (supplementalData.sf != null) scores.sf_score = supplementalData.sf;
    if (supplementalData.party != null) scores.party_score = supplementalData.party;
    if (supplementalData.security != null) scores.security_score = supplementalData.security;
    if (supplementalData.game_day != null) scores.game_day_score = supplementalData.game_day;
    if (supplementalData.greek != null) scores.greek_score = supplementalData.greek;
    if (supplementalData.litigation != null) scores.litigation_score = supplementalData.litigation;
  }

  // If we have all 7 factors, compute composite
  const hasAll =
    scores.vsa_score != null &&
    scores.sf_score != null &&
    scores.party_score != null &&
    scores.security_score != null &&
    scores.game_day_score != null &&
    scores.greek_score != null &&
    scores.litigation_score != null;

  if (!hasAll) return null;

  const composite = computeCompositeScore(scores as Omit<GLScorerFactors, 'composite_score' | 'rate_modification'>);
  const rate_modification = getRateModification(composite);

  return {
    vsa_score: scores.vsa_score!,
    sf_score: scores.sf_score!,
    party_score: scores.party_score!,
    security_score: scores.security_score!,
    game_day_score: scores.game_day_score!,
    greek_score: scores.greek_score!,
    litigation_score: scores.litigation_score!,
    composite_score: composite,
    rate_modification,
  };
}

export function scoreLocationsGL(
  locations: Location[],
  occupancyType: 'student_housing' | 'conventional_mf'
): Location[] {
  return locations.map((loc) => {
    const totalUnits = loc.buildings.reduce((sum, b) => sum + b.num_units, 0);
    const primaryState = loc.buildings[0]?.address.state ?? '';
    const universityName = loc.university?.name ?? null;

    const glScorer = occupancyType === 'student_housing'
      ? buildGLScorer(universityName)
      : null;

    const baseRate = getGLBaseRate(universityName, primaryState, occupancyType);
    const rateModification = glScorer?.rate_modification ?? 0;
    const glPremium = calculateGLPremium(totalUnits, baseRate, rateModification, primaryState);

    return {
      ...loc,
      num_units_total: totalUnits,
      university: {
        ...loc.university,
        name: universityName,
        gl_scorer: glScorer ?? undefined,
      },
      location_gl_premium: glPremium,
    };
  });
}
