// ============================================================
// RentCast API Client
// Replaces brittle web scrapers with reliable API data
// Docs: https://developers.rentcast.io/reference
// ============================================================

import {
  RentScraper,
  ScraperSearchParams,
  ScraperResult,
  ScrapedComp,
  UnitType,
} from './types';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

function getApiKey(): string {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error('RENTCAST_API_KEY not set in environment');
  return key;
}

function bedsToUnitType(beds: number): UnitType {
  if (beds === 0) return 'studio';
  if (beds === 1) return '1br';
  if (beds === 2) return '2br';
  if (beds === 3) return '3br';
  if (beds === 4) return '4br';
  return '5br+';
}

interface RentCastComp {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  price?: number;
  status?: string;
  listedDate?: string;
  lastSeenDate?: string;
  daysOnMarket?: number;
  distance?: number;
  correlation?: number;
  lotSize?: number;
}

interface RentEstimateResponse {
  rent?: number;
  rentRangeLow?: number;
  rentRangeHigh?: number;
  comparables?: RentCastComp[];
}

async function fetchRentCast(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${RENTCAST_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Api-Key': getApiKey(),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`RentCast API ${res.status}: ${body || res.statusText}`);
  }

  return res.json();
}

function compToScrapedComp(comp: RentCastComp, source: string): ScrapedComp | null {
  const rent = comp.price;
  const beds = comp.bedrooms ?? 0;
  if (!rent || rent <= 0) return null;

  const effectiveBeds = beds === 0 ? 1 : beds; // studios count as 1 for per-bed calc

  return {
    source: 'rentcast' as ScrapedComp['source'],
    propertyName: comp.formattedAddress || comp.addressLine1 || 'Unknown',
    address: comp.formattedAddress || '',
    lat: comp.latitude,
    lng: comp.longitude,
    yearBuilt: comp.yearBuilt,
    unitType: bedsToUnitType(beds),
    beds,
    baths: comp.bathrooms,
    sqft: comp.squareFootage,
    rent,
    rentPerBed: Math.round(rent / effectiveBeds),
    rentPerSqft: comp.squareFootage ? Math.round((rent / comp.squareFootage) * 100) / 100 : undefined,
    listingUrl: undefined,
    rawData: { rentcastId: comp.id, distance: comp.distance, correlation: comp.correlation, source },
  };
}

// Fetch rent estimate + comparables for a location
async function fetchRentComps(params: ScraperSearchParams): Promise<ScrapedComp[]> {
  const comps: ScrapedComp[] = [];

  // Query for multiple bedroom counts to get a full market picture
  const bedCounts = [0, 1, 2, 3, 4];

  for (const beds of bedCounts) {
    try {
      const queryParams: Record<string, string> = {
        bedrooms: String(beds),
        compCount: '10',
      };

      if (params.lat && params.lng) {
        queryParams.latitude = String(params.lat);
        queryParams.longitude = String(params.lng);
      } else {
        // Use city/state as a general address
        queryParams.address = `${params.city}, ${params.state}`;
      }

      if (params.radiusMiles) {
        queryParams.maxRadius = String(params.radiusMiles);
      }

      const data = await fetchRentCast('/avm/rent/long-term', queryParams) as RentEstimateResponse;

      if (data.comparables) {
        for (const comp of data.comparables) {
          const scraped = compToScrapedComp(comp, 'avm-comparable');
          if (scraped) comps.push(scraped);
        }
      }
    } catch (err) {
      // Some bedroom counts may not have data — that's fine, continue
      console.warn(`[rentcast] No AVM data for ${beds}br:`, err instanceof Error ? err.message : err);
    }
  }

  return comps;
}

// Fetch active rental listings for a location
async function fetchRentalListings(params: ScraperSearchParams): Promise<ScrapedComp[]> {
  const comps: ScrapedComp[] = [];

  try {
    const queryParams: Record<string, string> = {
      status: 'Active',
      limit: String(params.maxResults || 50),
    };

    if (params.lat && params.lng) {
      queryParams.latitude = String(params.lat);
      queryParams.longitude = String(params.lng);
      queryParams.radius = String(params.radiusMiles || 5);
    } else {
      queryParams.city = params.city;
      queryParams.state = params.state;
    }

    const data = await fetchRentCast('/listings/rental/long-term', queryParams) as RentCastComp[];

    if (Array.isArray(data)) {
      for (const listing of data) {
        const scraped = compToScrapedComp(listing, 'listing');
        if (scraped) comps.push(scraped);
      }
    }
  } catch (err) {
    console.warn('[rentcast] Listings fetch failed:', err instanceof Error ? err.message : err);
  }

  return comps;
}

// Deduplicate comps by address
function deduplicateComps(comps: ScrapedComp[]): ScrapedComp[] {
  const seen = new Set<string>();
  return comps.filter(c => {
    const key = `${c.address}|${c.beds}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const rentcastScraper: RentScraper = {
  source: 'rentcast' as ScrapedComp['source'],
  async scrape(params: ScraperSearchParams): Promise<ScraperResult> {
    const allComps: ScrapedComp[] = [];

    try {
      // Fetch from both endpoints in parallel
      const [avmComps, listingComps] = await Promise.allSettled([
        fetchRentComps(params),
        fetchRentalListings(params),
      ]);

      if (avmComps.status === 'fulfilled') allComps.push(...avmComps.value);
      if (listingComps.status === 'fulfilled') allComps.push(...listingComps.value);

      const dedupedComps = deduplicateComps(allComps);

      const errors: string[] = [];
      if (avmComps.status === 'rejected') errors.push(`AVM: ${avmComps.reason?.message}`);
      if (listingComps.status === 'rejected') errors.push(`Listings: ${listingComps.reason?.message}`);

      console.log(`[rentcast] Fetched ${dedupedComps.length} comps (${avmComps.status === 'fulfilled' ? avmComps.value.length : 0} AVM + ${listingComps.status === 'fulfilled' ? listingComps.value.length : 0} listings, after dedup)`);

      return {
        source: 'rentcast' as ScrapedComp['source'],
        comps: dedupedComps,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[rentcast] Scraper error: ${message}`);
      return {
        source: 'rentcast' as ScrapedComp['source'],
        comps: allComps,
        error: message,
        scrapedAt: new Date().toISOString(),
      };
    }
  },
};
