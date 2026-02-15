// ============================================================
// Google Places – Enrich comps with ratings & website
// Uses Nearby Search (lat/lng based) to find the apartment complex
// near each comp, since RentCast returns individual unit addresses
// that don't map to Google Places business listings.
// ============================================================

import { ScrapedComp } from './types';

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

interface PlaceResult {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  website?: string;
  place_id?: string;
  types?: string[];
}

interface NearbySearchResponse {
  status: string;
  results?: PlaceResult[];
  error_message?: string;
}

interface PlaceDetailsResponse {
  status: string;
  result?: PlaceResult;
  error_message?: string;
}

// Find the nearest apartment/property business at given coordinates
async function nearbySearch(lat: number, lng: number, apiKey: string): Promise<PlaceResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '100'); // 100m radius — same building
  url.searchParams.set('type', 'real_estate_agency');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    console.warn(`[google-places] Nearby search HTTP ${res.status}`);
    return null;
  }

  const data = (await res.json()) as NearbySearchResponse;

  if (data.error_message) {
    console.warn(`[google-places] Nearby search error: ${data.error_message}`);
    return null;
  }

  // If no real_estate_agency, try broader search for any establishment
  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    const url2 = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url2.searchParams.set('location', `${lat},${lng}`);
    url2.searchParams.set('radius', '100');
    url2.searchParams.set('keyword', 'apartment');
    url2.searchParams.set('key', apiKey);

    const res2 = await fetch(url2.toString(), { cache: 'no-store' });
    if (!res2.ok) return null;
    const data2 = (await res2.json()) as NearbySearchResponse;
    if (data2.status !== 'OK' || !data2.results?.length) return null;
    return data2.results[0];
  }

  if (data.status !== 'OK') return null;
  return data.results[0];
}

// Get the website for a place (Nearby Search doesn't return it)
async function getPlaceDetails(placeId: string, apiKey: string): Promise<{ website?: string } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'website');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as PlaceDetailsResponse;
  if (data.status !== 'OK' || !data.result) return null;
  return { website: data.result.website };
}

/**
 * Enrich scraped comps with Google Places rating and website.
 * Groups comps by location (~100m clusters) so each unique building
 * only triggers one API lookup. Uses GOOGLE_MAPS_API_KEY.
 */
export async function enrichWithGooglePlaces(comps: ScrapedComp[]): Promise<ScrapedComp[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[google-places] GOOGLE_MAPS_API_KEY not set, skipping enrichment');
    return comps;
  }

  if (comps.length === 0) return comps;

  // Group comps by rounded lat/lng (~100m precision) to deduplicate
  // Comps in the same building share the same cluster key
  const clusterKey = (lat: number, lng: number) =>
    `${(Math.round(lat * 1000) / 1000).toFixed(3)},${(Math.round(lng * 1000) / 1000).toFixed(3)}`;

  const clusters = new Map<string, { lat: number; lng: number }>();
  for (const comp of comps) {
    if (comp.lat && comp.lng) {
      const key = clusterKey(comp.lat, comp.lng);
      if (!clusters.has(key)) {
        clusters.set(key, { lat: comp.lat, lng: comp.lng });
      }
    }
  }

  console.log(`[google-places] Looking up ${clusters.size} unique locations for ${comps.length} comps...`);

  // Look up each cluster
  const results = new Map<string, { rating?: number; reviewCount?: number; website?: string }>();

  for (const [key, coords] of Array.from(clusters.entries())) {
    try {
      const place = await nearbySearch(coords.lat, coords.lng, apiKey);
      if (place && (place.rating || place.place_id)) {
        let website: string | undefined;
        // Nearby Search doesn't return website — need a Place Details call
        if (place.place_id) {
          const details = await getPlaceDetails(place.place_id, apiKey);
          website = details?.website;
        }
        results.set(key, {
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          website,
        });
        console.log(`[google-places] ${key} -> ${place.name}: ${place.rating} stars (${place.user_ratings_total} reviews)`);
      }
      // Rate limit protection
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.warn(`[google-places] Failed lookup for ${key}:`, err);
    }
  }

  console.log(`[google-places] Found data for ${results.size}/${clusters.size} locations`);

  // Apply results back to comps
  return comps.map(comp => {
    if (!comp.lat || !comp.lng) return comp;
    const key = clusterKey(comp.lat, comp.lng);
    const data = results.get(key);
    if (!data) return comp;
    return {
      ...comp,
      googleRating: data.rating ?? undefined,
      googleReviewCount: data.reviewCount ?? undefined,
      propertyWebsite: data.website ?? undefined,
    };
  });
}
