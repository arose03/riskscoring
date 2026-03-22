/**
 * POST /api/email/check
 *
 * Checks the configured inbox for unseen submission emails,
 * processes each one through the underwriting pipeline,
 * and sends a reply with the workbook attached.
 *
 * Intended to be called by:
 *  - A cron job / scheduler (e.g. Vercel Cron, GitHub Actions, cron-job.org)
 *  - The manual "Check Now" button in the dashboard
 *
 * Protect with CRON_SECRET env var if called externally.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchUnseenEmails, isConfigured as imapConfigured } from '@/lib/email/imap_watcher';
import { parseEmailSubmission } from '@/lib/email/email_parser';
import { sendResultEmail, isConfigured as smtpConfigured } from '@/lib/email/email_sender';
import { runPipeline } from '@/lib/engine/pipeline';
import { generateWorkbook } from '@/lib/output/workbook_generator';
import { getDb } from '@/lib/db';

export const maxDuration = 300;

interface ProcessedResult {
  messageId: string;
  subject: string;
  from: string;
  recommendation?: string;
  namedInsured?: string;
  totalPremium?: number;
  totalTIV?: number;
  flagCount?: number;
  error?: string;
  processedAt: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Optional secret guard for external cron calls
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!imapConfigured()) {
    return NextResponse.json(
      { error: 'IMAP not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD.' },
      { status: 400 }
    );
  }

  if (!smtpConfigured()) {
    return NextResponse.json(
      { error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD.' },
      { status: 400 }
    );
  }

  const results: ProcessedResult[] = [];
  const processedAt = new Date().toISOString();

  try {
    const emails = await fetchUnseenEmails();

    if (emails.length === 0) {
      return NextResponse.json({ checked: true, new_emails: 0, results: [] });
    }

    for (const email of emails) {
      const result: ProcessedResult = {
        messageId: email.messageId,
        subject: email.subject,
        from: email.fromAddress,
        processedAt,
      };

      try {
        // Parse attachments
        const { parseResult, senderEmail, senderName, subject } =
          await parseEmailSubmission(email);

        // Run underwriting pipeline
        const { submission, strengths, concerns } = await runPipeline({ parseResult });

        // Generate workbook
        const workbookBuffer = await generateWorkbook(submission, strengths, concerns);

        // Send reply
        await sendResultEmail({
          toAddress: senderEmail,
          toName: senderName,
          originalSubject: subject,
          submission,
          strengths,
          concerns,
          workbookBuffer,
        });

        // Persist to DB for dashboard
        try {
          const db = getDb();
          db.prepare(`
            INSERT OR REPLACE INTO assessments (address, lat, lng, scores)
            VALUES (?, ?, ?, ?)
          `).run(
            `EMAIL:${email.messageId}`,
            0,
            0,
            JSON.stringify({
              submission_id: submission.submission_id,
              named_insured: submission.named_insured.name,
              recommendation: submission.recommendation,
              total_tiv: submission.premium_summary.total_tiv,
              total_premium: submission.premium_summary.total_premium,
              flags: submission.flags.length,
              from_email: senderEmail,
              subject,
              processed_at: processedAt,
            })
          );
        } catch {
          // DB persistence is non-critical
        }

        result.recommendation = submission.recommendation;
        result.namedInsured = submission.named_insured.name;
        result.totalPremium = submission.premium_summary.total_premium;
        result.totalTIV = submission.premium_summary.total_tiv;
        result.flagCount = submission.flags.length;

      } catch (err) {
        console.error(`Error processing email ${email.messageId}:`, err);
        result.error = String(err);
      }

      results.push(result);
    }

    return NextResponse.json({
      checked: true,
      new_emails: emails.length,
      processed: results.filter((r) => !r.error).length,
      errors: results.filter((r) => r.error).length,
      results,
    });

  } catch (err) {
    console.error('Email check error:', err);
    return NextResponse.json(
      { error: `Failed to check inbox: ${String(err)}` },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  // Quick config status check (no actual IMAP connection)
  return NextResponse.json({
    imap_configured: imapConfigured(),
    smtp_configured: smtpConfigured(),
    imap_host: process.env.IMAP_HOST ?? null,
    imap_user: process.env.IMAP_USER ?? null,
    smtp_host: process.env.SMTP_HOST ?? null,
    smtp_user: process.env.SMTP_USER ?? null,
    mailbox: process.env.IMAP_MAILBOX ?? 'INBOX',
  });
}
