// ============================================================
// HABGEN Risk Scorer – Scoring Logic & Factor Definitions
// ============================================================

import {
  ScoringFactor,
  GradeInfo,
  FactorScore,
  ScoringResult,
  ScoreValue,
} from './types';

// ----- Property Scoring Factors (13) -----
export const PROPERTY_FACTORS: ScoringFactor[] = [
  {
    key: 'construction',
    label: 'Construction Quality',
    weight: 0.12,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Fire Resistive (FR)', criteria: 'Steel/concrete, non-combustible throughout' },
      { score: 2, label: 'Non-Combustible (NC)', criteria: 'Steel frame, non-combustible walls/roof' },
      { score: 3, label: 'Joisted Masonry (JM)', criteria: 'Masonry walls, wood joists/roof' },
      { score: 4, label: 'Frame – New (<15yr)', criteria: 'Wood frame, good condition' },
      { score: 5, label: 'Frame – Old (>15yr)', criteria: 'Wood frame, deferred maintenance risk' },
    ],
  },
  {
    key: 'building_age',
    label: 'Building Age / Condition',
    weight: 0.10,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: '< 5 years', criteria: 'New construction, all systems current' },
      { score: 2, label: '5–15 years', criteria: 'Modern, well-maintained' },
      { score: 3, label: '15–25 years', criteria: 'Adequate, some systems aging' },
      { score: 4, label: '25–40 years', criteria: 'Aging, deferred maintenance risk' },
      { score: 5, label: '> 40 years', criteria: 'High deferred maintenance risk' },
    ],
  },
  {
    key: 'height',
    label: 'Height / Stories',
    weight: 0.05,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: '1–2 stories', criteria: 'Low-rise' },
      { score: 2, label: '3–4 stories', criteria: 'Garden-style' },
      { score: 3, label: '5–7 stories', criteria: 'Mid-rise' },
      { score: 4, label: '8–12 stories', criteria: 'High-rise' },
      { score: 5, label: '> 12 stories', criteria: 'Tall high-rise' },
    ],
  },
  {
    key: 'sprinkler',
    label: 'Sprinkler / Fire Protection',
    weight: 0.08,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Full NFPA 13', criteria: 'Full sprinkler + alarm + FD access' },
      { score: 2, label: 'Full sprinkler', criteria: 'Full but limited monitoring' },
      { score: 3, label: 'Partial', criteria: 'Common areas / NFPA 13R' },
      { score: 4, label: 'FE only', criteria: 'No sprinkler, extinguishers + alarms' },
      { score: 5, label: 'None', criteria: 'Minimal or non-functional' },
    ],
  },
  {
    key: 'university_tier',
    label: 'University Risk Tier',
    weight: 0.10,
    autoType: 'AUTO',
    scoreGuide: [
      { score: 1, label: 'Tier 1', criteria: 'Low party risk university' },
      { score: 2, label: 'Tier 2 (low)', criteria: 'Medium tier, party_score < 7.0' },
      { score: 3, label: 'Tier 2 (high)', criteria: 'Medium tier, party_score ≥ 7.0' },
      { score: 4, label: 'Tier 3 (low)', criteria: 'High tier, party_score < 8.0' },
      { score: 5, label: 'Tier 3 (high)', criteria: 'High tier, party_score ≥ 8.0' },
    ],
  },
  {
    key: 'occupancy',
    label: 'Occupancy Type',
    weight: 0.07,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Senior / LIHTC', criteria: 'Low risk tenancy' },
      { score: 2, label: 'Workforce', criteria: 'Working professionals' },
      { score: 3, label: 'Graduate', criteria: 'Graduate students' },
      { score: 4, label: 'Undergraduate', criteria: 'Undergraduate students' },
      { score: 5, label: 'Greek / Party', criteria: 'Fraternity/sorority housing' },
    ],
  },
  {
    key: 'crime',
    label: 'Crime Score',
    weight: 0.06,
    autoType: 'AI_EST',
    scoreGuide: [
      { score: 1, label: 'Very Low (<20)', criteria: 'Safe area, minimal history' },
      { score: 2, label: 'Low (20–35)', criteria: 'Generally safe' },
      { score: 3, label: 'Medium (35–50)', criteria: 'Average for student area' },
      { score: 4, label: 'High (50–70)', criteria: 'Above average crime' },
      { score: 5, label: 'Very High (>70)', criteria: 'High crime, significant GL exposure' },
    ],
  },
  {
    key: 'sponsor',
    label: 'Sponsor / Mgmt Tier',
    weight: 0.10,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Top Institutional', criteria: 'Major REIT/PE, >$1B AUM, proven' },
      { score: 2, label: 'Strong Regional', criteria: '>$200M AUM, good record' },
      { score: 3, label: 'Adequate', criteria: 'Professional, smaller, adequate systems' },
      { score: 4, label: 'Thin / Emerging', criteria: 'Limited track record, small portfolio' },
      { score: 5, label: 'New / Poor', criteria: 'First-time or documented issues' },
    ],
  },
  {
    key: 'dscr',
    label: 'DSCR Strength',
    weight: 0.07,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: '≥ 1.60x', criteria: 'Very strong coverage' },
      { score: 2, label: '1.40–1.59x', criteria: 'Strong' },
      { score: 3, label: '1.25–1.39x', criteria: 'Adequate' },
      { score: 4, label: '1.10–1.24x', criteria: 'Thin, stress possible' },
      { score: 5, label: '< 1.10x', criteria: 'Weak, elevated default risk' },
    ],
  },
  {
    key: 'distance',
    label: 'Distance from Campus',
    weight: 0.08,
    autoType: 'AUTO',
    scoreGuide: [
      { score: 1, label: '< 0.25 mi', criteria: 'Adjacent/on-campus, highest demand' },
      { score: 2, label: '0.25–0.5 mi', criteria: 'Easy walk, strong demand' },
      { score: 3, label: '0.5–1.0 mi', criteria: 'Bikeable, decent demand' },
      { score: 4, label: '1.0–2.0 mi', criteria: 'Requires transport, higher vacancy' },
      { score: 5, label: '> 2.0 mi', criteria: 'Remote, low demand' },
    ],
  },
  {
    key: 'rent_vs_market',
    label: 'Rent vs. Market',
    weight: 0.07,
    autoType: 'AI_EST',
    scoreGuide: [
      { score: 1, label: '> 120%', criteria: 'Premium product, strong cash flow' },
      { score: 2, label: '110–120%', criteria: 'Above market' },
      { score: 3, label: '100–110%', criteria: 'At market' },
      { score: 4, label: '90–100%', criteria: 'Below market, cash flow stress' },
      { score: 5, label: '< 90%', criteria: 'Significantly below, possible distress' },
    ],
  },
  {
    key: 'work_orders',
    label: 'Work Order / Maintenance',
    weight: 0.05,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Excellent', criteria: 'Proactive maintenance, fast resolution' },
      { score: 2, label: 'Good', criteria: 'Responsive, minor backlogs' },
      { score: 3, label: 'Average', criteria: 'Adequate turnaround' },
      { score: 4, label: 'Below Average', criteria: 'Slow response, growing backlog' },
      { score: 5, label: 'Poor', criteria: 'Chronic backlog, deferred maintenance' },
    ],
  },
  {
    key: 'loss_history',
    label: 'Loss History',
    weight: 0.05,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'No losses 3+ yr', criteria: 'Clean record' },
      { score: 2, label: 'Minor only', criteria: 'Small attritional, LR <40%' },
      { score: 3, label: 'Moderate', criteria: 'Meaningful claims, LR 40–60%' },
      { score: 4, label: 'Significant', criteria: 'Large/frequent, LR 60–80%' },
      { score: 5, label: 'Severe', criteria: 'Catastrophic or chronic, LR >80%' },
    ],
  },
];

// ----- GL Scoring Factors (11) -----
export const GL_FACTORS: ScoringFactor[] = [
  {
    key: 'gl_university_tier',
    label: 'University Risk Tier',
    weight: 0.12,
    autoType: 'AUTO',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'university_tier')!.scoreGuide,
  },
  {
    key: 'gl_occupancy',
    label: 'Occupancy Type',
    weight: 0.10,
    autoType: 'MANUAL',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'occupancy')!.scoreGuide,
  },
  {
    key: 'gl_distance',
    label: 'Distance from Campus',
    weight: 0.12,
    autoType: 'AUTO',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'distance')!.scoreGuide,
  },
  {
    key: 'gl_rent_vs_market',
    label: 'Rent vs. Market',
    weight: 0.08,
    autoType: 'AI_EST',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'rent_vs_market')!.scoreGuide,
  },
  {
    key: 'gl_crime',
    label: 'Crime Score',
    weight: 0.10,
    autoType: 'AI_EST',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'crime')!.scoreGuide,
  },
  {
    key: 'gl_amenity_risk',
    label: 'Amenity Risk',
    weight: 0.08,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'None / Basic', criteria: 'Basic fitness room' },
      { score: 2, label: 'Gym', criteria: 'Equipment fitness center' },
      { score: 3, label: 'Pool', criteria: 'Pool (slip/fall/drowning exposure)' },
      { score: 4, label: 'Pool + Deck', criteria: 'Outdoor social area' },
      { score: 5, label: 'Full Party', criteria: 'Pool + party deck + bar, highest GL' },
    ],
  },
  {
    key: 'gl_premises',
    label: 'Premises Condition',
    weight: 0.08,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Excellent', criteria: 'Well-maintained, no hazards' },
      { score: 2, label: 'Good', criteria: 'Minor cosmetic issues' },
      { score: 3, label: 'Average', criteria: 'Some deferred maintenance' },
      { score: 4, label: 'Below Average', criteria: 'Visible deterioration' },
      { score: 5, label: 'Poor', criteria: 'Significant hazards present' },
    ],
  },
  {
    key: 'gl_sponsor',
    label: 'Sponsor / Mgmt Tier',
    weight: 0.10,
    autoType: 'MANUAL',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'sponsor')!.scoreGuide,
  },
  {
    key: 'gl_work_orders',
    label: 'Work Order / Maintenance',
    weight: 0.07,
    autoType: 'MANUAL',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'work_orders')!.scoreGuide,
  },
  {
    key: 'gl_loss_history',
    label: 'Loss History',
    weight: 0.08,
    autoType: 'MANUAL',
    scoreGuide: PROPERTY_FACTORS.find(f => f.key === 'loss_history')!.scoreGuide,
  },
  {
    key: 'gl_security',
    label: 'Security Measures',
    weight: 0.07,
    autoType: 'MANUAL',
    scoreGuide: [
      { score: 1, label: 'Comprehensive', criteria: '24hr + cameras + access + patrols' },
      { score: 2, label: 'Strong', criteria: 'Cameras + controlled access' },
      { score: 3, label: 'Moderate', criteria: 'Key fob, basic cameras' },
      { score: 4, label: 'Basic', criteria: 'Locked entries, no cameras' },
      { score: 5, label: 'None', criteria: 'Open access' },
    ],
  },
];

// ----- Grade Mapping -----
export const GRADE_MAP: GradeInfo[] = [
  { grade: 'A+', label: 'Excellent', action: 'BIND – Standard Terms', actionType: 'BIND', rateMod: -15, minScore: 1.00, maxScore: 1.50 },
  { grade: 'A', label: 'Very Good', action: 'BIND – Standard Terms', actionType: 'BIND', rateMod: -10, minScore: 1.51, maxScore: 2.00 },
  { grade: 'B+', label: 'Good', action: 'BIND – Review Pricing', actionType: 'BIND', rateMod: -5, minScore: 2.01, maxScore: 2.50 },
  { grade: 'B', label: 'Average', action: 'BIND – Review Pricing', actionType: 'BIND', rateMod: 0, minScore: 2.51, maxScore: 3.00 },
  { grade: 'C+', label: 'Below Avg', action: 'REFER – Senior UW', actionType: 'REFER', rateMod: 10, minScore: 3.01, maxScore: 3.50 },
  { grade: 'C', label: 'Marginal', action: 'REFER – Committee', actionType: 'REFER', rateMod: 20, minScore: 3.51, maxScore: 4.00 },
  { grade: 'D', label: 'Poor', action: 'DECLINE', actionType: 'DECLINE', rateMod: 35, minScore: 4.01, maxScore: 5.00 },
];

// ----- Compute weighted score -----
export function computeScore(
  factors: ScoringFactor[],
  scores: Record<string, FactorScore>
): ScoringResult {
  const totalFactors = factors.length;
  let completedFactors = 0;
  let weightedSum = 0;

  for (const factor of factors) {
    const fs = scores[factor.key];
    if (fs && fs.score !== null) {
      completedFactors++;
      weightedSum += fs.score * factor.weight;
    }
  }

  const isComplete = completedFactors === totalFactors;
  const weightedScore = isComplete ? Math.round(weightedSum * 100) / 100 : null;

  let grade: GradeInfo | null = null;
  if (weightedScore !== null) {
    grade = GRADE_MAP.find(g => weightedScore >= g.minScore && weightedScore <= g.maxScore) ?? null;
  }

  return { weightedScore, grade, completedFactors, totalFactors, isComplete };
}

// ----- University Tier → Score -----
export function universityTierToScore(tier: number, partyScore: number): ScoreValue {
  if (tier === 3 && partyScore >= 8.0) return 5;
  if (tier === 3) return 4;
  if (tier === 2 && partyScore >= 7.0) return 3;
  if (tier === 2) return 2;
  return 1;
}

// ----- Distance → Score -----
export function distanceToScore(miles: number): ScoreValue {
  if (miles < 0.25) return 1;
  if (miles <= 0.5) return 2;
  if (miles <= 1.0) return 3;
  if (miles <= 2.0) return 4;
  return 5;
}

// ----- Rent ratio → Score -----
export function rentRatioToScore(ratio: number): ScoreValue {
  if (ratio > 1.20) return 1;
  if (ratio >= 1.10) return 2;
  if (ratio >= 1.00) return 3;
  if (ratio >= 0.90) return 4;
  return 5;
}

// ----- Haversine distance (miles) -----
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
