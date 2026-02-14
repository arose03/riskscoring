// Geocode an address to lat/lng
// Primary: US Census Geocoder (free, no API key, reliable for US addresses)
// Fallback: OpenStreetMap Nominatim

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

// US Census Bureau Geocoder — most reliable for US addresses
async function geocodeCensus(address: string): Promise<GeocodeResult | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return null;

  const data = await res.json();
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;

  const match = matches[0];
  return {
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    displayName: match.matchedAddress,
  };
}

// Nominatim fallback
async function geocodeNominatim(address: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'RiskScoring/1.0',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  // Try Census geocoder first (most reliable for US addresses)
  const censusResult = await geocodeCensus(address).catch(() => null);
  if (censusResult) return censusResult;

  // Fall back to Nominatim
  const nominatimResult = await geocodeNominatim(address).catch(() => null);
  if (nominatimResult) return nominatimResult;

  throw new Error(`Could not find coordinates for "${address}". Check the address and try again.`);
}
