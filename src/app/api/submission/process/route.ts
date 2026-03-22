import { NextRequest, NextResponse } from 'next/server';
import { classifyDocument } from '@/lib/parsers/document_classifier';
import { parseACORD125 } from '@/lib/parsers/acord_parser';
import { parseSOVFromCSV, parseSOVFromRows, normalizeSOVBuildings } from '@/lib/parsers/sov_parser';
import { parseLossRuns } from '@/lib/parsers/loss_run_parser';
import { runPipeline } from '@/lib/engine/pipeline';
import { generateWorkbook } from '@/lib/output/workbook_generator';
import { DocumentParseResult, OccupancyType } from '@/lib/types/submission';

export const maxDuration = 300; // 5 minute timeout for LLM calls

// Parse PDF text via pdf-parse (server-side only)
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return (data.text as string) ?? '';
  } catch (err) {
    console.error('PDF parse error:', err);
    return '';
  }
}

interface ExcelRow {
  [key: string]: string | number | null;
}

// Parse Excel file and return rows + headers
async function extractExcelRows(buffer: Buffer): Promise<{ headers: string[]; rows: ExcelRow[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const headers: string[] = [];
    const rows: ExcelRow[] = [];
    let headerRowNum = 1;

    wb.eachSheet((ws: {
      actualRowCount: number;
      eachRow: (fn: (row: { getCell: (n: number) => { value: unknown }; eachCell: (fn: (cell: { value: unknown }, colNumber: number) => void) => void }, rowNumber: number) => void) => void;
    }) => {
      if (headers.length > 0) return;
      if (!ws.actualRowCount || ws.actualRowCount < 2) return;

      // Find header row (first non-empty row)
      ws.eachRow((row, rowNumber) => {
        if (headers.length > 0) return;
        const firstCell = row.getCell(1).value;
        if (firstCell != null && String(firstCell).trim() !== '') {
          headerRowNum = rowNumber;
          row.eachCell((cell) => {
            headers.push(String(cell.value ?? '').trim());
          });
        }
      });

      ws.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNum) return;
        const rowObj: ExcelRow = {};
        let hasData = false;
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            const val = cell.value;
            if (val instanceof Date) {
              rowObj[header] = val.getFullYear();
            } else if (typeof val === 'object' && val !== null && 'result' in (val as object)) {
              rowObj[header] = (val as { result: number }).result;
            } else {
              rowObj[header] = val as string | number | null;
            }
            if (val != null) hasData = true;
          }
        });
        if (hasData) rows.push(rowObj);
      });
    });

    return { headers, rows };
  } catch (err) {
    console.error('Excel parse error:', err);
    return { headers: [], rows: [] };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    const parseResult: DocumentParseResult = {
      parse_errors: [],
      document_types_found: [],
    };

    let occupancyType: OccupancyType | undefined;
    const overrideDSCR = formData.get('dscr');
    const overrideOperator = formData.get('operatorName');
    const overrideOccupancy = formData.get('occupancyType') as OccupancyType | null;
    if (overrideOccupancy) occupancyType = overrideOccupancy;

    // Process each uploaded file
    const files = formData.getAll('files') as File[];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = file.name;
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';

      let textContent = '';

      // Extract text based on file type
      if (ext === 'pdf') {
        textContent = await extractPDFText(buffer);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const { headers, rows } = await extractExcelRows(buffer);
        textContent = [headers.join(','), ...rows.map((r) => Object.values(r).join(','))].join('\n');
      } else if (ext === 'csv') {
        textContent = buffer.toString('utf-8');
      } else if (ext === 'docx') {
        textContent = buffer.toString('utf-8');
      }

      if (!textContent && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') {
        parseResult.parse_errors.push(`Could not extract text from ${filename}`);
        continue;
      }

      // Classify document
      const classification = await classifyDocument(filename, textContent.substring(0, 500));
      const docType = classification.doc_type;

      if (!parseResult.document_types_found.includes(docType)) {
        parseResult.document_types_found.push(docType);
      }

      // Parse based on document type
      switch (docType) {
        case 'ACORD_125': {
          const acord = await parseACORD125(textContent);
          if (!parseResult.acord_125) {
            parseResult.acord_125 = acord;
          } else {
            parseResult.acord_125 = { ...acord, ...parseResult.acord_125 };
          }
          break;
        }

        case 'SOV': {
          let sovBuildings = parseResult.sov_buildings ?? [];

          if (ext === 'xlsx' || ext === 'xls') {
            const { headers, rows } = await extractExcelRows(buffer);
            if (headers.length > 0) {
              const extracted = await parseSOVFromRows(headers, rows);
              sovBuildings = [...sovBuildings, ...extracted];
            }
          } else if (ext === 'csv') {
            const csvText = buffer.toString('utf-8');
            const extracted = await parseSOVFromCSV(csvText);
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
          parseResult.gl_supplemental = {
            university_name: extractField(textContent, 'university') ??
              extractField(textContent, 'school'),
          };
          break;
        }

        case 'PHOTOS':
          break;

        default:
          parseResult.parse_errors.push(
            `Document ${filename} classified as ${docType} (confidence: ${classification.confidence.toFixed(2)})`
          );
      }
    }

    if (!parseResult.sov_buildings || parseResult.sov_buildings.length === 0) {
      parseResult.parse_errors.push('No SOV data found - please upload a Statement of Values');
    }

    // Run pipeline
    const { submission, strengths, concerns } = await runPipeline({
      parseResult,
      occupancyType,
      manualOverrides: {
        dscr: overrideDSCR ? parseFloat(String(overrideDSCR)) : undefined,
        operatorName: overrideOperator ? String(overrideOperator) : undefined,
      },
    });

    // Generate workbook
    const workbookBuffer = await generateWorkbook(submission, strengths, concerns);

    return NextResponse.json({
      success: true,
      submission_id: submission.submission_id,
      recommendation: submission.recommendation,
      named_insured: submission.named_insured.name,
      occupancy_type: submission.occupancy_type,
      total_tiv: submission.premium_summary.total_tiv,
      total_premium: submission.premium_summary.total_premium,
      blended_property_rate: submission.premium_summary.blended_property_rate,
      locations_count: submission.locations.length,
      buildings_count: submission.locations.flatMap((l) => l.buildings).length,
      flags: submission.flags.length,
      decline_flags: submission.flags.filter((f) => f.flag_type === 'DECLINE').length,
      referral_flags: submission.flags.filter((f) => f.flag_type === 'REFERRAL').length,
      data_gaps: submission.data_gaps,
      strengths,
      concerns,
      workbook_base64: workbookBuffer.toString('base64'),
      document_types_found: parseResult.document_types_found,
      parse_errors: parseResult.parse_errors,
    });

  } catch (err) {
    console.error('Submission processing error:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

function extractField(text: string, keyword: string): string | undefined {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(keyword)) {
      const colonMatch = line.match(/:\s*(.+)/);
      if (colonMatch) return colonMatch[1].trim();
    }
  }
  return undefined;
}
