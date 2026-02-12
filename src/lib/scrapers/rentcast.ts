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

interface RentCastListing {
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

async function fetchRentCast(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${RENTCAST_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  console.log(`[rentcast] GET ${url.pathname}?${url.searchParams.toString()}`);

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

function listingToComp(listing: RentCastListing): ScrapedComp | null {
  const rent = listing.price;
  const beds = listing.bedrooms ?? 0;
  if (!rent || rent <= 0) return null;

  const effectiveBeds = beds === 0 ? 1 : beds; // studios count as 1 for per-bed calc

  return {
    source: 'rentcast',
    propertyName: listing.formattedAddress || listing.addressLine1 || 'Unknown',
    address: listing.formattedAddress || '',
    lat: listing.latitude,
    lng: listing.longitude,
    yearBuilt: listing.yearBuilt,
    unitType: bedsToUnitType(beds),
    beds,
    baths: listing.bathrooms,
    sqft: listing.squareFootage,
    rent,
    rentPerBed: Math.round(rent / effectiveBeds),
    rentPerSqft: listing.squareFootage ? Math.round((rent / listing.squareFootage) * 100) / 100 : undefined,
    listingUrl: undefined,
    rawData: { rentcastId: listing.id, distance: listing.distance, correlation: listing.correlation },
  };
}

// Fetch active rental listings for a location using /listings/rental/long-term
// This endpoint supports city/state, lat/lng, and zipCode searches.
async function fetchRentalListings(params: ScraperSearchParams): Promise<ScrapedComp[]> {
  const queryParams: Record<string, string> = {
    status: 'Active',
    limit: '500',
  };

  // Prefer lat/lng with radius (most precise for campus-area searches)
  if (params.lat && params.lng) {
    queryParams.latitude = String(params.lat);
    queryParams.longitude = String(params.lng);
    queryParams.radius = String(params.radiusMiles || 5);
  } else {
    // Fall back to city/state
    queryParams.city = params.city;
    queryParams.state = params.state;
  }

  // Filter to residential rental types relevant for student housing
  queryParams.propertyType = 'Single Family|Condo|Townhouse|Apartment';

  const data = await fetchRentCast('/listings/rental/long-term', queryParams) as RentCastListing[];

  if (!Array.isArray(data)) {
    console.warn('[rentcast] Unexpected response format:', typeof data);
    return [];
  }

  const comps: ScrapedComp[] = [];
  for (const listing of data) {
    const comp = listingToComp(listing);
    if (comp) comps.push(comp);
  }

  console.log(`[rentcast] Got ${data.length} listings, ${comps.length} with valid rent data`);
  return comps;
}

// Deduplicate comps by address + bed count
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
  source: 'rentcast',
  async scrape(params: ScraperSearchParams): Promise<ScraperResult> {
    try {
      const comps = await fetchRentalListings(params);
      const dedupedComps = deduplicateComps(comps);

      console.log(`[rentcast] Final: ${dedupedComps.length} comps (${comps.length} before dedup)`);

      return {
        source: 'rentcast',
        comps: dedupedComps,
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[rentcast] Scraper error: ${message}`);
      return {
        source: 'rentcast',
        comps: [],
        error: message,
        scrapedAt: new Date().toISOString(),
      };
    }
  },
};
