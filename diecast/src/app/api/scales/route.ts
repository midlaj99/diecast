import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ScaleModel } from '@/models/Scale';
import { seedInitialDataIfNeeded } from '@/lib/seed';
import { defaultScales } from '@/data/products';

export async function GET() {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: true, data: defaultScales });
    }

    await seedInitialDataIfNeeded();
    const scales = await ScaleModel.find({}).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ success: true, data: scales.map((s) => s.name) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching scales';
    console.error('[API Scales GET Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not connected' }, { status: 503 });
    }

    const body = await req.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Scale name is required' }, { status: 400 });
    }

    const scaleName = body.name.trim();
    const existing = await ScaleModel.findOne({ name: scaleName });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Scale already exists' }, { status: 409 });
    }

    const scale = await ScaleModel.create({ name: scaleName });
    return NextResponse.json({ success: true, data: scale.name }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error adding scale';
    console.error('[API Scales POST Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to add scale' }, { status: 500 });
  }
}
