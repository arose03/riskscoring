import { NextRequest, NextResponse } from 'next/server';
import { getMarketRentData } from '@/lib/scrapers';

// GET /api/rent-study/market-rent?university=University+Name
// Returns aggregated rent data from the most recent comp study for a university
export async function GET(req: NextRequest) {
  const universityName = req.nextUrl.searchParams.get('university');
  if (!universityName) {
    return NextResponse.json({ error: 'university parameter is required' }, { status: 400 });
  }

  try {
    const data = getMarketRentData(universityName);
    if (!data) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      avgRentPerBed: data.avgRentPerBed,
      medianRentPerBed: data.medianRentPerBed,
      compCount: data.compCount,
    });
  } catch (err) {
    console.error('Market rent data error:', err);
    return NextResponse.json({ error: 'Failed to get market rent data' }, { status: 500 });
  }
}
