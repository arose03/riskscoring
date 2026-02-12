const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createRiskScorerWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HABGEN Risk Scorer';
  wb.created = new Date();

  // ============================================================
  // COLOR PALETTE
  // ============================================================
  const DARK_NAVY = 'FF1B2A4A';
  const MED_NAVY = 'FF2C3E6B';
  const LIGHT_BLUE = 'FFE8EDF5';
  const WHITE = 'FFFFFFFF';
  const GOLD = 'FFD4A843';
  const GREEN = 'FF27AE60';
  const YELLOW = 'FFF39C12';
  const RED = 'FFE74C3C';
  const LIGHT_GREEN = 'FFEAFAF1';
  const LIGHT_YELLOW = 'FFFEF9E7';
  const LIGHT_RED = 'FFFDECEA';
  const GRAY_BG = 'FFF8F9FA';
  const BORDER_GRAY = 'FFD5D8DC';

  const thinBorder = {
    top: { style: 'thin', color: { argb: BORDER_GRAY } },
    bottom: { style: 'thin', color: { argb: BORDER_GRAY } },
    left: { style: 'thin', color: { argb: BORDER_GRAY } },
    right: { style: 'thin', color: { argb: BORDER_GRAY } },
  };

  const headerFont = { bold: true, color: { argb: WHITE }, size: 11, name: 'Calibri' };
  const titleFont = { bold: true, color: { argb: WHITE }, size: 14, name: 'Calibri' };
  const labelFont = { bold: true, size: 10, name: 'Calibri' };
  const dataFont = { size: 10, name: 'Calibri' };
  const scoreInputFont = { bold: true, size: 12, name: 'Calibri', color: { argb: DARK_NAVY } };

  // ============================================================
  // SHEET: PROPERTY INFO (input sheet)
  // ============================================================
  const infoSheet = wb.addWorksheet('Property Info', {
    properties: { tabColor: { argb: '1B2A4A' } }
  });

  infoSheet.columns = [
    { width: 3 },   // A - spacer
    { width: 28 },  // B - labels
    { width: 35 },  // C - values
    { width: 5 },   // D - spacer
    { width: 28 },  // E - labels
    { width: 35 },  // F - values
  ];

  // Title bar
  infoSheet.mergeCells('A1:F1');
  const titleCell = infoSheet.getCell('A1');
  titleCell.value = 'HABGEN RISK SCORER — Property Information';
  titleCell.font = titleFont;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  infoSheet.getRow(1).height = 36;

  // Subtitle
  infoSheet.mergeCells('A2:F2');
  const subCell = infoSheet.getCell('A2');
  subCell.value = 'Enter property details below. These feed into the scoring sheets automatically.';
  subCell.font = { italic: true, size: 10, color: { argb: '666666' }, name: 'Calibri' };
  subCell.alignment = { horizontal: 'center' };
  infoSheet.getRow(2).height = 22;

  const infoFields = [
    // Left column
    [4, 'B', 'C', 'Property Address', '', 'text'],
    [5, 'B', 'C', 'University Name', '', 'text'],
    [6, 'B', 'C', 'University Tier (1/2/3)', '', 'number'],
    [7, 'B', 'C', 'University Party Score', '', 'number'],
    [8, 'B', 'C', 'Distance to Campus (mi)', '', 'number'],
    [9, 'B', 'C', 'Total Insured Value ($)', '', 'currency'],
    [10, 'B', 'C', 'Number of Units', '', 'number'],
    [11, 'B', 'C', 'Year Built', '', 'number'],
    // Right column
    [4, 'E', 'F', 'Stories', '', 'number'],
    [5, 'E', 'F', 'Construction (FR/NC/JM/FRAME)', '', 'text'],
    [6, 'E', 'F', 'Sprinkler (Y/N)', '', 'text'],
    [7, 'E', 'F', 'Occupancy Type', '', 'text'],
    [8, 'E', 'F', 'Sponsor Tier (A/B/C)', '', 'text'],
    [9, 'E', 'F', 'DSCR', '', 'number'],
    [10, 'E', 'F', 'Actual Rent ($/bed/mo)', '', 'currency'],
    [11, 'E', 'F', 'Est. Market Rent ($/bed/mo)', '', 'currency'],
  ];

  // Section header
  infoSheet.mergeCells('B3:C3');
  const lhdr = infoSheet.getCell('B3');
  lhdr.value = 'PROPERTY & LOCATION';
  lhdr.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
  lhdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
  infoSheet.mergeCells('E3:F3');
  const rhdr = infoSheet.getCell('E3');
  rhdr.value = 'BUILDING & FINANCIAL';
  rhdr.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
  rhdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
  infoSheet.getRow(3).height = 24;

  for (const [row, lcol, vcol, label, defVal, type] of infoFields) {
    const lc = infoSheet.getCell(`${lcol}${row}`);
    lc.value = label;
    lc.font = labelFont;
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    lc.border = thinBorder;

    const vc = infoSheet.getCell(`${vcol}${row}`);
    vc.value = defVal || null;
    vc.font = scoreInputFont;
    vc.border = thinBorder;
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
    if (type === 'currency') vc.numFmt = '$#,##0';
    if (type === 'number') vc.numFmt = '#,##0.00';

    // Light yellow fill to indicate input cells
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  }

  // Auto-calc row: Rent Ratio
  const row13 = 13;
  infoSheet.mergeCells(`B${row13}:C${row13}`);
  const rrLabel = infoSheet.getCell(`B${row13}`);
  rrLabel.value = 'CALCULATED VALUES';
  rrLabel.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
  rrLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
  infoSheet.mergeCells(`E${row13}:F${row13}`);
  const rrLabel2 = infoSheet.getCell(`E${row13}`);
  rrLabel2.value = '';
  rrLabel2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
  infoSheet.getRow(row13).height = 24;

  // Rent Ratio
  const rr = 14;
  infoSheet.getCell(`B${rr}`).value = 'Rent vs Market Ratio';
  infoSheet.getCell(`B${rr}`).font = labelFont;
  infoSheet.getCell(`B${rr}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  infoSheet.getCell(`B${rr}`).border = thinBorder;
  infoSheet.getCell(`C${rr}`).value = { formula: 'IF(AND(F10>0,F11>0),F10/F11,"Enter rents above")' };
  infoSheet.getCell(`C${rr}`).numFmt = '0.0%';
  infoSheet.getCell(`C${rr}`).font = { bold: true, size: 11, name: 'Calibri', color: { argb: DARK_NAVY } };
  infoSheet.getCell(`C${rr}`).border = thinBorder;

  // University Tier Score
  infoSheet.getCell(`E${rr}`).value = 'Univ. Tier Risk Score (auto)';
  infoSheet.getCell(`E${rr}`).font = labelFont;
  infoSheet.getCell(`E${rr}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  infoSheet.getCell(`E${rr}`).border = thinBorder;
  // universityTierToScore formula
  infoSheet.getCell(`F${rr}`).value = { formula: 'IF(C6="","",IF(C6=3,IF(C7>=8,5,4),IF(C6=2,IF(C7>=7,3,2),1)))' };
  infoSheet.getCell(`F${rr}`).font = scoreInputFont;
  infoSheet.getCell(`F${rr}`).border = thinBorder;

  // Distance Score
  const dr = 15;
  infoSheet.getCell(`B${dr}`).value = 'Distance Risk Score (auto)';
  infoSheet.getCell(`B${dr}`).font = labelFont;
  infoSheet.getCell(`B${dr}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  infoSheet.getCell(`B${dr}`).border = thinBorder;
  infoSheet.getCell(`C${dr}`).value = { formula: 'IF(C8="","",IF(C8<0.25,1,IF(C8<=0.5,2,IF(C8<=1,3,IF(C8<=2,4,5)))))' };
  infoSheet.getCell(`C${dr}`).font = scoreInputFont;
  infoSheet.getCell(`C${dr}`).border = thinBorder;

  // Rent vs Market Score
  infoSheet.getCell(`E${dr}`).value = 'Rent vs Market Score (auto)';
  infoSheet.getCell(`E${dr}`).font = labelFont;
  infoSheet.getCell(`E${dr}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  infoSheet.getCell(`E${dr}`).border = thinBorder;
  infoSheet.getCell(`F${dr}`).value = { formula: 'IF(C14="Enter rents above",3,IF(C14>1.2,1,IF(C14>=1.1,2,IF(C14>=1,3,IF(C14>=0.9,4,5)))))' };
  infoSheet.getCell(`F${dr}`).font = scoreInputFont;
  infoSheet.getCell(`F${dr}`).border = thinBorder;

  // ============================================================
  // SHEET: PROPERTY SCORING
  // ============================================================
  const propSheet = wb.addWorksheet('Property Scoring', {
    properties: { tabColor: { argb: '27AE60' } }
  });

  propSheet.columns = [
    { width: 3 },   // A
    { width: 5 },   // B - #
    { width: 28 },  // C - Factor
    { width: 12 },  // D - Score (1-5)
    { width: 10 },  // E - Weight
    { width: 14 },  // F - Weighted
    { width: 3 },   // G - spacer
    { width: 60 },  // H - Score Guide
  ];

  // Title
  propSheet.mergeCells('A1:H1');
  const ptitle = propSheet.getCell('A1');
  ptitle.value = 'PROPERTY RISK SCORING';
  ptitle.font = titleFont;
  ptitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  ptitle.alignment = { horizontal: 'center', vertical: 'middle' };
  propSheet.getRow(1).height = 36;

  // Headers
  const propHeaders = ['', '#', 'Factor', 'Score (1-5)', 'Weight', 'Weighted Score', '', 'Score Guide (1=Best, 5=Worst)'];
  const hrow = propSheet.getRow(3);
  propHeaders.forEach((h, i) => {
    const c = hrow.getCell(i + 1);
    c.value = h;
    c.font = headerFont;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder;
  });
  propSheet.getRow(3).height = 26;

  const propFactors = [
    { num: 1, key: 'construction', name: 'Construction Quality', weight: 0.12, auto: false,
      guide: '1=FR steel/concrete | 2=Non-Combustible | 3=Joisted Masonry | 4=Frame <15yr | 5=Frame >15yr' },
    { num: 2, key: 'building_age', name: 'Building Age / Condition', weight: 0.10, auto: false,
      guide: '1=<5yr new | 2=5-15yr modern | 3=15-25yr aging | 4=25-40yr deferred maint | 5=>40yr high risk' },
    { num: 3, key: 'height', name: 'Height / Stories', weight: 0.05, auto: false,
      guide: '1=1-2 stories | 2=3-4 stories | 3=5-7 stories | 4=8-12 stories | 5=>12 stories' },
    { num: 4, key: 'sprinkler', name: 'Sprinkler / Fire Protection', weight: 0.08, auto: false,
      guide: '1=Full NFPA 13+alarm | 2=Full sprinkler, limited | 3=Partial/13R | 4=FE only | 5=None' },
    { num: 5, key: 'university_tier', name: 'University Risk Tier', weight: 0.10, auto: true,
      guide: '1=Tier1 | 2=Tier2 (party<7) | 3=Tier2 (party>=7) | 4=Tier3 (party<8) | 5=Tier3 (party>=8)' },
    { num: 6, key: 'occupancy', name: 'Occupancy Type', weight: 0.07, auto: false,
      guide: '1=Senior/LIHTC | 2=Workforce | 3=Graduate | 4=Undergraduate | 5=Greek/Party' },
    { num: 7, key: 'crime', name: 'Crime Score', weight: 0.06, auto: false,
      guide: '1=Very Low (<20 idx) | 2=Low (20-35) | 3=Medium (35-50) | 4=High (50-70) | 5=Very High (>70)' },
    { num: 8, key: 'sponsor', name: 'Sponsor / Mgmt Tier', weight: 0.10, auto: false,
      guide: '1=Top Inst (>$1B) | 2=Strong Regional (>$200M) | 3=Adequate | 4=Thin/Emerging | 5=New/Poor' },
    { num: 9, key: 'dscr', name: 'DSCR Strength', weight: 0.07, auto: false,
      guide: '1=>=1.60x | 2=1.40-1.59x | 3=1.25-1.39x | 4=1.10-1.24x | 5=<1.10x' },
    { num: 10, key: 'distance', name: 'Distance from Campus', weight: 0.08, auto: true,
      guide: '1=<0.25mi | 2=0.25-0.5mi | 3=0.5-1.0mi | 4=1.0-2.0mi | 5=>2.0mi' },
    { num: 11, key: 'rent_vs_market', name: 'Rent vs. Market', weight: 0.07, auto: true,
      guide: '1=>120% | 2=110-120% | 3=100-110% | 4=90-100% | 5=<90%' },
    { num: 12, key: 'work_orders', name: 'Work Order / Maintenance', weight: 0.05, auto: false,
      guide: '1=Excellent | 2=Good | 3=Average | 4=Below Average | 5=Poor' },
    { num: 13, key: 'loss_history', name: 'Loss History', weight: 0.05, auto: false,
      guide: '1=No losses 3+yr | 2=Minor (LR<40%) | 3=Moderate (40-60%) | 4=Significant (60-80%) | 5=Severe (>80%)' },
  ];

  propFactors.forEach((f, idx) => {
    const r = idx + 4; // start at row 4
    const row = propSheet.getRow(r);
    const bgColor = idx % 2 === 0 ? WHITE : GRAY_BG;

    // Num
    row.getCell(2).value = f.num;
    row.getCell(2).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(2).alignment = { horizontal: 'center' };

    // Factor name
    row.getCell(3).value = f.name;
    row.getCell(3).font = labelFont;

    // Score input - auto-linked or manual
    const scoreCell = row.getCell(4);
    if (f.key === 'university_tier') {
      scoreCell.value = { formula: "'Property Info'!F14" };
    } else if (f.key === 'distance') {
      scoreCell.value = { formula: "'Property Info'!C15" };
    } else if (f.key === 'rent_vs_market') {
      scoreCell.value = { formula: "'Property Info'!F15" };
    } else {
      scoreCell.value = null; // user input
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
    }
    scoreCell.font = scoreInputFont;
    scoreCell.alignment = { horizontal: 'center' };
    scoreCell.border = {
      top: { style: 'medium', color: { argb: DARK_NAVY } },
      bottom: { style: 'medium', color: { argb: DARK_NAVY } },
      left: { style: 'medium', color: { argb: DARK_NAVY } },
      right: { style: 'medium', color: { argb: DARK_NAVY } },
    };

    // Weight
    row.getCell(5).value = f.weight;
    row.getCell(5).numFmt = '0%';
    row.getCell(5).font = dataFont;
    row.getCell(5).alignment = { horizontal: 'center' };

    // Weighted score
    row.getCell(6).value = { formula: `IF(D${r}="","",D${r}*E${r})` };
    row.getCell(6).numFmt = '0.00';
    row.getCell(6).font = dataFont;
    row.getCell(6).alignment = { horizontal: 'center' };

    // Guide
    row.getCell(8).value = (f.auto ? '[AUTO] ' : '') + f.guide;
    row.getCell(8).font = { size: 9, name: 'Calibri', color: { argb: '555555' } };

    // Apply alternating bg
    for (let col = 1; col <= 8; col++) {
      const cell = row.getCell(col);
      if (!cell.fill || (cell.fill.fgColor && cell.fill.fgColor.argb !== 'FFFFF8E1')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
      if (col !== 4) cell.border = thinBorder;
    }
    row.height = 24;
  });

  // Data validation for manual score inputs
  for (let r = 4; r <= 16; r++) {
    const factor = propFactors[r - 4];
    if (factor && !factor.auto) {
      propSheet.getCell(`D${r}`).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 5],
        showErrorMessage: true,
        errorTitle: 'Invalid Score',
        error: 'Score must be between 1 and 5',
        showInputMessage: true,
        promptTitle: 'Enter Score',
        prompt: 'Enter a score from 1 (best) to 5 (worst)',
      };
    }
  }

  // Totals section
  const totRow = 18;
  propSheet.mergeCells(`B${totRow}:C${totRow}`);
  const totLabel = propSheet.getCell(`B${totRow}`);
  totLabel.value = 'TOTAL WEIGHTED SCORE';
  totLabel.font = { bold: true, size: 12, color: { argb: WHITE }, name: 'Calibri' };
  totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  totLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const totScore = propSheet.getCell(`D${totRow}`);
  totScore.value = { formula: 'IF(COUNTA(D4:D16)=13,ROUND(SUM(F4:F16),2),"Incomplete")' };
  totScore.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Calibri' };
  totScore.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  totScore.alignment = { horizontal: 'center', vertical: 'middle' };
  totScore.numFmt = '0.00';
  propSheet.getRow(totRow).height = 32;

  for (let col = 5; col <= 8; col++) {
    propSheet.getRow(totRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  }

  // Grade row
  const gradeRow = 19;
  propSheet.mergeCells(`B${gradeRow}:C${gradeRow}`);
  const grLabel = propSheet.getCell(`B${gradeRow}`);
  grLabel.value = 'GRADE';
  grLabel.font = { bold: true, size: 12, name: 'Calibri' };
  grLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  grLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const grCell = propSheet.getCell(`D${gradeRow}`);
  grCell.value = { formula: `IF(D${totRow}="Incomplete","—",IF(D${totRow}<=1.5,"A+",IF(D${totRow}<=2,"A",IF(D${totRow}<=2.5,"B+",IF(D${totRow}<=3,"B",IF(D${totRow}<=3.5,"C+",IF(D${totRow}<=4,"C","D")))))))` };
  grCell.font = { bold: true, size: 16, name: 'Calibri' };
  grCell.alignment = { horizontal: 'center', vertical: 'middle' };
  grCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  propSheet.getRow(gradeRow).height = 32;

  for (let col = 5; col <= 8; col++) {
    propSheet.getRow(gradeRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  }

  // UW Action row
  const actRow = 20;
  propSheet.mergeCells(`B${actRow}:C${actRow}`);
  const actLabel = propSheet.getCell(`B${actRow}`);
  actLabel.value = 'UW ACTION';
  actLabel.font = { bold: true, size: 11, name: 'Calibri' };
  actLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  actLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const actCell = propSheet.getCell(`D${actRow}`);
  actCell.value = { formula: `IF(D${totRow}="Incomplete","—",IF(D${totRow}<=2.5,"BIND - Standard",IF(D${totRow}<=3,"BIND - Review Pricing",IF(D${totRow}<=3.5,"REFER - Senior UW",IF(D${totRow}<=4,"REFER - Committee","DECLINE")))))` };
  actCell.font = { bold: true, size: 11, name: 'Calibri' };
  actCell.alignment = { horizontal: 'center' };
  actCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  propSheet.mergeCells(`E${actRow}:F${actRow}`);
  propSheet.getRow(actRow).height = 26;

  // Rate Mod row
  const rateRow = 21;
  propSheet.mergeCells(`B${rateRow}:C${rateRow}`);
  const rateLabel = propSheet.getCell(`B${rateRow}`);
  rateLabel.value = 'RATE MODIFICATION';
  rateLabel.font = { bold: true, size: 11, name: 'Calibri' };
  rateLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  rateLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const rateCell = propSheet.getCell(`D${rateRow}`);
  rateCell.value = { formula: `IF(D${totRow}="Incomplete","—",IF(D${totRow}<=1.5,-0.15,IF(D${totRow}<=2,-0.1,IF(D${totRow}<=2.5,-0.05,IF(D${totRow}<=3,0,IF(D${totRow}<=3.5,0.1,IF(D${totRow}<=4,0.2,0.35)))))))` };
  rateCell.numFmt = '+0%;-0%;0%';
  rateCell.font = { bold: true, size: 12, name: 'Calibri' };
  rateCell.alignment = { horizontal: 'center' };
  rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  propSheet.getRow(rateRow).height = 26;

  for (let col = 5; col <= 8; col++) {
    propSheet.getRow(actRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    propSheet.getRow(rateRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  }

  // Conditional formatting for score column
  propSheet.addConditionalFormatting({
    ref: 'D4:D16',
    rules: [
      { type: 'cellIs', operator: 'between', formulae: [1, 2], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_GREEN } } }, priority: 1 },
      { type: 'cellIs', operator: 'between', formulae: [3, 3], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_YELLOW } } }, priority: 2 },
      { type: 'cellIs', operator: 'between', formulae: [4, 5], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_RED } } }, priority: 3 },
    ],
  });

  // ============================================================
  // SHEET: GL SCORING
  // ============================================================
  const glSheet = wb.addWorksheet('GL Scoring', {
    properties: { tabColor: { argb: '2980B9' } }
  });

  glSheet.columns = [
    { width: 3 },   // A
    { width: 5 },   // B - #
    { width: 28 },  // C - Factor
    { width: 12 },  // D - Score (1-5)
    { width: 10 },  // E - Weight
    { width: 14 },  // F - Weighted
    { width: 3 },   // G - spacer
    { width: 60 },  // H - Score Guide
  ];

  // Title
  glSheet.mergeCells('A1:H1');
  const gltitle = glSheet.getCell('A1');
  gltitle.value = 'GENERAL LIABILITY (GL) RISK SCORING';
  gltitle.font = titleFont;
  gltitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2980B9' } };
  gltitle.alignment = { horizontal: 'center', vertical: 'middle' };
  glSheet.getRow(1).height = 36;

  // Headers
  const glHrow = glSheet.getRow(3);
  propHeaders.forEach((h, i) => {
    const c = glHrow.getCell(i + 1);
    c.value = h;
    c.font = headerFont;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2471A3' } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder;
  });
  glSheet.getRow(3).height = 26;

  const glFactors = [
    { num: 1, key: 'gl_university_tier', name: 'University Risk Tier', weight: 0.12, auto: true,
      guide: '1=Tier1 | 2=Tier2 (party<7) | 3=Tier2 (party>=7) | 4=Tier3 (party<8) | 5=Tier3 (party>=8)' },
    { num: 2, key: 'gl_occupancy', name: 'Occupancy Type', weight: 0.10, auto: false,
      guide: '1=Senior/LIHTC | 2=Workforce | 3=Graduate | 4=Undergraduate | 5=Greek/Party' },
    { num: 3, key: 'gl_distance', name: 'Distance from Campus', weight: 0.12, auto: true,
      guide: '1=<0.25mi | 2=0.25-0.5mi | 3=0.5-1.0mi | 4=1.0-2.0mi | 5=>2.0mi' },
    { num: 4, key: 'gl_rent_vs_market', name: 'Rent vs. Market', weight: 0.08, auto: true,
      guide: '1=>120% | 2=110-120% | 3=100-110% | 4=90-100% | 5=<90%' },
    { num: 5, key: 'gl_crime', name: 'Crime Score', weight: 0.10, auto: false,
      guide: '1=Very Low (<20 idx) | 2=Low (20-35) | 3=Medium (35-50) | 4=High (50-70) | 5=Very High (>70)' },
    { num: 6, key: 'gl_amenity_risk', name: 'Amenity Risk', weight: 0.08, auto: false,
      guide: '1=None/Basic | 2=Gym (fitness) | 3=Pool (slip/fall) | 4=Pool+Deck (outdoor) | 5=Full Party (pool+deck+bar)' },
    { num: 7, key: 'gl_premises', name: 'Premises Condition', weight: 0.08, auto: false,
      guide: '1=Excellent | 2=Good (minor cosmetic) | 3=Average | 4=Below Avg (deterioration) | 5=Poor (hazards)' },
    { num: 8, key: 'gl_sponsor', name: 'Sponsor / Mgmt Tier', weight: 0.10, auto: false,
      guide: '1=Top Inst (>$1B) | 2=Strong Regional (>$200M) | 3=Adequate | 4=Thin/Emerging | 5=New/Poor' },
    { num: 9, key: 'gl_work_orders', name: 'Work Order / Maintenance', weight: 0.07, auto: false,
      guide: '1=Excellent | 2=Good | 3=Average | 4=Below Average | 5=Poor' },
    { num: 10, key: 'gl_loss_history', name: 'Loss History', weight: 0.08, auto: false,
      guide: '1=No losses 3+yr | 2=Minor (LR<40%) | 3=Moderate (40-60%) | 4=Significant (60-80%) | 5=Severe (>80%)' },
    { num: 11, key: 'gl_security', name: 'Security Measures', weight: 0.07, auto: false,
      guide: '1=24hr+cameras+access+patrol | 2=Cameras+controlled access | 3=Key fob, basic cams | 4=Locked entries only | 5=Open access' },
  ];

  glFactors.forEach((f, idx) => {
    const r = idx + 4;
    const row = glSheet.getRow(r);
    const bgColor = idx % 2 === 0 ? WHITE : GRAY_BG;

    row.getCell(2).value = f.num;
    row.getCell(2).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(2).alignment = { horizontal: 'center' };

    row.getCell(3).value = f.name;
    row.getCell(3).font = labelFont;

    const scoreCell = row.getCell(4);
    if (f.key === 'gl_university_tier') {
      scoreCell.value = { formula: "'Property Info'!F14" };
    } else if (f.key === 'gl_distance') {
      scoreCell.value = { formula: "'Property Info'!C15" };
    } else if (f.key === 'gl_rent_vs_market') {
      scoreCell.value = { formula: "'Property Info'!F15" };
    } else {
      scoreCell.value = null;
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
    }
    scoreCell.font = scoreInputFont;
    scoreCell.alignment = { horizontal: 'center' };
    scoreCell.border = {
      top: { style: 'medium', color: { argb: '2980B9' } },
      bottom: { style: 'medium', color: { argb: '2980B9' } },
      left: { style: 'medium', color: { argb: '2980B9' } },
      right: { style: 'medium', color: { argb: '2980B9' } },
    };

    row.getCell(5).value = f.weight;
    row.getCell(5).numFmt = '0%';
    row.getCell(5).font = dataFont;
    row.getCell(5).alignment = { horizontal: 'center' };

    row.getCell(6).value = { formula: `IF(D${r}="","",D${r}*E${r})` };
    row.getCell(6).numFmt = '0.00';
    row.getCell(6).font = dataFont;
    row.getCell(6).alignment = { horizontal: 'center' };

    row.getCell(8).value = (f.auto ? '[AUTO] ' : '') + f.guide;
    row.getCell(8).font = { size: 9, name: 'Calibri', color: { argb: '555555' } };

    for (let col = 1; col <= 8; col++) {
      const cell = row.getCell(col);
      if (!cell.fill || (cell.fill.fgColor && cell.fill.fgColor.argb !== 'FFFFF8E1')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
      if (col !== 4) cell.border = thinBorder;
    }
    row.height = 24;
  });

  // Data validation for GL manual scores
  for (let r = 4; r <= 14; r++) {
    const factor = glFactors[r - 4];
    if (factor && !factor.auto) {
      glSheet.getCell(`D${r}`).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 5],
        showErrorMessage: true,
        errorTitle: 'Invalid Score',
        error: 'Score must be between 1 and 5',
        showInputMessage: true,
        promptTitle: 'Enter Score',
        prompt: 'Enter a score from 1 (best) to 5 (worst)',
      };
    }
  }

  // GL Totals
  const glTotRow = 16;
  glSheet.mergeCells(`B${glTotRow}:C${glTotRow}`);
  const glTotLabel = glSheet.getCell(`B${glTotRow}`);
  glTotLabel.value = 'TOTAL WEIGHTED SCORE';
  glTotLabel.font = { bold: true, size: 12, color: { argb: WHITE }, name: 'Calibri' };
  glTotLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2980B9' } };
  glTotLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const glTotScore = glSheet.getCell(`D${glTotRow}`);
  glTotScore.value = { formula: 'IF(COUNTA(D4:D14)=11,ROUND(SUM(F4:F14),2),"Incomplete")' };
  glTotScore.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Calibri' };
  glTotScore.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2980B9' } };
  glTotScore.alignment = { horizontal: 'center', vertical: 'middle' };
  glTotScore.numFmt = '0.00';
  glSheet.getRow(glTotRow).height = 32;

  for (let col = 5; col <= 8; col++) {
    glSheet.getRow(glTotRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2980B9' } };
  }

  // GL Grade
  const glGradeRow = 17;
  glSheet.mergeCells(`B${glGradeRow}:C${glGradeRow}`);
  const glGrLabel = glSheet.getCell(`B${glGradeRow}`);
  glGrLabel.value = 'GRADE';
  glGrLabel.font = { bold: true, size: 12, name: 'Calibri' };
  glGrLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glGrLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const glGrCell = glSheet.getCell(`D${glGradeRow}`);
  glGrCell.value = { formula: `IF(D${glTotRow}="Incomplete","—",IF(D${glTotRow}<=1.5,"A+",IF(D${glTotRow}<=2,"A",IF(D${glTotRow}<=2.5,"B+",IF(D${glTotRow}<=3,"B",IF(D${glTotRow}<=3.5,"C+",IF(D${glTotRow}<=4,"C","D")))))))` };
  glGrCell.font = { bold: true, size: 16, name: 'Calibri' };
  glGrCell.alignment = { horizontal: 'center', vertical: 'middle' };
  glGrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glSheet.getRow(glGradeRow).height = 32;

  // GL UW Action
  const glActRow = 18;
  glSheet.mergeCells(`B${glActRow}:C${glActRow}`);
  const glActLabel = glSheet.getCell(`B${glActRow}`);
  glActLabel.value = 'UW ACTION';
  glActLabel.font = { bold: true, size: 11, name: 'Calibri' };
  glActLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glActLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const glActCell = glSheet.getCell(`D${glActRow}`);
  glActCell.value = { formula: `IF(D${glTotRow}="Incomplete","—",IF(D${glTotRow}<=2.5,"BIND - Standard",IF(D${glTotRow}<=3,"BIND - Review Pricing",IF(D${glTotRow}<=3.5,"REFER - Senior UW",IF(D${glTotRow}<=4,"REFER - Committee","DECLINE")))))` };
  glActCell.font = { bold: true, size: 11, name: 'Calibri' };
  glActCell.alignment = { horizontal: 'center' };
  glActCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glSheet.mergeCells(`E${glActRow}:F${glActRow}`);
  glSheet.getRow(glActRow).height = 26;

  // GL Rate Mod
  const glRateRow = 19;
  glSheet.mergeCells(`B${glRateRow}:C${glRateRow}`);
  const glRateLabel = glSheet.getCell(`B${glRateRow}`);
  glRateLabel.value = 'RATE MODIFICATION';
  glRateLabel.font = { bold: true, size: 11, name: 'Calibri' };
  glRateLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glRateLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const glRateCell = glSheet.getCell(`D${glRateRow}`);
  glRateCell.value = { formula: `IF(D${glTotRow}="Incomplete","—",IF(D${glTotRow}<=1.5,-0.15,IF(D${glTotRow}<=2,-0.1,IF(D${glTotRow}<=2.5,-0.05,IF(D${glTotRow}<=3,0,IF(D${glTotRow}<=3.5,0.1,IF(D${glTotRow}<=4,0.2,0.35)))))))` };
  glRateCell.numFmt = '+0%;-0%;0%';
  glRateCell.font = { bold: true, size: 12, name: 'Calibri' };
  glRateCell.alignment = { horizontal: 'center' };
  glRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  glSheet.getRow(glRateRow).height = 26;

  for (let col = 5; col <= 8; col++) {
    glSheet.getRow(glGradeRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    glSheet.getRow(glActRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    glSheet.getRow(glRateRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
  }

  // GL Conditional formatting
  glSheet.addConditionalFormatting({
    ref: 'D4:D14',
    rules: [
      { type: 'cellIs', operator: 'between', formulae: [1, 2], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_GREEN } } }, priority: 1 },
      { type: 'cellIs', operator: 'between', formulae: [3, 3], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_YELLOW } } }, priority: 2 },
      { type: 'cellIs', operator: 'between', formulae: [4, 5], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_RED } } }, priority: 3 },
    ],
  });

  // ============================================================
  // SHEET: GRADE REFERENCE
  // ============================================================
  const refSheet = wb.addWorksheet('Grade Reference', {
    properties: { tabColor: { argb: 'F39C12' } }
  });

  refSheet.columns = [
    { width: 3 },
    { width: 10 },
    { width: 15 },
    { width: 18 },
    { width: 30 },
    { width: 18 },
  ];

  refSheet.mergeCells('A1:F1');
  const refTitle = refSheet.getCell('A1');
  refTitle.value = 'GRADE REFERENCE TABLE';
  refTitle.font = titleFont;
  refTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
  refTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  refSheet.getRow(1).height = 36;

  const refHeaders = ['', 'Grade', 'Label', 'Score Range', 'UW Action', 'Rate Mod'];
  const refHrow = refSheet.getRow(3);
  refHeaders.forEach((h, i) => {
    const c = refHrow.getCell(i + 1);
    c.value = h;
    c.font = headerFont;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder;
  });
  refSheet.getRow(3).height = 26;

  const grades = [
    ['A+', 'Excellent', '1.00 — 1.50', 'BIND — Standard Terms', '-15%', LIGHT_GREEN],
    ['A', 'Very Good', '1.51 — 2.00', 'BIND — Standard Terms', '-10%', LIGHT_GREEN],
    ['B+', 'Good', '2.01 — 2.50', 'BIND — Review Pricing', '-5%', LIGHT_GREEN],
    ['B', 'Average', '2.51 — 3.00', 'BIND — Review Pricing', '0% (Base)', LIGHT_YELLOW],
    ['C+', 'Below Avg', '3.01 — 3.50', 'REFER — Senior UW', '+10%', LIGHT_YELLOW],
    ['C', 'Marginal', '3.51 — 4.00', 'REFER — Committee', '+20%', LIGHT_RED],
    ['D', 'Poor', '4.01 — 5.00', 'DECLINE', '+35%', LIGHT_RED],
  ];

  grades.forEach(([grade, label, range, action, rate, color], idx) => {
    const r = idx + 4;
    const row = refSheet.getRow(r);
    row.getCell(2).value = grade;
    row.getCell(2).font = { bold: true, size: 14, name: 'Calibri' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = label;
    row.getCell(3).font = dataFont;
    row.getCell(4).value = range;
    row.getCell(4).font = dataFont;
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).value = action;
    row.getCell(5).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(6).value = rate;
    row.getCell(6).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(6).alignment = { horizontal: 'center' };

    for (let col = 1; col <= 6; col++) {
      row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      row.getCell(col).border = thinBorder;
    }
    row.height = 26;
  });

  // Lookup tables below
  const lkRow = 13;
  refSheet.mergeCells(`A${lkRow}:F${lkRow}`);
  const lkTitle = refSheet.getCell(`A${lkRow}`);
  lkTitle.value = 'AUTO-SCORE LOOKUP TABLES';
  lkTitle.font = { bold: true, color: { argb: WHITE }, size: 12, name: 'Calibri' };
  lkTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_NAVY } };
  lkTitle.alignment = { horizontal: 'center' };
  refSheet.getRow(lkRow).height = 28;

  // University Tier lookup
  const utRow = 15;
  refSheet.getCell(`B${utRow}`).value = 'University Tier → Score';
  refSheet.getCell(`B${utRow}`).font = { bold: true, size: 11, name: 'Calibri' };
  refSheet.mergeCells(`B${utRow}:D${utRow}`);

  const utData = [
    ['Tier 1 (any party)', '→', '1'],
    ['Tier 2, party < 7.0', '→', '2'],
    ['Tier 2, party >= 7.0', '→', '3'],
    ['Tier 3, party < 8.0', '→', '4'],
    ['Tier 3, party >= 8.0', '→', '5'],
  ];
  utData.forEach(([cond, arrow, score], i) => {
    const r = utRow + 1 + i;
    refSheet.getCell(`B${r}`).value = cond;
    refSheet.getCell(`B${r}`).font = dataFont;
    refSheet.getCell(`C${r}`).value = arrow;
    refSheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
    refSheet.getCell(`D${r}`).value = parseInt(score);
    refSheet.getCell(`D${r}`).font = { bold: true, size: 11, name: 'Calibri' };
    refSheet.getCell(`D${r}`).alignment = { horizontal: 'center' };
    for (let col = 2; col <= 4; col++) {
      refSheet.getRow(r).getCell(col).border = thinBorder;
      refSheet.getRow(r).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
    }
  });

  // Distance lookup
  const distRow = 22;
  refSheet.getCell(`B${distRow}`).value = 'Distance → Score';
  refSheet.getCell(`B${distRow}`).font = { bold: true, size: 11, name: 'Calibri' };
  refSheet.mergeCells(`B${distRow}:D${distRow}`);

  const distData = [
    ['< 0.25 miles', '→', '1'],
    ['0.25 — 0.50 miles', '→', '2'],
    ['0.50 — 1.00 miles', '→', '3'],
    ['1.00 — 2.00 miles', '→', '4'],
    ['> 2.00 miles', '→', '5'],
  ];
  distData.forEach(([cond, arrow, score], i) => {
    const r = distRow + 1 + i;
    refSheet.getCell(`B${r}`).value = cond;
    refSheet.getCell(`B${r}`).font = dataFont;
    refSheet.getCell(`C${r}`).value = arrow;
    refSheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
    refSheet.getCell(`D${r}`).value = parseInt(score);
    refSheet.getCell(`D${r}`).font = { bold: true, size: 11, name: 'Calibri' };
    refSheet.getCell(`D${r}`).alignment = { horizontal: 'center' };
    for (let col = 2; col <= 4; col++) {
      refSheet.getRow(r).getCell(col).border = thinBorder;
      refSheet.getRow(r).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
    }
  });

  // Rent Ratio lookup
  const rrRow2 = 29;
  refSheet.getCell(`B${rrRow2}`).value = 'Rent vs Market → Score';
  refSheet.getCell(`B${rrRow2}`).font = { bold: true, size: 11, name: 'Calibri' };
  refSheet.mergeCells(`B${rrRow2}:D${rrRow2}`);

  const rrData = [
    ['> 120% of market', '→', '1'],
    ['110% — 120%', '→', '2'],
    ['100% — 110%', '→', '3'],
    ['90% — 100%', '→', '4'],
    ['< 90% of market', '→', '5'],
  ];
  rrData.forEach(([cond, arrow, score], i) => {
    const r = rrRow2 + 1 + i;
    refSheet.getCell(`B${r}`).value = cond;
    refSheet.getCell(`B${r}`).font = dataFont;
    refSheet.getCell(`C${r}`).value = arrow;
    refSheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
    refSheet.getCell(`D${r}`).value = parseInt(score);
    refSheet.getCell(`D${r}`).font = { bold: true, size: 11, name: 'Calibri' };
    refSheet.getCell(`D${r}`).alignment = { horizontal: 'center' };
    for (let col = 2; col <= 4; col++) {
      refSheet.getRow(r).getCell(col).border = thinBorder;
      refSheet.getRow(r).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
    }
  });

  // ============================================================
  // SHEET: UNIVERSITY DATABASE
  // ============================================================
  const uniSheet = wb.addWorksheet('University Database', {
    properties: { tabColor: { argb: '8E44AD' } }
  });

  uniSheet.columns = [
    { width: 5 },   // A - #
    { width: 42 },  // B - Name
    { width: 10 },  // C - Tier
    { width: 14 },  // D - Party Score
    { width: 14 },  // E - Latitude
    { width: 14 },  // F - Longitude
    { width: 14 },  // G - Risk Score (formula)
  ];

  // Title
  uniSheet.mergeCells('A1:G1');
  const uniTitle = uniSheet.getCell('A1');
  uniTitle.value = 'UNIVERSITY DATABASE (535 Schools)';
  uniTitle.font = titleFont;
  uniTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '8E44AD' } };
  uniTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  uniSheet.getRow(1).height = 36;

  // Headers
  const uniHeaders = ['#', 'University Name', 'Tier', 'Party Score', 'Latitude', 'Longitude', 'Risk Score'];
  const uniHrow = uniSheet.getRow(2);
  uniHeaders.forEach((h, i) => {
    const c = uniHrow.getCell(i + 1);
    c.value = h;
    c.font = headerFont;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7D3C98' } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder;
  });
  uniSheet.getRow(2).height = 26;

  // Load universities
  const universities = JSON.parse(fs.readFileSync('data/university_database.json', 'utf-8'));
  // Sort by name
  universities.sort((a, b) => a.name.localeCompare(b.name));

  universities.forEach((uni, idx) => {
    const r = idx + 3;
    const row = uniSheet.getRow(r);
    const bgColor = idx % 2 === 0 ? WHITE : GRAY_BG;

    row.getCell(1).value = idx + 1;
    row.getCell(1).font = { size: 9, color: { argb: '999999' }, name: 'Calibri' };
    row.getCell(1).alignment = { horizontal: 'center' };

    row.getCell(2).value = uni.name;
    row.getCell(2).font = dataFont;

    row.getCell(3).value = uni.tier;
    row.getCell(3).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(3).alignment = { horizontal: 'center' };

    row.getCell(4).value = uni.party_score;
    row.getCell(4).numFmt = '0.00';
    row.getCell(4).font = dataFont;
    row.getCell(4).alignment = { horizontal: 'center' };

    row.getCell(5).value = uni.campus_lat;
    row.getCell(5).numFmt = '0.0000';
    row.getCell(5).font = { size: 9, name: 'Calibri' };
    row.getCell(5).alignment = { horizontal: 'center' };

    row.getCell(6).value = uni.campus_lng;
    row.getCell(6).numFmt = '0.0000';
    row.getCell(6).font = { size: 9, name: 'Calibri' };
    row.getCell(6).alignment = { horizontal: 'center' };

    // Risk score formula: =IF(C3=3,IF(D3>=8,5,4),IF(C3=2,IF(D3>=7,3,2),1))
    row.getCell(7).value = { formula: `IF(C${r}=3,IF(D${r}>=8,5,4),IF(C${r}=2,IF(D${r}>=7,3,2),1))` };
    row.getCell(7).font = { bold: true, size: 11, name: 'Calibri' };
    row.getCell(7).alignment = { horizontal: 'center' };

    for (let col = 1; col <= 7; col++) {
      row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(col).border = thinBorder;
    }
  });

  // Conditional formatting for tier column
  uniSheet.addConditionalFormatting({
    ref: `C3:C${universities.length + 2}`,
    rules: [
      { type: 'cellIs', operator: 'equal', formulae: [1], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_GREEN } } }, priority: 1 },
      { type: 'cellIs', operator: 'equal', formulae: [2], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_YELLOW } } }, priority: 2 },
      { type: 'cellIs', operator: 'equal', formulae: [3], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LIGHT_RED } } }, priority: 3 },
    ],
  });

  // Auto-filter on university sheet
  uniSheet.autoFilter = {
    from: 'A2',
    to: `G${universities.length + 2}`,
  };

  // Freeze panes
  uniSheet.views = [{ state: 'frozen', ySplit: 2 }];
  propSheet.views = [{ state: 'frozen', ySplit: 3 }];
  glSheet.views = [{ state: 'frozen', ySplit: 3 }];

  // ============================================================
  // SAVE
  // ============================================================
  const outPath = path.join(process.cwd(), 'HABGEN_Risk_Scorer.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`Workbook saved to: ${outPath}`);
}

createRiskScorerWorkbook().catch(console.error);
