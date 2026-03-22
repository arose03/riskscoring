import { callLLMJSON } from '../llm/client';
import { LOSS_RUN_EXTRACTOR_SYSTEM } from '../llm/prompts';
import { Claim, LossHistory } from '../types/submission';

interface LossRunParseResult {
  claims: Claim[];
  loss_run_date: string | null;
  policy_periods: Array<{ period: string; earned_premium: number | null }>;
}

const CAT_KEYWORDS = [
  'wind', 'hail', 'storm', 'hurricane', 'tornado', 'flood', 'freeze',
  'ice', 'snow', 'lightning', 'wildfire', 'earthquake', 'cat ', 'catastrophe',
  'named storm', 'tropical'
];

export async function parseLossRuns(text: string): Promise<LossRunParseResult> {
  try {
    const result = await callLLMJSON<LossRunParseResult>(
      LOSS_RUN_EXTRACTOR_SYSTEM,
      `Parse this loss run document and extract all claims:\n\n${text.substring(0, 10000)}`
    );
    return result;
  } catch (err) {
    console.error('Loss run parse error:', err);
    return { claims: [], loss_run_date: null, policy_periods: [] };
  }
}

function isCATClaim(claim: Claim): boolean {
  const desc = (claim.description ?? '').toLowerCase();
  const type = (claim.claim_type ?? '').toLowerCase();
  return CAT_KEYWORDS.some((kw) => desc.includes(kw) || type.includes(kw));
}

export function computeLossMetrics(
  claims: Claim[],
  lossRunDate: string | null,
  submissionDate?: string
): LossHistory {
  const catClaims = claims.filter(isCATClaim);
  const singleCATOver100K = catClaims.some((c) => c.total_incurred > 100_000);

  const paidOver50K = claims.filter(
    (c) => c.total_paid > 50_000 && c.claim_status.toLowerCase() === 'closed'
  ).length;

  const largestSingleLoss = claims.reduce((max, c) => Math.max(max, c.total_incurred ?? 0), 0);

  // Loss ratio: if we don't have earned premium, we can't compute it
  // Default to 0 to avoid false flags - flag as data gap
  const incurredLossRatio5yr = 0;

  // Check staleness (>90 days)
  let isStale = false;
  if (lossRunDate) {
    const runDate = new Date(lossRunDate);
    const compareDate = submissionDate ? new Date(submissionDate) : new Date();
    const diffDays = (compareDate.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24);
    isStale = diffDays > 90;
  }

  return {
    claims,
    total_claims_5yr: claims.length,
    paid_claims_over_50k: paidOver50K,
    incurred_loss_ratio_5yr: incurredLossRatio5yr,
    largest_single_loss: largestSingleLoss,
    single_cat_loss_over_100k: singleCATOver100K,
    claim_frequency: 0, // Requires units and years - compute separately
    loss_run_date: lossRunDate ?? undefined,
    is_stale: isStale,
  };
}
