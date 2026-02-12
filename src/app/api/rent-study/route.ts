import { NextRequest, NextResponse } from 'next/server';
import { createRentStudy, listRentStudies } from '@/lib/scrapers';

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
    const body = await req.json();
    const { marketName, city, state, centerLat, centerLng, radiusMiles, universityId, universityName } = body;

    if (!city || !state) {
      return NextResponse.json({ error: 'city and state are required' }, { status: 400 });
    }

    const study = await createRentStudy({
      marketName: marketName || `${city}, ${state}`,
      city,
      state,
      centerLat,
      centerLng,
      radiusMiles,
      universityId,
      universityName,
    });

    return NextResponse.json({ study });
  } catch (err) {
    console.error('Create rent study error:', err);
    return NextResponse.json(
      { error: 'Failed to create rent study', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
