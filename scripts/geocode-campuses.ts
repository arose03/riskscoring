// ============================================================
// One-time script to geocode university campuses
// Run: npx tsx scripts/geocode-campuses.ts
// Requires GOOGLE_MAPS_API_KEY in environment
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'riskscoring.db');

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not set');
    process.exit(1);
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 'OK' && data.results?.length > 0) {
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
    };
  }

  console.warn(`  Failed to geocode: ${address} (${data.status})`);
  return null;
}

async function main() {
  const db = new Database(DB_PATH);

  const universities = db
    .prepare('SELECT id, name FROM universities WHERE campus_lat IS NULL OR campus_lng IS NULL')
    .all() as { id: number; name: string }[];

  console.log(`Found ${universities.length} universities to geocode`);

  const update = db.prepare(
    'UPDATE universities SET campus_lat = ?, campus_lng = ? WHERE id = ?'
  );

  let success = 0;
  let failed = 0;

  for (const uni of universities) {
    const query = `${uni.name} campus`;
    console.log(`Geocoding: ${uni.name}...`);

    const coords = await geocodeAddress(query);
    if (coords) {
      update.run(coords.lat, coords.lng, uni.id);
      success++;
      console.log(`  ✓ ${coords.lat}, ${coords.lng}`);
    } else {
      failed++;
    }

    // Rate limit: 50 requests per second max for Google
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone! ${success} geocoded, ${failed} failed.`);
  db.close();
}

main().catch(console.error);
