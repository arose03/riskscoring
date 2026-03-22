import { callLLMJSON } from '../llm/client';
import { SOV_COLUMN_MAPPER_SYSTEM, SOV_ROW_EXTRACTOR_SYSTEM, CONSTRUCTION_NORMALIZER_SYSTEM } from '../llm/prompts';
import { RawBuildingData, ConstructionType } from '../types/submission';

// Construction type normalization map (fast path)
const CONSTRUCTION_MAP: Record<string, ConstructionType> = {
  // FRAME
  frame: 'FRAME',
  'wood frame': 'FRAME',
  wood: 'FRAME',
  'type v': 'FRAME',
  'type 5': 'FRAME',
  'stucco/frame': 'FRAME',
  'wood/stucco': 'FRAME',
  'combustible frame': 'FRAME',
  'frame construction': 'FRAME',
  stucco: 'FRAME',
  // JM
  'joisted masonry': 'JM',
  jm: 'JM',
  'brick/wood': 'JM',
  'masonry/wood': 'JM',
  'type iii': 'JM',
  'type 3': 'JM',
  'brick veneer': 'JM',
  'masonry/joisted': 'JM',
  brick: 'JM',
  masonry: 'JM',
  // NC
  'non-combustible': 'NC',
  'non combustible': 'NC',
  nc: 'NC',
  concrete: 'NC',
  steel: 'NC',
  'concrete/steel': 'NC',
  'type ii': 'NC',
  'type 2': 'NC',
  'tilt-up': 'NC',
  'tilt up': 'NC',
  precast: 'NC',
  metal: 'NC',
  'concrete block': 'NC',
  cmu: 'NC',
  'concrete masonry': 'NC',
  // FR
  'fire resistive': 'FR',
  fr: 'FR',
  'reinforced concrete': 'FR',
  'type i': 'FR',
  'type 1': 'FR',
  'poured concrete': 'FR',
  'cast-in-place': 'FR',
  'cast in place': 'FR',
};

export function normalizeConstructionType(raw: string | undefined): ConstructionType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  // Direct lookup
  if (CONSTRUCTION_MAP[lower]) return CONSTRUCTION_MAP[lower];

  // Partial match
  for (const [key, value] of Object.entries(CONSTRUCTION_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  return null;
}

export async function normalizeConstructionTypeLLM(raw: string): Promise<ConstructionType> {
  try {
    const result = await callLLMJSON<{ normalized: string }>(
      CONSTRUCTION_NORMALIZER_SYSTEM,
      `Construction description to normalize: "${raw}"`
    );
    const normalized = result.normalized?.toUpperCase();
    if (['FRAME', 'JM', 'NC', 'FR'].includes(normalized)) {
      return normalized as ConstructionType;
    }
  } catch {
    // fall through to default
  }
  return 'FRAME'; // Default to most conservative
}

// Parse SOV from CSV text (rows already separated)
export async function parseSOVFromCSV(csvText: string): Promise<RawBuildingData[]> {
  try {
    const result = await callLLMJSON<RawBuildingData[]>(
      SOV_ROW_EXTRACTOR_SYSTEM,
      `Parse this SOV data and extract building records:\n\n${csvText.substring(0, 10000)}`
    );
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('SOV CSV parse error:', err);
    return [];
  }
}

// Parse SOV from structured Excel data (array of row objects)
export async function parseSOVFromRows(
  headers: string[],
  rows: Record<string, string | number | null>[]
): Promise<RawBuildingData[]> {
  // First, map columns
  const headerStr = headers.join(', ');
  let columnMap: Record<string, string> = {};

  try {
    columnMap = await callLLMJSON<Record<string, string>>(
      SOV_COLUMN_MAPPER_SYSTEM,
      `Map these column headers to standard fields:\n${headerStr}`
    );
  } catch {
    console.error('Column mapping failed, using direct parse');
  }

  const buildings: RawBuildingData[] = [];

  for (const row of rows) {
    const building: RawBuildingData = {};
    let hasData = false;

    for (const [colHeader, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;

      const stdField = columnMap[colHeader] ?? guessField(colHeader);
      if (!stdField) continue;

      hasData = true;
      mapFieldToBuilding(building, stdField, String(value));
    }

    if (hasData && (building.address || building.building_value || building.total_insured_value)) {
      buildings.push(building);
    }
  }

  return buildings;
}

function guessField(header: string): string | null {
  const lower = header.toLowerCase().trim();
  const guesses: [string[], string][] = [
    [['loc #', 'loc#', 'location #', 'location#', 'loc num', 'location number'], 'location_number'],
    [['bldg #', 'bldg#', 'building #', 'building#', 'bldg num'], 'building_number'],
    [['address', 'street', 'property address', 'street address'], 'address'],
    [['city'], 'city'],
    [['state', 'st'], 'state'],
    [['zip', 'zip code', 'postal'], 'zip'],
    [['county'], 'county'],
    [['year built', 'yr built', 'const year', 'yoc', 'year of construction'], 'year_built'],
    [['year renovated', 'rehab year', 'renovation', 'year rehabbed'], 'year_renovated'],
    [['stories', 'floors', '# stories', '# floors', 'num floors'], 'stories'],
    [['units', '# units', 'unit count', 'num units'], 'num_units'],
    [['beds', 'bed count', '# beds'], 'num_beds'],
    [['sq ft', 'sqft', 'square footage', 'gla', 'nra', 'sf', 'gross area'], 'square_footage'],
    [['construction', 'const type', 'const class', 'frame/masonry', 'constr'], 'construction_type'],
    [['sprinkler', 'sprinklered', 'fire suppression', 'sprink'], 'sprinkler_status'],
    [['pc', 'prot class', 'protection class'], 'protection_class'],
    [['building value', 'bldg value', 'rc building', 'replacement cost bldg'], 'building_value'],
    [['bpp', 'contents', 'personal property', 'business personal property'], 'bpp_value'],
    [['bi', 'business income', 'rental income', 'bi/ee', 'loss of rents'], 'bi_value'],
    [['tiv', 'total insured value', 'total value', 'grand total', 'total'], 'total_insured_value'],
    [['occupancy', 'occ type', 'use', 'occ'], 'occupancy'],
    [['roof type', 'roof material', 'roof cover', 'roofing'], 'roof_type'],
    [['roof year', 'year roofed', 'roof age', 'roof replaced', 'roof update'], 'roof_year'],
    [['electrical update', 'wiring year', 'elec update', 'electrical year', 'electric'], 'electrical_year'],
    [['plumbing update', 'plumbing year', 'plumbing', 'plumb'], 'plumbing_year'],
    [['hvac update', 'hvac year', 'hvac', 'mechanical'], 'hvac_year'],
  ];

  for (const [patterns, field] of guesses) {
    if (patterns.some((p) => lower === p || lower.includes(p))) {
      return field;
    }
  }
  return null;
}

function mapFieldToBuilding(building: RawBuildingData, field: string, value: string): void {
  const numericFields = [
    'location_number', 'building_number', 'year_built', 'year_renovated',
    'stories', 'num_units', 'num_beds', 'square_footage', 'protection_class',
    'building_value', 'bpp_value', 'bi_value', 'total_insured_value',
    'roof_year', 'electrical_year', 'plumbing_year', 'hvac_year'
  ];

  const cleanValue = value.replace(/[$,\s]/g, '').replace(/[^\d.]/g, '');

  if (numericFields.includes(field)) {
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (building as any)[field] = Math.round(num);
    }
  } else if (field === 'sprinkler_status') {
    const lower = value.toLowerCase().trim();
    building.sprinkler_status =
      lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1' || lower === 'x';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (building as any)[field] = value.trim();
  }
}

export async function normalizeSOVBuildings(
  rawBuildings: RawBuildingData[]
): Promise<RawBuildingData[]> {
  const normalized: RawBuildingData[] = [];

  for (const raw of rawBuildings) {
    const b = { ...raw };

    // Normalize construction type
    if (b.construction_type) {
      const normType = normalizeConstructionType(b.construction_type);
      if (normType) {
        b.construction_type = normType;
      } else {
        // Try LLM fallback for ambiguous types
        b.construction_type = await normalizeConstructionTypeLLM(b.construction_type);
      }
    }

    // Calculate TIV if not provided
    if (!b.total_insured_value && (b.building_value || b.bpp_value || b.bi_value)) {
      b.total_insured_value = (b.building_value ?? 0) + (b.bpp_value ?? 0) + (b.bi_value ?? 0);
    }

    // Default building number if not provided
    if (b.building_number == null) {
      b.building_number = 1;
    }

    normalized.push(b);
  }

  return normalized;
}
