import ExcelJS from 'exceljs';
import {
  Submission,
  Flag,
  Recommendation,
} from '../types/submission';

// Color constants
const COLORS = {
  RED: 'FFFF0000',
  YELLOW: 'FFFFFF00',
  GREEN: 'FF00B050',
  DARK_GREEN: 'FF375623',
  ORANGE: 'FFFF6600',
  NAVY: 'FF1F3864',
  LIGHT_BLUE: 'FFDCE6F1',
  LIGHT_YELLOW: 'FFFFEB9C',
  LIGHT_RED: 'FFFFC7CE',
  LIGHT_GREEN: 'FFC6EFCE',
  WHITE: 'FFFFFFFF',
  LIGHT_GRAY: 'FFF2F2F2',
  HEADER_BG: 'FF1F3864',
};

const FONT = 'Arial';

function currency(val: number): string {
  if (val == null || isNaN(val)) return '$0';
  return '$' + Math.round(val).toLocaleString('en-US');
}

function rate(val: number, decimals = 4): string {
  if (val == null || isNaN(val)) return '0.0000';
  return val.toFixed(decimals);
}

function pct(val: number): string {
  return (val * 100).toFixed(1) + '%';
}

function styleHeader(ws: ExcelJS.Worksheet, row: number, cols: number): void {
  const dataRow = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = dataRow.getCell(c);
    cell.font = { name: FONT, bold: true, color: { argb: COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.HEADER_BG } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.WHITE } },
    };
    cell.alignment = { horizontal: 'center', wrapText: true };
  }
}

function setBgColor(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function addTitle(ws: ExcelJS.Worksheet, title: string, cols: number): void {
  ws.mergeCells(1, 1, 1, cols);
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: FONT, bold: true, size: 14, color: { argb: COLORS.WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Executive Summary
// ─────────────────────────────────────────────────────────────────────────────
function buildTab1(ws: ExcelJS.Worksheet, sub: Submission, strengths: string[], concerns: string[]): void {
  ws.name = '1. Executive Summary';
  addTitle(ws, 'HABGEN LLC — UNDERWRITING EXECUTIVE SUMMARY', 4);

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 40;

  let row = 3;

  // Recommendation
  const recCell = ws.getCell(`A${row}`);
  const recColors: Record<Recommendation, string> = {
    BIND: COLORS.LIGHT_GREEN,
    CONDITIONAL_BIND: COLORS.LIGHT_YELLOW,
    DECLINE: COLORS.LIGHT_RED,
  };
  ws.mergeCells(row, 1, row, 4);
  recCell.value = `RECOMMENDATION: ${sub.recommendation.replace('_', ' ')}`;
  recCell.font = { name: FONT, bold: true, size: 18, color: { argb: COLORS.NAVY } };
  setBgColor(recCell, recColors[sub.recommendation] ?? COLORS.WHITE);
  recCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 36;
  row += 2;

  const addField = (label: string, value: string, bold = false): void => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { name: FONT, bold: true };
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { name: FONT, bold };
    row++;
  };

  // Named insured
  addField('Named Insured', sub.named_insured.name + (sub.named_insured.dba ? ` (dba ${sub.named_insured.dba})` : ''));
  addField('Entity Type', sub.named_insured.entity_type ?? 'N/A');
  addField('Broker', `${sub.broker.name ?? ''} — ${sub.broker.agency ?? ''}`);
  addField('Policy Period', `${sub.policy_period.effective_date ?? 'TBD'} to ${sub.policy_period.expiration_date ?? 'TBD'} (${sub.policy_period.term_months ?? '?'} months)`);
  addField('Occupancy', sub.occupancy_type === 'student_housing' ? 'Student Housing' : 'Conventional Multifamily');
  row++;

  // Location summary
  const totalBldgs = sub.locations.flatMap((l) => l.buildings).length;
  const totalUnits = sub.premium_summary.total_units;
  const totalBeds = sub.locations.flatMap((l) => l.buildings).reduce((s, b) => s + (b.num_beds ?? 0), 0);

  addField('Locations', `${sub.locations.length} location(s), ${totalBldgs} building(s), ${totalUnits} units${totalBeds > 0 ? ', ' + totalBeds + ' beds' : ''}`);

  // TIV
  const allBuildings = sub.locations.flatMap((l) => l.buildings);
  const totalBldgTIV = allBuildings.reduce((s, b) => s + b.values.building, 0);
  const totalBPP = allBuildings.reduce((s, b) => s + b.values.bpp, 0);
  const totalBI = allBuildings.reduce((s, b) => s + b.values.bi, 0);

  addField('Building TIV', currency(totalBldgTIV));
  addField('BPP TIV', currency(totalBPP));
  addField('BI/Rental Income TIV', currency(totalBI));
  addField('Grand Total TIV', currency(sub.premium_summary.total_tiv), true);
  row++;

  // Premium
  addField('Property Premium', currency(sub.premium_summary.total_property_premium));
  addField('GL Premium', currency(sub.premium_summary.total_gl_premium));
  addField('TOTAL PREMIUM', currency(sub.premium_summary.total_premium), true);
  addField('Blended Property Rate', `$${rate(sub.premium_summary.blended_property_rate, 4)} per $100 TIV`);
  addField('Blended GL Rate', `$${rate(sub.premium_summary.blended_gl_rate_per_unit, 2)} per unit`);
  row++;

  // Prior carrier
  addField('Prior Carrier', sub.prior_insurance.carrier ?? 'N/A');
  addField('Expiring Premium', sub.prior_insurance.premium ? currency(sub.prior_insurance.premium) : 'N/A');
  addField('Expiring Limits', sub.prior_insurance.limits ?? 'N/A');
  addField('Expiring Deductible', sub.prior_insurance.deductible ? currency(sub.prior_insurance.deductible) : 'N/A');
  row++;

  // Strengths
  ws.getCell(`A${row}`).value = 'KEY STRENGTHS';
  ws.getCell(`A${row}`).font = { name: FONT, bold: true };
  setBgColor(ws.getCell(`A${row}`), COLORS.LIGHT_GREEN);
  row++;
  for (const s of strengths) {
    ws.getCell(`A${row}`).value = `• ${s}`;
    ws.mergeCells(row, 1, row, 4);
    row++;
  }
  row++;

  // Concerns
  ws.getCell(`A${row}`).value = 'KEY CONCERNS';
  ws.getCell(`A${row}`).font = { name: FONT, bold: true };
  setBgColor(ws.getCell(`A${row}`), COLORS.LIGHT_YELLOW);
  row++;
  for (const c of concerns) {
    ws.getCell(`A${row}`).value = `• ${c}`;
    ws.mergeCells(row, 1, row, 4);
    row++;
  }
  row++;

  // Referral items
  const referrals = sub.flags.filter((f) => f.flag_type === 'REFERRAL');
  if (referrals.length > 0) {
    ws.getCell(`A${row}`).value = 'REFERRAL ITEMS';
    ws.getCell(`A${row}`).font = { name: FONT, bold: true };
    setBgColor(ws.getCell(`A${row}`), COLORS.LIGHT_YELLOW);
    row++;
    for (const r of referrals) {
      ws.getCell(`A${row}`).value = `• ${r.description}`;
      ws.mergeCells(row, 1, row, 4);
      row++;
    }
    row++;
  }

  // Data gaps
  if (sub.data_gaps.length > 0) {
    ws.getCell(`A${row}`).value = 'DATA GAPS';
    ws.getCell(`A${row}`).font = { name: FONT, bold: true };
    setBgColor(ws.getCell(`A${row}`), COLORS.LIGHT_RED);
    row++;
    for (const gap of sub.data_gaps) {
      ws.getCell(`A${row}`).value = `• ${gap}`;
      ws.mergeCells(row, 1, row, 4);
      row++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Property Rating
// ─────────────────────────────────────────────────────────────────────────────
function buildTab2(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '2. Property Rating';
  addTitle(ws, 'PROPERTY RATING DETAIL', 30);

  const headers = [
    'Loc #', 'Bldg #', 'Address', 'City', 'State', 'Zip',
    'Year Built', 'Renovated', 'Age', 'Construction', 'Stories', 'Units', 'Sq Ft',
    'Sprinklered', 'Prot Class', 'Building TIV', 'BPP TIV', 'BI TIV', 'Total TIV',
    'ITV $/SqFt', 'Base Rate', 'Const Factor', 'Age Factor', 'Scatter Factor',
    'Operator Factor', 'DSCR Factor', 'WO Factor', 'CAT Load', 'Sched Factor', 'Final Rate', 'Premium'
  ];

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
  });
  styleHeader(ws, 2, headers.length);
  ws.getRow(2).height = 40;

  const currentYear = new Date().getFullYear();
  let dataRow = 3;
  let totalTIV = 0;
  let totalPremium = 0;

  for (const loc of sub.locations) {
    for (const bldg of loc.buildings) {
      const row = ws.getRow(dataRow);
      const r = bldg.rating;
      const age = currentYear - bldg.year_built;
      totalTIV += bldg.values.total_tiv;
      totalPremium += r.premium;

      const vals = [
        loc.location_number,
        bldg.building_number,
        bldg.address.street,
        bldg.address.city,
        bldg.address.state,
        bldg.address.zip,
        bldg.year_built,
        bldg.year_renovated ?? 'None',
        age,
        bldg.construction_type,
        bldg.stories,
        bldg.num_units,
        bldg.square_footage?.toLocaleString() ?? '',
        bldg.sprinkler_status ? 'Yes' : 'No',
        bldg.protection_class,
        currency(bldg.values.building),
        currency(bldg.values.bpp),
        currency(bldg.values.bi),
        currency(bldg.values.total_tiv),
        `$${bldg.itv_per_sqft?.toFixed(0) ?? '0'}`,
        `$${rate(r.base_rate, 4)}`,
        r.construction_factor.toFixed(4),
        r.age_factor.toFixed(4),
        r.scatter_factor.toFixed(4),
        r.operator_factor.toFixed(4),
        r.dscr_factor.toFixed(4),
        r.work_order_factor.toFixed(4),
        r.cat_load.toFixed(4),
        r.schedule_factor.toFixed(4),
        `$${rate(r.final_rate, 4)}`,
        currency(r.premium),
      ];

      vals.forEach((v, i) => {
        row.getCell(i + 1).value = v as ExcelJS.CellValue;
        row.getCell(i + 1).font = { name: FONT };
      });

      // Color ITV cell
      const itvCell = row.getCell(20);
      if (bldg.itv_flag === 'red') setBgColor(itvCell, COLORS.LIGHT_RED);
      else if (bldg.itv_flag === 'yellow') setBgColor(itvCell, COLORS.LIGHT_YELLOW);
      else setBgColor(itvCell, COLORS.LIGHT_GREEN);

      // Color sprinkler
      if (!bldg.sprinkler_status) setBgColor(row.getCell(14), COLORS.LIGHT_YELLOW);

      dataRow++;
    }
  }

  // Totals row
  const totalsRow = ws.getRow(dataRow);
  totalsRow.getCell(1).value = 'TOTALS';
  totalsRow.getCell(1).font = { name: FONT, bold: true };
  totalsRow.getCell(19).value = currency(totalTIV);
  totalsRow.getCell(19).font = { name: FONT, bold: true };
  totalsRow.getCell(31).value = currency(totalPremium);
  totalsRow.getCell(31).font = { name: FONT, bold: true };
  setBgColor(totalsRow.getCell(1), COLORS.LIGHT_BLUE);
  setBgColor(totalsRow.getCell(19), COLORS.LIGHT_BLUE);
  setBgColor(totalsRow.getCell(31), COLORS.LIGHT_BLUE);

  // Set column widths
  const colWidths = [6, 6, 35, 18, 6, 10, 10, 10, 6, 12, 8, 8, 12, 12, 10,
    16, 14, 14, 16, 12, 12, 12, 12, 14, 14, 12, 10, 10, 12, 12, 16];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: GL Scorer
// ─────────────────────────────────────────────────────────────────────────────
function buildTab3(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '3. GL Scorer v3.1';
  addTitle(ws, 'GL RISK SCORER v3.1', 14);

  const isStudentHousing = sub.occupancy_type === 'student_housing';

  if (isStudentHousing) {
    const headers = [
      'Location #', 'University', 'V/SA (20%)', 'S&F (20%)', 'Party (15%)',
      'Security (15%)', 'Game Day (10%)', 'Greek (10%)', 'Litigation (10%)',
      'Composite Score', 'Rate Mod', 'Base Rate/Unit', 'Mod Rate/Unit', 'Units', 'GL Premium'
    ];
    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    styleHeader(ws, 2, headers.length);
    ws.getRow(2).height = 40;

    let dataRow = 3;
    let totalGL = 0;
    let totalUnits = 0;

    for (const loc of sub.locations) {
      const scorer = loc.university?.gl_scorer;
      const units = loc.num_units_total;
      totalUnits += units;
      totalGL += loc.location_gl_premium;

      const primaryState = loc.buildings[0]?.address.state ?? '';
      const baseRate = primaryState.toUpperCase() === 'FL' ? 400 :
        (scorer ? 100 : 90);
      const modRate = scorer
        ? baseRate * (1 + scorer.rate_modification)
        : baseRate;

      const row = ws.getRow(dataRow);
      const vals: (string | number)[] = [
        loc.location_number,
        loc.university?.name ?? 'Unknown',
        scorer?.vsa_score ?? 'N/A',
        scorer?.sf_score ?? 'N/A',
        scorer?.party_score ?? 'N/A',
        scorer?.security_score ?? 'N/A',
        scorer?.game_day_score ?? 'N/A',
        scorer?.greek_score ?? 'N/A',
        scorer?.litigation_score ?? 'N/A',
        scorer ? scorer.composite_score.toFixed(2) : 'N/A',
        scorer ? pct(scorer.rate_modification) : 'N/A',
        `$${baseRate.toFixed(0)}/unit`,
        `$${modRate.toFixed(2)}/unit`,
        units,
        currency(loc.location_gl_premium),
      ];

      vals.forEach((v, i) => {
        row.getCell(i + 1).value = v as ExcelJS.CellValue;
        row.getCell(i + 1).font = { name: FONT };
      });

      // Color composite score
      if (scorer) {
        const scoreCell = row.getCell(10);
        if (scorer.composite_score >= 8.0) setBgColor(scoreCell, COLORS.LIGHT_RED);
        else if (scorer.composite_score >= 7.0) setBgColor(scoreCell, COLORS.LIGHT_YELLOW);
        else if (scorer.composite_score < 4.0) setBgColor(scoreCell, COLORS.LIGHT_GREEN);
      }

      dataRow++;
    }

    // Totals
    const totalsRow = ws.getRow(dataRow);
    totalsRow.getCell(1).value = 'TOTALS';
    totalsRow.getCell(14).value = totalUnits;
    totalsRow.getCell(15).value = currency(totalGL);
    [1, 14, 15].forEach((c) => {
      totalsRow.getCell(c).font = { name: FONT, bold: true };
      setBgColor(totalsRow.getCell(c), COLORS.LIGHT_BLUE);
    });

  } else {
    // Conventional MF: simplified
    const headers = ['Location #', 'Address', 'State', 'Units', 'Base Rate/Unit', 'GL Premium'];
    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    styleHeader(ws, 2, headers.length);

    let dataRow = 3;
    let totalGL = 0;
    let totalUnits = 0;

    for (const loc of sub.locations) {
      const units = loc.num_units_total;
      const primaryAddr = loc.buildings[0]?.address;
      totalUnits += units;
      totalGL += loc.location_gl_premium;

      const row = ws.getRow(dataRow);
      [
        loc.location_number,
        primaryAddr?.street ?? '',
        primaryAddr?.state ?? '',
        units,
        '$90/unit',
        currency(loc.location_gl_premium),
      ].forEach((v, i) => {
        row.getCell(i + 1).value = v as ExcelJS.CellValue;
        row.getCell(i + 1).font = { name: FONT };
      });
      dataRow++;
    }

    const totalsRow = ws.getRow(dataRow);
    totalsRow.getCell(1).value = 'TOTALS';
    totalsRow.getCell(4).value = totalUnits;
    totalsRow.getCell(6).value = currency(totalGL);
    [1, 4, 6].forEach((c) => {
      totalsRow.getCell(c).font = { name: FONT, bold: true };
      setBgColor(totalsRow.getCell(c), COLORS.LIGHT_BLUE);
    });
  }

  // Column widths
  [10, 35, 12, 12, 12, 14, 14, 12, 14, 16, 12, 16, 16, 10, 16].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: Reviews & Reputation
// ─────────────────────────────────────────────────────────────────────────────
function buildTab4(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '4. Reviews & Reputation';
  addTitle(ws, 'REVIEWS & REPUTATION', 8);

  const headers = [
    'Loc #', 'Address', 'Property Name', 'Google Rating', 'Review Count',
    'Negative Themes', 'UW Risk Relevance', 'Management Company'
  ];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeader(ws, 2, headers.length);

  let dataRow = 3;
  for (const loc of sub.locations) {
    for (const bldg of loc.buildings) {
      const rev = bldg.reviews;
      const row = ws.getRow(dataRow);

      [
        loc.location_number,
        bldg.address.street,
        '',
        rev?.google_rating ?? 'N/A',
        rev?.review_count ?? 'N/A',
        (rev?.negative_themes ?? []).join(', ') || 'None noted',
        rev?.uw_risk_relevance ?? 'Not analyzed',
        rev?.management_company ?? 'N/A',
      ].forEach((v, i) => {
        row.getCell(i + 1).value = v as ExcelJS.CellValue;
        row.getCell(i + 1).font = { name: FONT };
      });

      // Color Google rating
      if (rev?.google_rating != null) {
        const ratingCell = row.getCell(4);
        if (rev.google_rating < 2.5) setBgColor(ratingCell, COLORS.LIGHT_RED);
        else if (rev.google_rating < 3.5) setBgColor(ratingCell, COLORS.LIGHT_YELLOW);
        else setBgColor(ratingCell, COLORS.LIGHT_GREEN);
      }

      row.getCell(7).alignment = { wrapText: true };
      dataRow++;
    }
  }

  [8, 40, 30, 14, 14, 35, 50, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: TIV Adequacy
// ─────────────────────────────────────────────────────────────────────────────
function buildTab5(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '5. TIV Adequacy';
  addTitle(ws, 'TIV ADEQUACY CHECK', 10);

  const headers = [
    'Loc #', 'Bldg #', 'Address', 'Reported TIV', 'Square Footage',
    '$/Sq Ft', 'Adequacy Flag', 'Roof Year', 'Roof Valuation', 'Notes'
  ];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeader(ws, 2, headers.length);

  const currentYear = new Date().getFullYear();
  let dataRow = 3;

  for (const loc of sub.locations) {
    for (const bldg of loc.buildings) {
      const row = ws.getRow(dataRow);
      const roofAge = bldg.roof_year ? currentYear - bldg.roof_year : null;
      const roofValuation = roofAge != null && roofAge > 20 ? 'ACV' : 'RC';

      const notes: string[] = [];
      if (bldg.itv_per_sqft < 100) notes.push('Likely underinsured - TIV/sqft < $100');
      if (bldg.itv_per_sqft < 150) notes.push('Below minimum adequacy floor of $150/sqft');
      if (roofAge != null && roofAge > 20) notes.push(`Roof ${roofAge} years old - ACV valuation applies`);

      const flagText = bldg.itv_flag === 'green' ? '✓ Adequate (≥$200)'
        : bldg.itv_flag === 'yellow' ? '⚠ Borderline ($150-199)'
        : '✗ Below Minimum (<$150)';

      [
        loc.location_number,
        bldg.building_number,
        bldg.address.street,
        currency(bldg.values.total_tiv),
        bldg.square_footage?.toLocaleString() ?? 'N/A',
        `$${bldg.itv_per_sqft?.toFixed(0) ?? 'N/A'}`,
        flagText,
        bldg.roof_year ?? 'N/A',
        roofValuation,
        notes.join('; ') || '',
      ].forEach((v, i) => {
        row.getCell(i + 1).value = v as ExcelJS.CellValue;
        row.getCell(i + 1).font = { name: FONT };
      });

      // Color adequacy flag
      const flagCell = row.getCell(7);
      if (bldg.itv_flag === 'red') setBgColor(flagCell, COLORS.LIGHT_RED);
      else if (bldg.itv_flag === 'yellow') setBgColor(flagCell, COLORS.LIGHT_YELLOW);
      else setBgColor(flagCell, COLORS.LIGHT_GREEN);

      dataRow++;
    }
  }

  [8, 8, 40, 18, 16, 14, 22, 12, 16, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: Flags & Referrals
// ─────────────────────────────────────────────────────────────────────────────
function buildTab6(ws: ExcelJS.Worksheet, flags: Flag[]): void {
  ws.name = '6. Flags & Referrals';
  addTitle(ws, 'FLAGS, REFERRALS & DECLINE TRIGGERS', 6);

  const headers = ['Flag Type', 'Category', 'Description', 'Location(s)', 'Source', 'Status'];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeader(ws, 2, headers.length);

  let dataRow = 3;
  const sorted = [...flags].sort((a, b) => {
    const order = { DECLINE: 0, REFERRAL: 1, INFO: 2 };
    return (order[a.flag_type] ?? 3) - (order[b.flag_type] ?? 3);
  });

  for (const flag of sorted) {
    const row = ws.getRow(dataRow);

    [
      flag.flag_type,
      flag.category,
      flag.description,
      flag.locations_affected.length > 0 ? `Loc ${flag.locations_affected.join(', ')}` : 'All / Portfolio',
      flag.source,
      'Auto-flagged',
    ].forEach((v, i) => {
      row.getCell(i + 1).value = v as ExcelJS.CellValue;
      row.getCell(i + 1).font = { name: FONT };
    });

    // Color by type
    const typeCell = row.getCell(1);
    if (flag.flag_type === 'DECLINE') setBgColor(typeCell, COLORS.LIGHT_RED);
    else if (flag.flag_type === 'REFERRAL') setBgColor(typeCell, COLORS.LIGHT_YELLOW);
    else setBgColor(typeCell, COLORS.LIGHT_GRAY);

    dataRow++;
  }

  if (sorted.length === 0) {
    const row = ws.getRow(dataRow);
    row.getCell(1).value = 'No flags generated';
    row.getCell(1).font = { name: FONT, italic: true };
    setBgColor(row.getCell(1), COLORS.LIGHT_GREEN);
  }

  [14, 18, 60, 20, 16, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7: Checklist
// ─────────────────────────────────────────────────────────────────────────────
function buildTab7(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '7. Checklist';
  addTitle(ws, 'SUBMISSION COMPLETENESS CHECKLIST', 3);

  const headers = ['Document / Item', 'Status', 'Notes'];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeader(ws, 2, headers.length);

  const cl = sub.checklist;
  const items: [string, string, string][] = [
    ['ACORD 125 (Commercial Application)', cl.acord_125, ''],
    ['ACORD 140 (Property Section)', cl.acord_140, ''],
    ['Statement of Values (SOV)', cl.sov, ''],
    ['5-Year Loss Runs (within 90 days)', cl.loss_runs, cl.loss_runs === 'stale' ? 'Loss runs are older than 90 days' : ''],
    ['GL Supplemental Application', cl.gl_supplemental, sub.occupancy_type === 'conventional_mf' ? 'N/A for conventional MF' : ''],
    ['Prior Policy Declarations', cl.prior_dec_page, ''],
    ['Rent Roll / Operating Statement', cl.rent_roll, ''],
    ['Property Inspection Reports', cl.inspection_report, ''],
    ['Property Photos', cl.photos, ''],
    ['Signed SOV (required for binding)', 'missing', 'Required pre-bind'],
    ['Terrorism Selection/Rejection Form', 'missing', 'Required pre-bind'],
    ['OFAC Check', 'missing', 'Compliance - manual check required pre-bind'],
  ];

  let row = 3;
  for (const [item, status, notes] of items) {
    const dataRow = ws.getRow(row);
    dataRow.getCell(1).value = item;
    dataRow.getCell(2).value = status.toUpperCase();
    dataRow.getCell(3).value = notes;
    [1, 2, 3].forEach((c) => { dataRow.getCell(c).font = { name: FONT }; });

    const statusCell = dataRow.getCell(2);
    if (status === 'received') setBgColor(statusCell, COLORS.LIGHT_GREEN);
    else if (status === 'missing') setBgColor(statusCell, COLORS.LIGHT_RED);
    else if (status === 'stale') setBgColor(statusCell, COLORS.LIGHT_YELLOW);
    else if (status === 'na') setBgColor(statusCell, COLORS.LIGHT_GRAY);

    row++;
  }

  [50, 16, 45].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 8: Competitive Comps
// ─────────────────────────────────────────────────────────────────────────────
function buildTab8(ws: ExcelJS.Worksheet, sub: Submission): void {
  ws.name = '8. Competitive Comps';
  addTitle(ws, 'COMPETITIVE POSITIONING — HABGEN vs. MARKET', 4);

  const headers = ['Metric', 'HABGEN (Quoted)', 'Preiss Benchmark', 'Market Average (Est.)'];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeader(ws, 2, headers.length);

  const propRate = sub.premium_summary.blended_property_rate;
  const glRatePerUnit = sub.premium_summary.blended_gl_rate_per_unit;

  const rows: [string, string, string, string][] = [
    ['Property Rate (per $100 TIV)', `$${propRate.toFixed(4)}`, '$0.40–$0.50', '$0.35–$0.45'],
    ['Property Deductible (AOP)', '$25,000', '$250K base / $100K via DPP', '$50K–$100K'],
    ['Wind/Hail Deductible', '2% (up to 5% named storm)', '2–5%', '2–5%'],
    ['GL Rate (per unit)', `$${glRatePerUnit.toFixed(2)}`, '$160/unit', '$120–$150/unit'],
    ['GL SIR', '$0 (first-dollar)', '$100,000', '$25K–$50K'],
    ['A&B Sublimit', '$100K/$200K', 'Varies', '$50K–$100K'],
    ['SAM Sublimit', '$100K', 'Varies', '$25K–$50K'],
    ['Ordinance & Law', '25%', '10–25%', '10–25%'],
    ['Business Income', '12 months / 72-hr waiting period', 'Varies', 'Varies'],
    ['Equipment Breakdown', '$25,000 sublimit', 'Varies', 'Included/excluded varies'],
    ['Flood Coverage', 'Sublimit $500K (no SFHA)', 'Excluded', 'Excluded or sublimit'],
    ['Earthquake Coverage', 'Sublimit $500K (no CA)', 'Excluded', 'Excluded or sublimit'],
    ['HABGEN Advantage', '38–50% lower property rate, first-dollar GL, lower deductible', '—', '—'],
  ];

  let row = 3;
  for (const [metric, habgen, preiss, market] of rows) {
    const dataRow = ws.getRow(row);
    [metric, habgen, preiss, market].forEach((v, i) => {
      dataRow.getCell(i + 1).value = v;
      dataRow.getCell(i + 1).font = { name: FONT, bold: i === 0 };
    });

    if (metric === 'HABGEN Advantage') {
      setBgColor(dataRow.getCell(2), COLORS.LIGHT_GREEN);
    }

    row++;
  }

  [40, 28, 28, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWorkbook(
  submission: Submission,
  strengths: string[],
  concerns: string[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HABGEN Underwriting Engine';
  wb.created = new Date();

  // Build all 8 tabs
  buildTab1(wb.addWorksheet('1'), submission, strengths, concerns);
  buildTab2(wb.addWorksheet('2'), submission);
  buildTab3(wb.addWorksheet('3'), submission);
  buildTab4(wb.addWorksheet('4'), submission);
  buildTab5(wb.addWorksheet('5'), submission);
  buildTab6(wb.addWorksheet('6'), submission.flags);
  buildTab7(wb.addWorksheet('7'), submission);
  buildTab8(wb.addWorksheet('8'), submission);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
