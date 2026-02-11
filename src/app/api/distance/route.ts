import { NextRequest, NextResponse } from 'next/server';
import { haversineDistance, distanceToScore } from '@/lib/scoring';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { propertyLat, propertyLng, universityId } = await req.json();

  if (!propertyLat || !propertyLng || !universityId) {
    return NextResponse.json(
      { error: 'propertyLat, propertyLng, and universityId are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const university = db
    .prepare('SELECT * FROM universities WHERE id = ?')
    .get(universityId) as { campus_lat: number | null; campus_lng: number | null; name: string } | undefined;

  if (!university) {
    return NextResponse.json({ error: 'University not found' }, { status: 404 });
  }

  if (!university.campus_lat || !university.campus_lng) {
    return NextResponse.json(
      { error: 'University campus coordinates not available. Run geocode-campuses script first.' },
      { status: 400 }
    );
  }

  const miles = haversineDistance(
    propertyLat,
    propertyLng,
    university.campus_lat,
    university.campus_lng
  );

  const roundedMiles = Math.round(miles * 100) / 100;

  return NextResponse.json({
    miles: roundedMiles,
    auto_score: distanceToScore(roundedMiles),
    university_name: university.name,
  });
}
