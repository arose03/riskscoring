import { Submission, Recommendation, Flag } from '../types/submission';

const MIN_TOTAL_PREMIUM = 5000;

export function deriveRecommendation(
  flags: Flag[],
  dataGaps: string[]
): Recommendation {
  const hasDecline = flags.some((f) => f.flag_type === 'DECLINE');
  if (hasDecline) return 'DECLINE';

  const hasReferral = flags.some((f) => f.flag_type === 'REFERRAL');
  if (hasReferral || dataGaps.length > 0) return 'CONDITIONAL_BIND';

  return 'BIND';
}

export function applyMinimumPremium(
  totalPremium: number
): number {
  return Math.max(MIN_TOTAL_PREMIUM, totalPremium);
}

export function computePremiumSummary(submission: Submission): Submission['premium_summary'] {
  const locations = submission.locations;

  let totalPropertyPremium = 0;
  let totalGLPremium = 0;
  let totalTIV = 0;
  let totalUnits = 0;

  for (const loc of locations) {
    totalPropertyPremium += loc.location_property_premium;
    totalGLPremium += loc.location_gl_premium;
    totalTIV += loc.location_tiv;
    totalUnits += loc.num_units_total;
  }

  // Apply minimum premium
  const totalPremium = applyMinimumPremium(totalPropertyPremium + totalGLPremium);

  // Blended property rate = total property premium / (total TIV / 100)
  const blendedPropertyRate = totalTIV > 0
    ? (totalPropertyPremium / totalTIV) * 100
    : 0;

  // Blended GL rate per unit
  const blendedGLRatePerUnit = totalUnits > 0 ? totalGLPremium / totalUnits : 0;

  return {
    total_property_premium: Math.round(totalPropertyPremium),
    total_gl_premium: Math.round(totalGLPremium),
    total_premium: Math.round(totalPremium),
    blended_property_rate: Math.round(blendedPropertyRate * 10000) / 10000,
    blended_gl_rate_per_unit: Math.round(blendedGLRatePerUnit * 100) / 100,
    total_tiv: Math.round(totalTIV),
    total_units: totalUnits,
  };
}
