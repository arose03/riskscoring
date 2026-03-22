import { Submission, Flag } from '../types/submission';

const INELIGIBLE_STATES = ['HI', 'AK'];

export interface EligibilityResult {
  flags: Flag[];
  isIneligible: boolean;
  declineReasons: string[];
}

function addFlag(
  flags: Flag[],
  flag_type: Flag['flag_type'],
  category: string,
  description: string,
  locations_affected: number[] = [],
  source = 'auto'
): void {
  flags.push({ flag_type, category, description, locations_affected, source });
}

export function checkEligibility(submission: Submission): EligibilityResult {
  const flags: Flag[] = [];
  const declineReasons: string[] = [];

  const { locations, loss_history, policy_period, occupancy_type } = submission;

  // ───────────────────────────────────────────────────────────────
  // Territory check
  // ───────────────────────────────────────────────────────────────
  for (const loc of locations) {
    for (const bldg of loc.buildings) {
      const state = bldg.address.state?.toUpperCase();
      if (state && INELIGIBLE_STATES.includes(state)) {
        const reason = `State ${state} is ineligible territory (HI and AK excluded)`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'auto');
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Policy term check
  // ───────────────────────────────────────────────────────────────
  if (policy_period.term_months && policy_period.term_months > 18) {
    const reason = `Policy term ${policy_period.term_months} months exceeds 18-month maximum`;
    declineReasons.push(reason);
    addFlag(flags, 'DECLINE', 'Eligibility', reason, [], 'auto');
  }

  // ───────────────────────────────────────────────────────────────
  // GL Scorer decline check (score >= 8.0)
  // ───────────────────────────────────────────────────────────────
  for (const loc of locations) {
    if (loc.university?.gl_scorer) {
      const { composite_score } = loc.university.gl_scorer;
      if (composite_score >= 8.0) {
        const reason = `GL Composite Score ${composite_score.toFixed(2)} at ${loc.university.name ?? 'university'} meets decline threshold (≥8.0)`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'GL Risk', reason, [loc.location_number], 'gl_scorer');
      } else if (composite_score >= 7.0) {
        addFlag(
          flags,
          'REFERRAL',
          'GL Risk',
          `GL Composite Score ${composite_score.toFixed(2)} at ${loc.university.name ?? 'university'} (referral range 7.0-7.99)`,
          [loc.location_number],
          'gl_scorer'
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Per-building checks
  // ───────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();

  for (const loc of locations) {
    for (const bldg of loc.buildings) {
      // Protection class
      if (bldg.protection_class === 10) {
        const reason = `Protection Class 10 at ${bldg.address.street} (${loc.location_number})`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'CAT', reason, [loc.location_number], 'sov');
      } else if (bldg.protection_class === 9) {
        addFlag(
          flags,
          'REFERRAL',
          'CAT',
          `Protection Class 9 at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Age checks
      const age = currentYear - bldg.year_built;
      const hasRehab = bldg.year_renovated != null;

      if (age > 30 && !hasRehab) {
        const reason = `Building age ${age} years with no renovation at ${bldg.address.street} (Loc ${loc.location_number})`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'sov');
      }

      // Plumbing / wiring age (northern states)
      const northernStates = ['MN', 'WI', 'MI', 'ND', 'SD', 'IA', 'IL', 'IN', 'OH', 'PA', 'NY', 'MA', 'CT', 'VT', 'NH', 'ME', 'MT', 'WY', 'CO'];
      const state = bldg.address.state?.toUpperCase();
      if (state && northernStates.includes(state)) {
        if (bldg.plumbing_year != null && (currentYear - bldg.plumbing_year) > 30) {
          const reason = `Plumbing >30 years old in northern state ${state} at ${bldg.address.street} (Loc ${loc.location_number})`;
          declineReasons.push(reason);
          addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'sov');
        }
      }
      if (bldg.electrical_year != null && (currentYear - bldg.electrical_year) > 30) {
        const reason = `Electrical wiring >30 years at ${bldg.address.street} (Loc ${loc.location_number})`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'sov');
      }

      // Occupancy checks
      if (bldg.values.total_tiv === 0) {
        addFlag(
          flags,
          'REFERRAL',
          'Eligibility',
          `Building TIV is $0 at ${bldg.address.street} - possible vacant or data issue (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Large building checks
      if (bldg.values.total_tiv > 20_000_000) {
        const reason = `Single building TIV $${(bldg.values.total_tiv / 1_000_000).toFixed(1)}M exceeds $20M maximum at ${bldg.address.street}`;
        declineReasons.push(reason);
        addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'sov');
      } else if (bldg.values.total_tiv >= 10_000_000) {
        addFlag(
          flags,
          'REFERRAL',
          'Eligibility',
          `Single building TIV $${(bldg.values.total_tiv / 1_000_000).toFixed(1)}M ($10M-$20M range) at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Stories
      if (bldg.stories >= 6) {
        addFlag(
          flags,
          'REFERRAL',
          'Eligibility',
          `${bldg.stories}-story building at ${bldg.address.street} (high-rise referral ≥6 stories) (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Sprinkler checks
      if (!bldg.sprinkler_status && occupancy_type === 'student_housing') {
        addFlag(
          flags,
          'REFERRAL',
          'Life Safety',
          `Non-sprinklered student housing at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      if (!bldg.sprinkler_status && bldg.stories >= 6) {
        addFlag(
          flags,
          'REFERRAL',
          'Life Safety',
          `${bldg.stories} stories without full sprinkler system at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Frame >$5M non-sprinklered
      if (bldg.construction_type === 'FRAME' && !bldg.sprinkler_status && bldg.values.total_tiv >= 5_000_000) {
        addFlag(
          flags,
          'REFERRAL',
          'Eligibility',
          `Frame construction TIV $${(bldg.values.total_tiv / 1_000_000).toFixed(1)}M without sprinklers at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // HazardHub checks
      const haz = bldg.hazard_data;
      if (haz) {
        if (haz.wildfire_score === 'D' || haz.wildfire_score === 'F') {
          if (bldg.address.state?.toUpperCase() === 'CA' ||
              haz.wildfire_score === 'F') {
            const reason = `Wildfire score ${haz.wildfire_score} (ineligible) at ${bldg.address.street} (Loc ${loc.location_number})`;
            declineReasons.push(reason);
            addFlag(flags, 'DECLINE', 'CAT', reason, [loc.location_number], 'hazardhub');
          } else {
            addFlag(
              flags,
              'REFERRAL',
              'CAT',
              `Wildfire score ${haz.wildfire_score} (national) at ${bldg.address.street} (Loc ${loc.location_number})`,
              [loc.location_number],
              'hazardhub'
            );
          }
        }

        if (haz.crime_score === 'Extreme') {
          const reason = `Extreme crime score at ${bldg.address.street} (Loc ${loc.location_number})`;
          declineReasons.push(reason);
          addFlag(flags, 'DECLINE', 'CAT', reason, [loc.location_number], 'hazardhub');
        } else if (haz.crime_score === 'Very High') {
          addFlag(
            flags,
            'REFERRAL',
            'CAT',
            `Very High crime score at ${bldg.address.street} (Loc ${loc.location_number})`,
            [loc.location_number],
            'hazardhub'
          );
        }

        if (haz.hurricane_score === 'F') {
          const reason = `Hurricane score F (ineligible) at ${bldg.address.street} (Loc ${loc.location_number})`;
          declineReasons.push(reason);
          addFlag(flags, 'DECLINE', 'CAT', reason, [loc.location_number], 'hazardhub');
        } else if (haz.hurricane_score === 'D') {
          addFlag(
            flags,
            'REFERRAL',
            'CAT',
            `Hurricane score D at ${bldg.address.street} (Loc ${loc.location_number})`,
            [loc.location_number],
            'hazardhub'
          );
        }
      }

      // ITV check
      if (bldg.itv_per_sqft > 0 && bldg.itv_per_sqft < 150) {
        addFlag(
          flags,
          'REFERRAL',
          'Financial',
          `ITV $${bldg.itv_per_sqft.toFixed(0)}/sqft below $150 minimum at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'sov'
        );
      }

      // Google reviews
      if (bldg.reviews?.google_rating != null &&
          bldg.reviews.google_rating < 2.5 &&
          (bldg.reviews.review_count ?? 0) > 20) {
        addFlag(
          flags,
          'REFERRAL',
          'Operational',
          `Google rating ${bldg.reviews.google_rating} with ${bldg.reviews.review_count} reviews at ${bldg.address.street} (Loc ${loc.location_number})`,
          [loc.location_number],
          'google_reviews'
        );
      }
    }

    // Per-location TIV check
    if (loc.location_tiv > 100_000_000) {
      const reason = `Location ${loc.location_number} TIV $${(loc.location_tiv / 1_000_000).toFixed(0)}M exceeds $100M (portfolio exception required)`;
      declineReasons.push(reason);
      addFlag(flags, 'DECLINE', 'Eligibility', reason, [loc.location_number], 'sov');
    } else if (loc.location_tiv >= 25_000_000) {
      addFlag(
        flags,
        'REFERRAL',
        'Eligibility',
        `Location ${loc.location_number} TIV $${(loc.location_tiv / 1_000_000).toFixed(0)}M ($25M-$100M range)`,
        [loc.location_number],
        'sov'
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Loss history checks
  // ───────────────────────────────────────────────────────────────
  if (loss_history) {
    if (loss_history.paid_claims_over_50k >= 2) {
      addFlag(
        flags,
        'REFERRAL',
        'Claims',
        `${loss_history.paid_claims_over_50k} paid claims >$50K in 5 years (threshold: 2)`,
        [],
        'loss_runs'
      );
    }

    if (loss_history.incurred_loss_ratio_5yr > 0.35) {
      addFlag(
        flags,
        'REFERRAL',
        'Claims',
        `5-year incurred loss ratio ${(loss_history.incurred_loss_ratio_5yr * 100).toFixed(1)}% exceeds 35% threshold`,
        [],
        'loss_runs'
      );
    }

    if (loss_history.single_cat_loss_over_100k) {
      addFlag(
        flags,
        'REFERRAL',
        'Claims',
        'Single CAT loss >$100K identified in 5-year loss history',
        [],
        'loss_runs'
      );
    }

    if (loss_history.is_stale) {
      addFlag(
        flags,
        'REFERRAL',
        'Data Gap',
        `Loss runs are stale (>90 days old). Date: ${loss_history.loss_run_date ?? 'unknown'}`,
        [],
        'loss_runs'
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // DSCR check
  // ───────────────────────────────────────────────────────────────
  if (submission.dscr != null && submission.dscr < 1.00) {
    addFlag(
      flags,
      'REFERRAL',
      'Financial',
      `DSCR ${submission.dscr.toFixed(2)}x below 1.00x threshold (financial stress)`,
      [],
      'submission'
    );
  }

  return {
    flags,
    isIneligible: declineReasons.length > 0,
    declineReasons,
  };
}

export function generateDataGapFlags(submission: Submission): Flag[] {
  const flags: Flag[] = [];

  if (!submission.dscr) {
    flags.push({
      flag_type: 'INFO',
      category: 'Data Gap',
      description: 'DSCR not provided - defaulting to 1.00 factor. Request from broker.',
      locations_affected: [],
      source: 'system',
    });
  }

  for (const loc of submission.locations) {
    for (const bldg of loc.buildings) {
      if (!bldg.hazard_data?.protection_class && bldg.protection_class === 0) {
        flags.push({
          flag_type: 'INFO',
          category: 'Data Gap',
          description: `Protection class not available for ${bldg.address.street} (Loc ${loc.location_number}) - manual HazardHub lookup required`,
          locations_affected: [loc.location_number],
          source: 'system',
        });
      }
    }
  }

  return flags;
}
