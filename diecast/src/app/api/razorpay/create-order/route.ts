import { NextRequest, NextResponse } from 'next/server';
import { getRazorpayInstance } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency = 'INR', receipt, notes } = body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid payment amount is required' },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayInstance();
    // Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(numericAmount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    });

    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      'rzp_test_TZAp3OiWkGlLZH';

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating Razorpay order';
    console.error('[API Razorpay Create Order Error]:', message, error);
    return NextResponse.json(
      { success: false, error: message || 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}
