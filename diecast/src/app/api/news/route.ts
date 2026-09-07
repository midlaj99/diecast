import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { NewsModel } from '@/models/News';
import { seedInitialDataIfNeeded } from '@/lib/seed';

const DEFAULT_NEWS = [
  { id: '1', text: '🚨 Big Sale: Up to 50% off on all 1/18 scale models!' },
  { id: '2', text: '🚗 New arrivals from Hot Wheels and Matchbox just landed!' },
  { id: '3', text: '✨ Free shipping on orders over ₹2000!' },
  { id: '4', text: '🔥 Pre-order the exclusive 2024 limited editions now!' },
];

export async function GET() {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: true, data: DEFAULT_NEWS });
    }

    await seedInitialDataIfNeeded();
    const news = await NewsModel.find({ active: true }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: news.length > 0 ? news : DEFAULT_NEWS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching news';
    console.error('[API News GET Error]:', message);
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
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json({ success: false, error: 'News text is required' }, { status: 400 });
    }

    const id = body.id || Date.now().toString();
    const item = await NewsModel.findOneAndUpdate(
      { id },
      { id, text: body.text.trim(), active: true },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error adding news';
    console.error('[API News POST Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to save news' }, { status: 500 });
  }
}
