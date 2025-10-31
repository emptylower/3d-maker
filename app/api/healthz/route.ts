import { NextResponse } from 'next/server';

export async function GET() {
  // Keep it minimal: 200 OK with a simple payload
  return NextResponse.json(
    {
      status: 'ok',
      service: 'hitem3d-square',
      time: new Date().toISOString(),
    },
    { status: 200 }
  );
}
