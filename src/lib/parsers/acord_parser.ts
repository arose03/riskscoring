import { callLLMJSON } from '../llm/client';
import { ACORD_125_EXTRACTOR_SYSTEM } from '../llm/prompts';
import { ParsedACORD125 } from '../types/submission';

export async function parseACORD125(text: string): Promise<ParsedACORD125> {
  try {
    const result = await callLLMJSON<ParsedACORD125>(
      ACORD_125_EXTRACTOR_SYSTEM,
      `Extract all fields from this ACORD 125 form:\n\n${text.substring(0, 8000)}`
    );
    return result;
  } catch (err) {
    console.error('ACORD 125 parse error:', err);
    return {};
  }
}

export function parseDate(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  // Try to parse common date formats
  const cleaned = dateStr.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD/YYYY
  const mmddyyyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, '0')}-${mmddyyyy[2].padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const mmddyyyy2 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mmddyyyy2) {
    return `${mmddyyyy2[3]}-${mmddyyyy2[1].padStart(2, '0')}-${mmddyyyy2[2].padStart(2, '0')}`;
  }

  return cleaned;
}

export function parseTermMonths(
  effectiveDate: string | undefined,
  expirationDate: string | undefined
): number | undefined {
  if (!effectiveDate || !expirationDate) return undefined;
  const eff = new Date(effectiveDate);
  const exp = new Date(expirationDate);
  if (isNaN(eff.getTime()) || isNaN(exp.getTime())) return undefined;
  const diffMs = exp.getTime() - eff.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return Math.round(diffMonths);
}
