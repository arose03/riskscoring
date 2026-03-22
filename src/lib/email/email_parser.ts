/**
 * Converts raw email attachments into the format expected by the parsing pipeline.
 * Maps email attachments → File-like objects for the document parsers.
 */
import { RawEmail, EmailAttachment } from './imap_watcher';
import { classifyDocument } from '../parsers/document_classifier';
import { parseACORD125 } from '../parsers/acord_parser';
import { parseSOVFromCSV, parseSOVFromRows, normalizeSOVBuildings } from '../parsers/sov_parser';
import { parseLossRuns } from '../parsers/loss_run_parser';
import { DocumentParseResult } from '../types/submission';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

function getExtension(attachment: EmailAttachment): string {
  const filename = attachment.filename.toLowerCase();
  if (filename.includes('.')) {
    return filename.split('.').pop() ?? '';
  }
  // Infer from MIME type
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/csv': 'csv',
    'application/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
  };
  return mimeMap[attachment.contentType] ?? '';
}

async function extractTextFromBuffer(buffer: Buffer, ext: string): Promise<string> {
  if (ext === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return (data.text as string) ?? '';
    } catch {
      return '';
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const lines: string[] = [];
      wb.eachSheet((ws: { eachRow: (fn: (row: { eachCell: (fn: (cell: { value: unknown }) => void) => void }) => void) => void }) => {
        ws.eachRow((row) => {
          const vals: string[] = [];
          row.eachCell((cell) => {
            vals.push(String(cell.value ?? ''));
          });
          lines.push(vals.join(','));
        });
      });
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  if (ext === 'csv') {
    return buffer.toString('utf-8');
  }

  if (ext === 'docx') {
    return buffer.toString('utf-8');
  }

  return '';
}

export interface ParsedEmail {
  parseResult: DocumentParseResult;
  senderEmail: string;
  senderName: string;
  subject: string;
  receivedAt: Date;
}

export async function parseEmailSubmission(email: RawEmail): Promise<ParsedEmail> {
  const parseResult: DocumentParseResult = {
    parse_errors: [],
    document_types_found: [],
  };

  // Include email body text as additional context
  const bodyContext = email.bodyText ?? '';

  // Try to extract university from subject or body
  const universityMatch = bodyContext.match(/university[:\s]+([^\n,]+)/i)
    ?? email.subject.match(/([A-Z][a-z]+ University|University of [A-Z][a-z]+)/);
  if (universityMatch) {
    parseResult.gl_supplemental = {
      university_name: universityMatch[1]?.trim(),
    };
  }

  // Process each attachment
  for (const attachment of email.attachments) {
    const isSupportedMime = SUPPORTED_MIME_TYPES.has(attachment.contentType);
    const ext = getExtension(attachment);

    if (!isSupportedMime && !ext) {
      parseResult.parse_errors.push(`Skipped unsupported file: ${attachment.filename}`);
      continue;
    }

    const textContent = await extractTextFromBuffer(attachment.content, ext);

    if (!textContent && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') {
      parseResult.parse_errors.push(`Could not extract text from ${attachment.filename}`);
      continue;
    }

    // Classify document
    const classification = await classifyDocument(attachment.filename, textContent.substring(0, 500));
    const docType = classification.doc_type;

    if (!parseResult.document_types_found.includes(docType)) {
      parseResult.document_types_found.push(docType);
    }

    // Parse based on type
    switch (docType) {
      case 'ACORD_125': {
        const acord = await parseACORD125(textContent);
        parseResult.acord_125 = parseResult.acord_125
          ? { ...acord, ...parseResult.acord_125 }
          : acord;
        break;
      }

      case 'SOV': {
        let sovBuildings = parseResult.sov_buildings ?? [];

        if (ext === 'xlsx' || ext === 'xls') {
          // Re-parse Excel properly for SOV
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const ExcelJS = require('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(attachment.content);
            const headers: string[] = [];
            const rows: Record<string, string | number | null>[] = [];
            let headerRowNum = 1;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wb.eachSheet((ws: any) => {
              if (headers.length > 0) return;
              if (!ws.actualRowCount || ws.actualRowCount < 2) return;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ws.eachRow((row: any, rowNumber: number) => {
                if (headers.length > 0) return;
                const firstCell = row.getCell(1).value;
                if (firstCell != null && String(firstCell).trim() !== '') {
                  headerRowNum = rowNumber;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  row.eachCell((cell: any) => {
                    headers.push(String(cell.value ?? '').trim());
                  });
                }
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ws.eachRow((row: any, rowNumber: number) => {
                if (rowNumber <= headerRowNum) return;
                const rowObj: Record<string, string | number | null> = {};
                let hasData = false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                row.eachCell((cell: any, colNumber: number) => {
                  const header = headers[colNumber - 1];
                  if (header) {
                    const val = cell.value;
                    if (val instanceof Date) {
                      rowObj[header] = val.getFullYear();
                    } else {
                      rowObj[header] = val as string | number | null;
                    }
                    if (val != null) hasData = true;
                  }
                });
                if (hasData) rows.push(rowObj);
              });
            });

            if (headers.length > 0) {
              const extracted = await parseSOVFromRows(headers, rows);
              sovBuildings = [...sovBuildings, ...extracted];
            }
          } catch (err) {
            parseResult.parse_errors.push(`Excel SOV parse error: ${err}`);
          }
        } else if (ext === 'csv') {
          const extracted = await parseSOVFromCSV(attachment.content.toString('utf-8'));
          sovBuildings = [...sovBuildings, ...extracted];
        } else {
          const extracted = await parseSOVFromCSV(textContent);
          sovBuildings = [...sovBuildings, ...extracted];
        }

        parseResult.sov_buildings = await normalizeSOVBuildings(sovBuildings);
        break;
      }

      case 'LOSS_RUNS': {
        const { claims, loss_run_date } = await parseLossRuns(textContent);
        parseResult.claims = [...(parseResult.claims ?? []), ...claims];
        if (loss_run_date && !parseResult.loss_run_date) {
          parseResult.loss_run_date = loss_run_date;
        }
        break;
      }

      case 'GL_SUPPLEMENTAL': {
        const uniMatch = textContent.match(/university[:\s]+([^\n,]+)/i);
        if (!parseResult.gl_supplemental?.university_name) {
          parseResult.gl_supplemental = {
            university_name: uniMatch?.[1]?.trim(),
          };
        }
        break;
      }

      case 'PHOTOS':
        break;

      default:
        parseResult.parse_errors.push(
          `${attachment.filename} → ${docType} (confidence: ${classification.confidence.toFixed(2)})`
        );
    }
  }

  if (!parseResult.sov_buildings || parseResult.sov_buildings.length === 0) {
    parseResult.parse_errors.push('No SOV found in attachments');
  }

  return {
    parseResult,
    senderEmail: email.fromAddress,
    senderName: email.fromName,
    subject: email.subject,
    receivedAt: email.receivedAt,
  };
}
