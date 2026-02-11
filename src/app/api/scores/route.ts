import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO assessments (address, formatted_address, lat, lng, university_id, property_info, property_scores, property_result, gl_scores, gl_result)
    VALUES (@address, @formatted_address, @lat, @lng, @university_id, @property_info, @property_scores, @property_result, @gl_scores, @gl_result)
  `);

  const result = stmt.run({
    address: body.address || '',
    formatted_address: body.formatted_address || '',
    lat: body.lat || null,
    lng: body.lng || null,
    university_id: body.university_id || null,
    property_info: JSON.stringify(body.property_info || {}),
    property_scores: JSON.stringify(body.property_scores || {}),
    property_result: JSON.stringify(body.property_result || {}),
    gl_scores: JSON.stringify(body.gl_scores || {}),
    gl_result: JSON.stringify(body.gl_result || {}),
  });

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function GET() {
  const db = getDb();
  const scores = db
    .prepare('SELECT * FROM assessments ORDER BY created_at DESC LIMIT 100')
    .all();

  return NextResponse.json(scores);
}
