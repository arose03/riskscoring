import { NextRequest, NextResponse } from 'next/server';
import { getRentStudy, deleteRentStudy } from '@/lib/scrapers';

// GET /api/rent-study/[id] – Get a specific rent study with comps
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid study ID' }, { status: 400 });
    }

    const study = getRentStudy(id);
    if (!study) {
      return NextResponse.json({ error: 'Rent study not found' }, { status: 404 });
    }

    return NextResponse.json({ study });
  } catch (err) {
    console.error('Get rent study error:', err);
    return NextResponse.json({ error: 'Failed to get rent study' }, { status: 500 });
  }
}

// DELETE /api/rent-study/[id] – Delete a rent study
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid study ID' }, { status: 400 });
    }

    const deleted = deleteRentStudy(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Rent study not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete rent study error:', err);
    return NextResponse.json({ error: 'Failed to delete rent study' }, { status: 500 });
  }
}
