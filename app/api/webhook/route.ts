import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ymihyyqdwwwdbsuhtjbv.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaWh5eXFkd3d3ZGJzdWh0amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTU1NDMsImV4cCI6MjA5NzEzMTU0M30.xIKwl_tnab8bs5BUyk4PZEAIiEZAIypVq8q8J_H1Ql8').trim();

// Use service-level client for server-side operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);


interface WebhookPayload {
  phone_number: string;
  crop_type: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API secret key
    const apiSecret = request.headers.get('x-api-secret');
    const expectedSecret = process.env.WEBHOOK_API_SECRET;

    if (!expectedSecret) {
      console.error('WEBHOOK_API_SECRET not configured');
      return NextResponse.json(
        { status: 'error', message: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!apiSecret || apiSecret !== expectedSecret) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized: Invalid API secret' },
        { status: 401 }
      );
    }

    // 2. Parse and validate the request body
    const body: WebhookPayload = await request.json();

    if (!body.phone_number || !body.crop_type || !body.quantity) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing required fields: phone_number, crop_type, quantity',
        },
        { status: 400 }
      );
    }

    if (typeof body.quantity !== 'number' || body.quantity <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'quantity must be a positive number' },
        { status: 400 }
      );
    }

    // 3. Match phone number to farmer_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('phone_number', body.phone_number)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        {
          status: 'error',
          message: `No user found with phone number: ${body.phone_number}`,
        },
        { status: 404 }
      );
    }

    if (user.role !== 'farmer') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Phone number is not associated with a farmer account',
        },
        { status: 403 }
      );
    }

    // 4. Insert harvest log
    const { data: harvest, error: insertError } = await supabase
      .from('harvest_logs')
      .insert({
        farmer_id: user.id,
        crop_type: body.crop_type,
        quantity_kg: body.quantity,
        farm_location: 'Via USSD',
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { status: 'error', message: 'Failed to log harvest' },
        { status: 500 }
      );
    }

    // 5. Return success response
    return NextResponse.json({
      status: 'success',
      message: 'Harvest logged via API',
      data: {
        harvest_id: harvest.id,
        farmer_id: user.id,
        crop_type: body.crop_type,
        quantity_kg: body.quantity,
      },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Agri-Data Hub Webhook API is running',
    timestamp: new Date().toISOString(),
  });
}
