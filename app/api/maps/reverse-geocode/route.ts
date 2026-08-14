import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng parameters are required' }, { status: 400 });
  }

  const apiKey =
    process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY ||
    process.env.Maps_Platform_API_Key ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&region=ng`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ status: data.status, formatted_address: null }, { status: 200 });
    }

    return NextResponse.json({
      status: 'OK',
      formatted_address: data.results[0].formatted_address,
    });
  } catch (err: any) {
    console.error('Server reverse geocode error:', err);
    return NextResponse.json({ error: err.message || 'Reverse geocoding failed' }, { status: 500 });
  }
}
