import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ScaleModel } from '@/models/Scale';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not connected' }, { status: 503 });
    }

    const decoded = decodeURIComponent(id);
    const deleted = await ScaleModel.findOneAndDelete({ name: decoded });
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Scale not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Scale deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error deleting scale';
    console.error('[API Scale DELETE Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
