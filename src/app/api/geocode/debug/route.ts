import { NextResponse } from 'next/server';

export async function GET() {
  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const activeKey = serverKey || publicKey;

  const keyInfo = {
    GOOGLE_MAPS_API_KEY: serverKey ? `set (${serverKey.length} chars, starts with ${serverKey.substring(0, 6)}...)` : 'NOT SET',
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: publicKey ? `set (${publicKey.length} chars, starts with ${publicKey.substring(0, 6)}...)` : 'NOT SET',
    activeKey: activeKey ? 'yes' : 'NO KEY AVAILABLE',
  };

  // Test actual geocode call with a known address
  let geocodeResult = null;
  if (activeKey) {
    const testAddress = '1600 Amphitheatre Parkway, Mountain View, CA';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${activeKey}`;
    try {
      const res = await fetch(url);
      geocodeResult = await res.json();
    } catch (err) {
      geocodeResult = { fetchError: String(err) };
    }
  }

  return NextResponse.json({
    keyInfo,
    geocodeTestResult: geocodeResult,
    hint: geocodeResult?.status === 'REQUEST_DENIED'
      ? 'REQUEST_DENIED usually means: (1) Geocoding API not enabled in Google Cloud Console, (2) API key has HTTP referrer restrictions blocking server-side calls, or (3) billing not enabled.'
      : geocodeResult?.status === 'OK'
        ? 'Geocoding is working! The issue may be elsewhere.'
        : null,
  });
}
