import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OrderModel, IOrderItem } from '@/models/Order';
import { ProductModel } from '@/models/Product';
import { CartModel } from '@/models/Cart';
import { getOrCreateSessionId, attachSessionCookie } from '@/lib/session';
import { getFallbackOrders, saveFallbackOrder, getFallbackProducts } from '@/lib/fallbackStorage';
import { verifyRazorpaySignature } from '@/lib/razorpay';

export async function GET(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');

    const db = await connectDB();
    if (!db) {
      const orders = getFallbackOrders({ sessionId, phone: phone || undefined, email: email || undefined });
      const res = NextResponse.json({ success: true, data: orders, source: 'fallback' });
      if (isNew) attachSessionCookie(res, sessionId);
      return res;
    }

    const query: Record<string, any> = {
      $or: [{ sessionId }],
    };

    if (phone && phone.trim()) {
      query.$or.push({ customerPhone: phone.trim() });
    }
    if (email && email.trim()) {
      query.$or.push({ customerEmail: email.trim().toLowerCase() });
    }

    const orders = await OrderModel.find(query).sort({ createdAt: -1 }).lean();

    const res = NextResponse.json({ success: true, data: orders });
    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching orders';
    console.error('[API Orders GET Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      state,
      pinCode,
      shippingPartner,
      items,
      clearCartAfterOrder,
      paymentMethod = 'Razorpay',
      paymentStatus = 'Paid',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;

    // 1. Strict Server-Side Validation
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Please enter a valid full name.' }, { status: 400 });
    }

    const phoneRegex = /^[0-9+\s-]{10,15}$/;
    if (!customerPhone || !phoneRegex.test(customerPhone.trim())) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailRegex.test(customerEmail.trim())) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return NextResponse.json({ success: false, error: 'Please enter a complete delivery address.' }, { status: 400 });
    }

    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Please enter your city.' }, { status: 400 });
    }

    if (!state || typeof state !== 'string' || state.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Please select your state.' }, { status: 400 });
    }

    const pinRegex = /^[0-9]{6}$/;
    if (!pinCode || !pinRegex.test(pinCode.trim())) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 6-digit PIN code.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Order must contain at least one item.' }, { status: 400 });
    }

    const { sessionId, isNew } = getOrCreateSessionId(req);
    const db = await connectDB();

    if (!db) {
      const validatedItems: IOrderItem[] = [];
      let calculatedTotal = 0;
      const fallbackProds = getFallbackProducts();

      for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const product = fallbackProds.find((p) => p.id === item.id || p.slug === item.id);
        if (product) {
          const effectivePrice =
            product.isPreorder && product.preorderAmount && product.preorderAmount > 0
              ? product.preorderAmount
              : product.price;
          calculatedTotal += effectivePrice * quantity;
          validatedItems.push({
            id: product.id,
            name: product.name,
            price: effectivePrice,
            quantity,
            image: product.image,
            scale: product.scale || item.scale || '',
            color: item.color || '',
          });
        } else {
          const itemPrice = Math.max(0, Number(item.price) || 0);
          calculatedTotal += itemPrice * quantity;
          validatedItems.push({
            id: item.id || Date.now().toString(),
            name: item.name || 'Diecast Model',
            price: itemPrice,
            quantity,
            image: item.image || '',
            scale: item.scale || '',
            color: item.color || '',
          });
        }
      }

      const orderId = 'ORD' + Date.now().toString();
      const newOrder = saveFallbackOrder({
        id: orderId,
        date: new Date().toISOString(),
        status: 'Pending',
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        shippingPartner: shippingPartner || 'Indian Post (Door-to-Door Delivery)',
        items: validatedItems,
        totalAmount: calculatedTotal,
        sessionId,
        paymentMethod: paymentMethod || 'Razorpay',
        paymentStatus: paymentStatus || 'Paid',
        razorpayOrderId: razorpayOrderId || '',
        razorpayPaymentId: razorpayPaymentId || '',
        razorpaySignature: razorpaySignature || '',
      });

      const res = NextResponse.json({ success: true, data: newOrder, source: 'fallback' }, { status: 201 });
      if (isNew) attachSessionCookie(res, sessionId);
      return res;
    }

    // 2. Atomic Stock Verification & Deduction
    const validatedItems: IOrderItem[] = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const product = await ProductModel.findOne({ $or: [{ id: item.id }, { slug: item.id }] });

      if (product) {
        // If regular stock product (not preorder), check stock
        if (!product.isPreorder && product.stock < quantity) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock for "${product.name}". Available: ${product.stock}` },
            { status: 400 }
          );
        }

        // Deduct stock atomically
        if (!product.isPreorder) {
          await ProductModel.updateOne(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
          );
        }

        const effectivePrice = (product.isPreorder && product.preorderAmount && product.preorderAmount > 0)
          ? product.preorderAmount
          : product.price;

        calculatedTotal += effectivePrice * quantity;

        validatedItems.push({
          id: product.id,
          name: product.name,
          price: effectivePrice,
          quantity,
          image: product.image,
          scale: product.scale || item.scale || '',
          color: item.color || '',
        });
      } else {
        // Fallback for custom or direct items
        const itemPrice = Math.max(0, Number(item.price) || 0);
        calculatedTotal += itemPrice * quantity;
        validatedItems.push({
          id: item.id || Date.now().toString(),
          name: item.name || 'Diecast Model',
          price: itemPrice,
          quantity,
          image: item.image || '',
          scale: item.scale || '',
          color: item.color || '',
        });
      }
    }

    // 3. Create and Save Order
    const orderId = 'ORD' + Date.now().toString();
    const newOrder = await OrderModel.create({
      id: orderId,
      date: new Date(),
      status: 'Pending',
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pinCode: pinCode.trim(),
      shippingPartner: shippingPartner || 'Indian Post (Door-to-Door Delivery)',
      items: validatedItems,
      totalAmount: calculatedTotal,
      sessionId,
      paymentMethod: paymentMethod || 'Razorpay',
      paymentStatus: paymentStatus || 'Paid',
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      razorpaySignature: razorpaySignature || '',
    });

    // 4. Clear cart if checked out from cart
    if (clearCartAfterOrder) {
      await CartModel.findOneAndUpdate({ sessionId }, { $set: { items: [] } });
    }

    const res = NextResponse.json({ success: true, data: newOrder }, { status: 201 });
    if (isNew) attachSessionCookie(res, sessionId);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating order';
    console.error('[API Orders POST Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to place order. Please try again.' }, { status: 500 });
  }
}
