// ============================================================
// Google Places API – Enrich comps with ratings & website
// Uses the Places API (New) Text Search endpoint
// ============================================================

import { ScrapedComp } from './types';

const PLACES_BASE = 'https://places.googleapis.com/v1/places:searchText';

function getApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || null;
}

interface PlaceResult {
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
}

interface PlacesResponse {
  places?: PlaceResult[];
}

async function searchPlace(query: string, apiKey: string): Promise<PlaceResult | null> {
  const res = await fetch(PLACES_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.websiteUri',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[google-places] API ${res.status}: ${body}`);
    return null;
  }

  const data = (await res.json()) as PlacesResponse;
  return data.places?.[0] ?? null;
}

/**
 * Enrich scraped comps with Google Places rating and website.
 * Deduplicates lookups by address so each unique address is only queried once.
 * Gracefully skips if GOOGLE_PLACES_API_KEY is not set.
 */
export async function enrichWithGooglePlaces(comps: ScrapedComp[]): Promise<ScrapedComp[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[google-places] GOOGLE_PLACES_API_KEY not set, skipping enrichment');
    return comps;
  }

  if (comps.length === 0) return comps;

  // Group comps by address to deduplicate API calls
  const addressMap = new Map<string, PlaceResult | null>();
  const uniqueAddresses = Array.from(new Set(comps.map(c => c.address).filter(Boolean)));

  console.log(`[google-places] Enriching ${uniqueAddresses.length} unique addresses...`);

  for (const addr of uniqueAddresses) {
    try {
      const result = await searchPlace(addr, apiKey);
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
      googleReviewCount: place.userRatingCount ?? undefined,
      propertyWebsite: place.websiteUri ?? undefined,
    };
  });
}
