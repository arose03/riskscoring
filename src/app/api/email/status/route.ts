/**
 * GET /api/email/status
 * Returns recent processed submissions from the DB for dashboard display.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface ProcessedSubmission {
  id: number;
  submission_id: string;
  named_insured: string;
  recommendation: string;
  total_tiv: number;
  total_premium: number;
  flags: number;
  from_email: string;
  subject: string;
  processed_at: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT id, address, scores
      FROM assessments
      WHERE address LIKE 'EMAIL:%'
      ORDER BY id DESC
      LIMIT 50
    `).all() as { id: number; address: string; scores: string }[];

    const submissions: ProcessedSubmission[] = rows.map((row) => {
      try {
        const data = JSON.parse(row.scores);
        return {
          id: row.id,
          submission_id: data.submission_id ?? '',
          named_insured: data.named_insured ?? 'Unknown',
          recommendation: data.recommendation ?? 'UNKNOWN',
          total_tiv: data.total_tiv ?? 0,
          total_premium: data.total_premium ?? 0,
          flags: data.flags ?? 0,
          from_email: data.from_email ?? '',
          subject: data.subject ?? '',
          processed_at: data.processed_at ?? '',
        };
      } catch {
        return {
          id: row.id,
          submission_id: '',
          named_insured: row.address.replace('EMAIL:', ''),
          recommendation: 'ERROR',
          total_tiv: 0,
          total_premium: 0,
          flags: 0,
          from_email: '',
          subject: '',
          processed_at: '',
        };
      }
    });

    return NextResponse.json({ submissions });
  } catch (err) {
    return NextResponse.json({ submissions: [], error: String(err) });
  }
}
