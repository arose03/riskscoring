/**
 * Sends the underwriting result email back to the broker/submitter.
 * Attaches the 8-tab Excel workbook and includes a plain-text summary.
 */
import nodemailer from 'nodemailer';
import { Submission, Recommendation } from '../types/submission';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    throw new Error(
      'Missing SMTP configuration. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in environment.'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

const REC_LABELS: Record<Recommendation, string> = {
  BIND: '✅ BIND',
  CONDITIONAL_BIND: '⚠️ CONDITIONAL BIND',
  DECLINE: '❌ DECLINE',
};

function buildEmailBody(
  submission: Submission,
  strengths: string[],
  concerns: string[]
): string {
  const rec = submission.recommendation;
  const ps = submission.premium_summary;
  const ni = submission.named_insured;
  const pp = submission.policy_period;

  const referrals = submission.flags.filter((f) => f.flag_type === 'REFERRAL');
  const declines = submission.flags.filter((f) => f.flag_type === 'DECLINE');

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

  const lines: string[] = [
    `HABGEN LLC — AUTOMATED UNDERWRITING RESULT`,
    `${'='.repeat(55)}`,
    ``,
    `RECOMMENDATION: ${REC_LABELS[rec]}`,
    ``,
    `Named Insured:   ${ni.name}${ni.dba ? ` (dba ${ni.dba})` : ''}`,
    `Policy Period:   ${pp.effective_date ?? 'TBD'} to ${pp.expiration_date ?? 'TBD'}`,
    `Occupancy:       ${submission.occupancy_type === 'student_housing' ? 'Student Housing' : 'Conventional Multifamily'}`,
    `Locations:       ${submission.locations.length} location(s) / ${submission.locations.flatMap((l) => l.buildings).length} building(s)`,
    ``,
    `— PREMIUM SUMMARY —`,
    `Total TIV:       ${fmt(ps.total_tiv)}`,
    `Property Prem:   ${fmt(ps.total_property_premium)}`,
    `GL Premium:      ${fmt(ps.total_gl_premium)}`,
    `TOTAL PREMIUM:   ${fmt(ps.total_premium)}`,
    `Prop Rate:       $${ps.blended_property_rate.toFixed(4)} per $100 TIV`,
    `GL Rate:         $${ps.blended_gl_rate_per_unit.toFixed(2)} per unit`,
    ``,
  ];

  if (declines.length > 0) {
    lines.push(`— DECLINE TRIGGERS (${declines.length}) —`);
    declines.forEach((f) => lines.push(`  • ${f.description}`));
    lines.push('');
  }

  if (referrals.length > 0) {
    lines.push(`— REFERRAL ITEMS (${referrals.length}) —`);
    referrals.forEach((f) => lines.push(`  • ${f.description}`));
    lines.push('');
  }

  if (strengths.length > 0) {
    lines.push('— KEY STRENGTHS —');
    strengths.forEach((s) => lines.push(`  • ${s}`));
    lines.push('');
  }

  if (concerns.length > 0) {
    lines.push('— KEY CONCERNS —');
    concerns.forEach((c) => lines.push(`  • ${c}`));
    lines.push('');
  }

  if (submission.data_gaps.length > 0) {
    lines.push('— DATA GAPS / MISSING ITEMS —');
    submission.data_gaps.forEach((g) => lines.push(`  • ${g}`));
    lines.push('');
  }

  lines.push('The full 8-tab underwriting workbook is attached.');
  lines.push('');
  lines.push('— STANDARD TERMS (subject to review) —');
  lines.push('  Form:            Special Form (HG CP 00 10)');
  lines.push('  Valuation:       Replacement Cost');
  lines.push('  AOP Deductible:  $25,000');
  lines.push('  Wind/Hail Ded:   2% (up to 5% named storm)');
  lines.push('  Ordinance & Law: 25%');
  lines.push('  Business Income: 12 months / 72-hr waiting period');
  lines.push('  GL Each Occ:     $1,000,000');
  lines.push('  GL Aggregate:    $2,000,000 per location');
  lines.push('  GL SIR:          $0 (first-dollar)');
  lines.push('  A&B:             $100K/$200K with $10K deductible');
  lines.push('');
  lines.push('Note: This is an automated indicative analysis. Final terms subject to');
  lines.push('underwriter review and approval. OFAC check required prior to binding.');
  lines.push('');
  lines.push('HABGEN LLC | Specialty Habitational MGA');
  lines.push('Fronted by Accelerant Insurance (Incline Specialty Insurance Company)');

  return lines.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildSubjectLine(submission: Submission, _originalSubject: string): string {
  const rec = submission.recommendation.replace('_', ' ');
  const ni = submission.named_insured.name || 'Unknown Insured';
  const tiv = submission.premium_summary.total_tiv;
  const tivStr = tiv >= 1_000_000
    ? `$${(tiv / 1_000_000).toFixed(1)}M TIV`
    : `$${Math.round(tiv / 1000)}K TIV`;
  return `[HABGEN UW] ${rec} — ${ni} — ${tivStr}`;
}

export async function sendResultEmail(opts: {
  toAddress: string;
  toName: string;
  originalSubject?: string;
  submission: Submission;
  strengths: string[];
  concerns: string[];
  workbookBuffer: Buffer;
}): Promise<void> {
  const { toAddress, toName, submission, strengths, concerns, workbookBuffer } = opts;

  const transport = createTransport();
  const fromName = process.env.SMTP_FROM_NAME ?? 'HABGEN Underwriting';
  const fromAddress = process.env.SMTP_USER!;
  const ccAddress = process.env.SMTP_CC_ADDRESS;

  const namedInsured = submission.named_insured.name || 'Submission';
  const dateStr = new Date().toISOString().split('T')[0];
  const attachmentFilename = `HABGEN_UW_${namedInsured.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  const bodyText = buildEmailBody(submission, strengths, concerns);
  const subject = buildSubjectLine(submission, opts.originalSubject ?? '');

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: `"${toName}" <${toAddress}>`,
    cc: ccAddress || undefined,
    subject,
    text: bodyText,
    attachments: [
      {
        filename: attachmentFilename,
        content: workbookBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });
}

export function isConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}
