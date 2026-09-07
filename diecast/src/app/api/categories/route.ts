import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { CategoryModel } from '@/models/Category';
import { seedInitialDataIfNeeded } from '@/lib/seed';
import { defaultCategories } from '@/data/products';
import { getFallbackCategories, saveFallbackCategory } from '@/lib/fallbackStorage';

export async function GET() {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: true, data: getFallbackCategories(), source: 'fallback' });
    }

    await seedInitialDataIfNeeded();
    const categories = await CategoryModel.find({}).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching categories';
    console.error('[API Categories GET Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const categoryName = body.name.trim();

    const db = await connectDB();
    if (!db) {
      const saved = saveFallbackCategory({ name: categoryName, image: body.image || '', subtitle: body.subtitle || '' });
      if (!saved) {
        return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: saved, source: 'fallback' }, { status: 201 });
    }
    const existing = await CategoryModel.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 409 });
    }

    const category = await CategoryModel.create({
      name: categoryName,
      image: body.image || '',
      subtitle: body.subtitle || '',
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating category';
    console.error('[API Categories POST Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}
