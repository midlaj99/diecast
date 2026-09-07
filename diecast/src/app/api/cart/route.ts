import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { CartModel } from '@/models/Cart';
import { ProductModel } from '@/models/Product';
import { getOrCreateSessionId, attachSessionCookie } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const db = await connectDB();
    if (!db) {
      const res = NextResponse.json({ success: true, items: [] });
      if (isNew) attachSessionCookie(res, sessionId);
      return res;
    }

    const cart = await CartModel.findOne({ sessionId }).lean();
    const res = NextResponse.json({
      success: true,
      items: cart ? cart.items : [],
    });

    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cart error';
    console.error('[API Cart GET Error]:', message);
    return NextResponse.json({ success: false, items: [], error: 'Failed to load cart' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const body = await req.json();
    const { id, name, scale, price, quantity = 1, image, color } = body;

    if (!id || !name || price === undefined) {
      return NextResponse.json({ success: false, error: 'Invalid cart item payload' }, { status: 400 });
    }

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not connected' }, { status: 503 });
    }

    // Check available stock from ProductModel
    const product = await ProductModel.findOne({ $or: [{ id }, { slug: id }] });
    const availableStock = product ? product.stock : 999;

    let cart = await CartModel.findOne({ sessionId });
    if (!cart) {
      cart = new CartModel({ sessionId, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.id === id && (item.color || '') === (color || '')
    );
    if (existingIndex > -1) {
      const targetQty = cart.items[existingIndex].quantity + Number(quantity);
      cart.items[existingIndex].quantity = Math.min(targetQty, availableStock > 0 ? availableStock : targetQty);
    } else {
      cart.items.push({
        id,
        name,
        scale: scale || '',
        price: Number(price),
        quantity: Math.min(Number(quantity), availableStock > 0 ? availableStock : Number(quantity)),
        image: image || '',
        color: color || '',
      });
    }

    await cart.save();

    const res = NextResponse.json({ success: true, items: cart.items });
    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cart error';
    console.error('[API Cart POST Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to add item to cart' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const body = await req.json();
    const { id, quantity } = body;

    if (!id || quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Item ID and quantity required' }, { status: 400 });
    }

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not connected' }, { status: 503 });
    }

    const cart = await CartModel.findOne({ sessionId });
    if (!cart) {
      const res = NextResponse.json({ success: true, items: [] });
      if (isNew) attachSessionCookie(res, sessionId);
      return res;
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter((item) => item.id !== id);
    } else {
      const existingItem = cart.items.find((item) => item.id === id);
      if (existingItem) {
        existingItem.quantity = Number(quantity);
      }
    }

    await cart.save();

    const res = NextResponse.json({ success: true, items: cart.items });
    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cart error';
    console.error('[API Cart PATCH Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to update quantity' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ success: true, items: [] });
    }

    let cart = await CartModel.findOne({ sessionId });
    if (cart) {
      if (itemId) {
        cart.items = cart.items.filter((item) => item.id !== itemId);
      } else {
        cart.items = [];
      }
      await cart.save();
    }

    const res = NextResponse.json({ success: true, items: cart ? cart.items : [] });
    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cart error';
    console.error('[API Cart DELETE Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to clear cart' }, { status: 500 });
  }
}
