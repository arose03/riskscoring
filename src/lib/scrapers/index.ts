// ============================================================
// Rent Comp Scraper – Orchestrator
// Runs all scrapers in parallel and aggregates results
// ============================================================

import { getDb } from '../db';
import { haversineDistance } from '../scoring';
import { apartmentsScraper } from './apartments';
import { zillowScraper } from './zillow';
import { rentcafeScraper } from './rentcafe';
import {
  RentScraper,
  ScraperSearchParams,
  ScrapedComp,
  ScraperResult,
  RentStudy,
  RentStudySummary,
  RentComp,
  UnitType,
} from './types';

const ALL_SCRAPERS: RentScraper[] = [
  apartmentsScraper,
  zillowScraper,
  rentcafeScraper,
];

// Run all scrapers concurrently and return combined results
export async function runAllScrapers(params: ScraperSearchParams): Promise<ScraperResult[]> {
  const results = await Promise.allSettled(
    ALL_SCRAPERS.map(scraper => scraper.scrape(params))
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      source: ALL_SCRAPERS[i].source,
      comps: [],
      error: result.reason?.message || 'Scraper failed',
      scrapedAt: new Date().toISOString(),
    };
  });
}

// Compute summary statistics for a set of comps
export function computeRentSummary(comps: Array<{ rentPerBed: number | null; rent: number | null; unitType: string | null; source: string; propertyName: string }>): RentStudySummary {
  const validComps = comps.filter(c => c.rentPerBed != null && c.rent != null);

  const allRentsPerBed = validComps.map(c => c.rentPerBed!).sort((a, b) => a - b);
  const allRents = validComps.map(c => c.rent!).sort((a, b) => a - b);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // By unit type breakdown
  const unitTypes: UnitType[] = ['studio', '1br', '2br', '3br', '4br', '5br+'];
  const byUnitType: RentStudySummary['byUnitType'] = {} as RentStudySummary['byUnitType'];
  for (const ut of unitTypes) {
    const utComps = validComps.filter(c => c.unitType === ut);
    const utRpb = utComps.map(c => c.rentPerBed!).sort((a, b) => a - b);
    const utRents = utComps.map(c => c.rent!);
    byUnitType[ut] = {
      count: utComps.length,
      avgRent: Math.round(avg(utRents)),
      avgRentPerBed: Math.round(avg(utRpb)),
      minRentPerBed: utRpb.length > 0 ? utRpb[0] : 0,
      maxRentPerBed: utRpb.length > 0 ? utRpb[utRpb.length - 1] : 0,
    };
  }

  // By source
  const bySource: Record<string, number> = {};
  for (const c of validComps) {
    bySource[c.source] = (bySource[c.source] || 0) + 1;
  }

  // Unique properties
  const uniqueProps = new Set(validComps.map(c => c.propertyName));

  return {
    totalComps: validComps.length,
    totalProperties: uniqueProps.size,
    avgRentPerBed: Math.round(avg(allRentsPerBed)),
    medianRentPerBed: Math.round(median(allRentsPerBed)),
    minRentPerBed: allRentsPerBed.length > 0 ? allRentsPerBed[0] : 0,
    maxRentPerBed: allRentsPerBed.length > 0 ? allRentsPerBed[allRentsPerBed.length - 1] : 0,
    avgRent: Math.round(avg(allRents)),
    medianRent: Math.round(median(allRents)),
    byUnitType,
    bySource,
  };
}

// Create a new rent study, run scrapers, and save results
export async function createRentStudy(params: {
  marketName: string;
  city: string;
  state: string;
  centerLat?: number;
  centerLng?: number;
  radiusMiles?: number;
  universityId?: number;
  universityName?: string;
}): Promise<RentStudy> {
  const db = getDb();

  // Insert rent study record
  const insert = db.prepare(`
    INSERT INTO rent_studies (market_name, center_lat, center_lng, radius_miles, university_id, university_name, status)
    VALUES (?, ?, ?, ?, ?, ?, 'scraping')
  `);
  const result = insert.run(
    params.marketName,
    params.centerLat || null,
    params.centerLng || null,
    params.radiusMiles || 5,
    params.universityId || null,
    params.universityName || null
  );
  const studyId = Number(result.lastInsertRowid);

  try {
    // Run all scrapers
    const scraperResults = await runAllScrapers({
      city: params.city,
      state: params.state,
      lat: params.centerLat,
      lng: params.centerLng,
      radiusMiles: params.radiusMiles,
      universityName: params.universityName,
    });

    // Insert comps into database
    const insertComp = db.prepare(`
      INSERT INTO rent_comps (
        rent_study_id, source, property_name, address, lat, lng,
        distance_from_campus, total_units, year_built,
        unit_type, beds, baths, sqft, rent, rent_per_bed, rent_per_sqft,
        furnished, has_pool, has_gym, has_parking, pet_friendly,
        listing_url, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((comps: ScrapedComp[]) => {
      for (const comp of comps) {
        // Calculate distance from campus if we have coordinates
        let distance: number | null = null;
        if (params.centerLat && params.centerLng && comp.lat && comp.lng) {
          distance = Math.round(haversineDistance(params.centerLat, params.centerLng, comp.lat, comp.lng) * 100) / 100;
        }

        insertComp.run(
          studyId,
          comp.source,
          comp.propertyName,
          comp.address || null,
          comp.lat || null,
          comp.lng || null,
          distance,
          comp.totalUnits || null,
          comp.yearBuilt || null,
          comp.unitType,
          comp.beds,
          comp.baths || null,
          comp.sqft || null,
          comp.rent,
          comp.rentPerBed,
          comp.rentPerSqft || null,
          comp.furnished ? 1 : 0,
          comp.hasPool ? 1 : 0,
          comp.hasGym ? 1 : 0,
          comp.hasParking ? 1 : 0,
          comp.petFriendly ? 1 : 0,
          comp.listingUrl || null,
          comp.rawData ? JSON.stringify(comp.rawData) : null
        );
      }
    });

    const allComps: ScrapedComp[] = [];
    const errors: string[] = [];
    for (const sr of scraperResults) {
      allComps.push(...sr.comps);
      if (sr.error) errors.push(`${sr.source}: ${sr.error}`);
    }

    insertMany(allComps);

    // Compute and save summary
    const summary = computeRentSummary(allComps.map(c => ({
      rentPerBed: c.rentPerBed,
      rent: c.rent,
      unitType: c.unitType,
      source: c.source,
      propertyName: c.propertyName,
    })));

    const status = allComps.length > 0 ? 'complete' : 'error';
    db.prepare('UPDATE rent_studies SET status = ?, summary = ? WHERE id = ?')
      .run(status, JSON.stringify(summary), studyId);

    return getRentStudy(studyId)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    db.prepare('UPDATE rent_studies SET status = ?, summary = ? WHERE id = ?')
      .run('error', JSON.stringify({ error: message }), studyId);
    throw err;
  }
}

// Get a rent study by ID with all its comps
export function getRentStudy(id: number): RentStudy | null {
  const db = getDb();
  const study = db.prepare('SELECT * FROM rent_studies WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!study) return null;

  const comps = db.prepare('SELECT * FROM rent_comps WHERE rent_study_id = ? ORDER BY rent_per_bed ASC').all(id) as Record<string, unknown>[];

  return {
    id: study.id as number,
    createdAt: study.created_at as string,
    marketName: study.market_name as string,
    centerLat: study.center_lat as number | null,
    centerLng: study.center_lng as number | null,
    radiusMiles: study.radius_miles as number,
    universityId: study.university_id as number | null,
    universityName: study.university_name as string | null,
    status: study.status as RentStudy['status'],
    summary: study.summary ? JSON.parse(study.summary as string) : null,
    comps: comps.map(c => ({
      id: c.id as number,
      rentStudyId: c.rent_study_id as number,
      source: c.source as RentComp['source'],
      propertyName: c.property_name as string,
      address: c.address as string | null,
      lat: c.lat as number | null,
      lng: c.lng as number | null,
      distanceFromCampus: c.distance_from_campus as number | null,
      totalUnits: c.total_units as number | null,
      yearBuilt: c.year_built as number | null,
      unitType: c.unit_type as RentComp['unitType'],
      beds: c.beds as number | null,
      baths: c.baths as number | null,
      sqft: c.sqft as number | null,
      rent: c.rent as number | null,
      rentPerBed: c.rent_per_bed as number | null,
      rentPerSqft: c.rent_per_sqft as number | null,
      furnished: !!(c.furnished as number),
      hasPool: !!(c.has_pool as number),
      hasGym: !!(c.has_gym as number),
      hasParking: !!(c.has_parking as number),
      petFriendly: !!(c.pet_friendly as number),
      listingUrl: c.listing_url as string | null,
      scrapedAt: c.scraped_at as string,
    })),
  };
}

// List all rent studies (most recent first)
export function listRentStudies(): Omit<RentStudy, 'comps'>[] {
  const db = getDb();
  const studies = db.prepare('SELECT * FROM rent_studies ORDER BY created_at DESC LIMIT 50').all() as Record<string, unknown>[];

  return studies.map(s => ({
    id: s.id as number,
    createdAt: s.created_at as string,
    marketName: s.market_name as string,
    centerLat: s.center_lat as number | null,
    centerLng: s.center_lng as number | null,
    radiusMiles: s.radius_miles as number,
    universityId: s.university_id as number | null,
    universityName: s.university_name as string | null,
    status: s.status as RentStudy['status'],
    summary: s.summary ? JSON.parse(s.summary as string) : null,
  }));
}

// Delete a rent study and its comps
export function deleteRentStudy(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM rent_studies WHERE id = ?').run(id);
  return result.changes > 0;
}

// Get rent comps summary for a specific market (for use in risk scorer)
export function getMarketRentData(universityName: string): { avgRentPerBed: number; medianRentPerBed: number; compCount: number } | null {
  const db = getDb();
  const study = db.prepare(`
    SELECT id, summary FROM rent_studies
    WHERE university_name = ? AND status = 'complete'
    ORDER BY created_at DESC LIMIT 1
  `).get(universityName) as Record<string, unknown> | undefined;

  if (!study || !study.summary) return null;

  const summary = JSON.parse(study.summary as string) as RentStudySummary;
  return {
    avgRentPerBed: summary.avgRentPerBed,
    medianRentPerBed: summary.medianRentPerBed,
    compCount: summary.totalComps,
  };
}
