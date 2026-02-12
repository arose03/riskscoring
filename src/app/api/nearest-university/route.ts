import { NextRequest, NextResponse } from 'next/server';
import { haversineDistance, distanceToScore } from '@/lib/scoring';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { propertyLat, propertyLng } = await req.json();

  if (!propertyLat || !propertyLng) {
    return NextResponse.json(
      { error: 'propertyLat and propertyLng are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const universities = db
    .prepare('SELECT * FROM universities WHERE campus_lat IS NOT NULL AND campus_lng IS NOT NULL')
    .all() as { id: number; name: string; tier: number; party_score: number; campus_lat: number; campus_lng: number }[];

  if (universities.length === 0) {
    return NextResponse.json(
      { error: 'No universities with campus coordinates found' },
      { status: 404 }
    );
  }

  // Find nearest university
  let nearest = universities[0];
  let nearestMiles = haversineDistance(propertyLat, propertyLng, nearest.campus_lat, nearest.campus_lng);

  for (let i = 1; i < universities.length; i++) {
    const uni = universities[i];
    const miles = haversineDistance(propertyLat, propertyLng, uni.campus_lat, uni.campus_lng);
    if (miles < nearestMiles) {
      nearest = uni;
      nearestMiles = miles;
    }
  }

  const roundedMiles = Math.round(nearestMiles * 100) / 100;

  return NextResponse.json({
    university: {
      id: nearest.id,
      name: nearest.name,
      tier: nearest.tier,
      party_score: nearest.party_score,
      campus_lat: nearest.campus_lat,
      campus_lng: nearest.campus_lng,
    },
    miles: roundedMiles,
    auto_score: distanceToScore(roundedMiles),
  });
}
