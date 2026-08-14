import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !address.trim()) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  const apiKey =
    process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY ||
    process.env.Maps_Platform_API_Key ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=ng`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ status: data.status, results: [] }, { status: 200 });
    }

    const result = data.results[0];
    return NextResponse.json({
      status: 'OK',
      result: {
        address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
    });
  } catch (err: any) {
    console.error('Server geocode error:', err);
    return NextResponse.json({ error: err.message || 'Geocoding failed' }, { status: 500 });
  }
}
