import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'diecast/products';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds maximum limit of 10MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize folder path to prevent path traversal
    const safeFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '');

    const result = await uploadToCloudinary(buffer, safeFolder);

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Failed to upload image. Please try again.';
    console.error('[API Upload Error]:', message, error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
