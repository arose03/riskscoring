// ============================================================
// Google Places API – Enrich comps with ratings & website
// Uses the legacy Places API (Find Place) with the same
// GOOGLE_MAPS_API_KEY already used for geocoding.
// ============================================================

import { ScrapedComp } from './types';

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

interface PlaceCandidate {
  rating?: number;
  user_ratings_total?: number;
  website?: string;
}

interface FindPlaceResponse {
  status: string;
  candidates?: PlaceCandidate[];
}

async function findPlace(query: string, apiKey: string): Promise<PlaceCandidate | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'rating,user_ratings_total,website');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[google-places] API ${res.status}: ${body}`);
    return null;
  }

  const data = (await res.json()) as FindPlaceResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`[google-places] API status: ${data.status}`);
    return null;
  }

  return data.candidates?.[0] ?? null;
}

/**
 * Enrich scraped comps with Google Places rating and website.
 * Deduplicates lookups by address so each unique address is only queried once.
 * Uses GOOGLE_MAPS_API_KEY (same key as geocoding). Skips if not set.
 */
export async function enrichWithGooglePlaces(comps: ScrapedComp[]): Promise<ScrapedComp[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[google-places] GOOGLE_MAPS_API_KEY not set, skipping enrichment');
    return comps;
  }

  if (comps.length === 0) return comps;

  // Group comps by address to deduplicate API calls
  const addressMap = new Map<string, PlaceCandidate | null>();
  const uniqueAddresses = Array.from(new Set(comps.map(c => c.address).filter(Boolean)));

  console.log(`[google-places] Enriching ${uniqueAddresses.length} unique addresses...`);

  for (const addr of uniqueAddresses) {
    try {
      const result = await findPlace(addr, apiKey);
      addressMap.set(addr, result);
      // Small delay to avoid rate limiting
      if (uniqueAddresses.length > 5) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.warn(`[google-places] Failed to look up "${addr}":`, err);
      addressMap.set(addr, null);
    }
  }

  const enrichedCount = Array.from(addressMap.values()).filter(v => v?.rating != null).length;
  console.log(`[google-places] Found ratings for ${enrichedCount}/${uniqueAddresses.length} addresses`);

  // Apply results back to comps
  return comps.map(comp => {
    const place = addressMap.get(comp.address);
    if (!place) return comp;
    return {
      ...comp,
      googleRating: place.rating ?? undefined,
      googleReviewCount: place.user_ratings_total ?? undefined,
      propertyWebsite: place.website ?? undefined,
    };
  });
}
