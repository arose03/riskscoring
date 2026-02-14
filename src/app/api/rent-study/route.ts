import { NextRequest, NextResponse } from 'next/server';
import { createRentStudy, listRentStudies } from '@/lib/scrapers';
import { geocodeAddress } from '@/lib/geocode';

// GET /api/rent-study – List all rent studies
export async function GET() {
  try {
    const studies = listRentStudies();
    return NextResponse.json({ studies });
  } catch (err) {
    console.error('List rent studies error:', err);
    return NextResponse.json({ error: 'Failed to list rent studies' }, { status: 500 });
  }
}

// POST /api/rent-study – Create a new rent study (triggers scraping)
export async function POST(req: NextRequest) {
  try {
    // Pre-flight: ensure RentCast API key is configured
    if (!process.env.RENTCAST_API_KEY) {
      return NextResponse.json(
        { error: 'RENTCAST_API_KEY is not configured. Add it to your .env file to enable rent comp scraping.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { address, radiusMiles, universityId, universityName } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Geocode the address to get lat/lng
    const geo = await geocodeAddress(address);
    console.log(`[rent-study] Geocoded "${address}" -> ${geo.lat}, ${geo.lng} (${geo.displayName})`);

    const study = await createRentStudy({
      marketName: address,
      address,
      centerLat: geo.lat,
      centerLng: geo.lng,
      radiusMiles: radiusMiles || 1,
      universityId,
      universityName,
    });

    return NextResponse.json({ study });
  } catch (err) {
    console.error('Create rent study error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create rent study' },
      { status: 500 }
    );
  }
}
