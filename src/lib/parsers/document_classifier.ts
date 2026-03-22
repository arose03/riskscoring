import { callLLMJSON } from '../llm/client';
import { DOCUMENT_CLASSIFIER_SYSTEM } from '../llm/prompts';

export type DocumentType =
  | 'ACORD_125'
  | 'ACORD_140'
  | 'SOV'
  | 'LOSS_RUNS'
  | 'GL_SUPPLEMENTAL'
  | 'RENT_ROLL'
  | 'INSPECTION_REPORT'
  | 'PRIOR_DEC'
  | 'PHOTOS'
  | 'UNKNOWN';

export interface ClassificationResult {
  doc_type: DocumentType;
  confidence: number;
  notes: string;
}

// Heuristic filename-based classification (fast, no LLM needed)
export function classifyByFilename(filename: string): DocumentType | null {
  const lower = filename.toLowerCase();

  if (lower.includes('acord') && (lower.includes('125') || lower.includes('application'))) {
    return 'ACORD_125';
  }
  if (lower.includes('acord') && lower.includes('140')) {
    return 'ACORD_140';
  }
  if (
    lower.includes('sov') ||
    lower.includes('statement of values') ||
    lower.includes('schedule of values') ||
    lower.includes('building schedule')
  ) {
    return 'SOV';
  }
  if (
    lower.includes('loss run') ||
    lower.includes('loss_run') ||
    lower.includes('lossrun') ||
    lower.includes('claims') ||
    lower.includes('claim history')
  ) {
    return 'LOSS_RUNS';
  }
  if (
    lower.includes('supplemental') ||
    lower.includes('gl app') ||
    lower.includes('habgen')
  ) {
    return 'GL_SUPPLEMENTAL';
  }
  if (lower.includes('rent roll') || lower.includes('rentroll') || lower.includes('operating statement')) {
    return 'RENT_ROLL';
  }
  if (lower.includes('inspection') || lower.includes('property report')) {
    return 'INSPECTION_REPORT';
  }
  if (lower.includes('dec page') || lower.includes('declarations') || lower.includes('prior policy')) {
    return 'PRIOR_DEC';
  }
  if (lower.match(/\.(jpg|jpeg|png|gif|tiff|bmp|webp)$/)) {
    return 'PHOTOS';
  }

  return null;
}

// LLM-based classification using first page text
export async function classifyDocument(
  filename: string,
  firstPageText: string
): Promise<ClassificationResult> {
  // Try filename heuristic first
  const heuristic = classifyByFilename(filename);
  if (heuristic) {
    return {
      doc_type: heuristic,
      confidence: 0.85,
      notes: `Classified by filename: ${filename}`,
    };
  }

  // Fall back to LLM
  const userMessage = `Filename: ${filename}\n\nFirst page content:\n${firstPageText.substring(0, 2000)}`;

  try {
    const result = await callLLMJSON<ClassificationResult>(
      DOCUMENT_CLASSIFIER_SYSTEM,
      userMessage
    );
    return result;
  } catch {
    return {
      doc_type: 'UNKNOWN',
      confidence: 0.0,
      notes: 'Classification failed',
    };
  }
}
