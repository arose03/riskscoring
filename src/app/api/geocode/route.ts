import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SETUP_HINT =
  'Verify Google key setup: enable Geocoding API, ensure billing is active, and use a server key for GOOGLE_MAPS_API_KEY (IP/app restrictions are okay, HTTP referrer restrictions are not for server calls).';

export async function POST(req: NextRequest) {
  const { address } = await req.json();

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GOOGLE_MAPS_API_KEY is not set in environment variables. Add a server Google Maps key with Geocoding API enabled.',
      },
      { status: 500 }
    );
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let data: {
    status?: string;
    error_message?: string;
    results?: Array<{
      formatted_address: string;
      geometry: {
        location: {
          lat: number;
          lng: number;
        };
      };
    }>;
  };

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google geocoding request failed (${res.status})`, hint: GOOGLE_SETUP_HINT },
        { status: 502 }
      );
    }

    data = await res.json();
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Google geocoding request timed out after 10s' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Google geocoding request failed due to a network/runtime error' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (data.status !== 'OK' || !data.results?.length) {
    const error = `Geocoding failed: ${data.status}${data.error_message ? ` (${data.error_message})` : ''}`;
    const includeHint = data.status === 'REQUEST_DENIED' || data.status === 'OVER_DAILY_LIMIT';

    return NextResponse.json(
      includeHint ? { error, hint: GOOGLE_SETUP_HINT } : { error },
      { status: 400 }
    );
  }

  const result = data.results[0];
  return NextResponse.json({
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted_address: result.formatted_address,
  });
}
