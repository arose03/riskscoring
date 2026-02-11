import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search') || '';
  const db = getDb();

  let universities;
  if (search) {
    universities = db
      .prepare('SELECT * FROM universities WHERE name LIKE ? ORDER BY name LIMIT 50')
      .all(`%${search}%`);
  } else {
    universities = db.prepare('SELECT * FROM universities ORDER BY name').all();
  }

  return NextResponse.json(universities);
}
