import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return NextResponse.json([]);
    }
    const data = await res.json();
    // Firefox autocomplete returns array format: [query, [suggestions...]]
    if (Array.isArray(data) && data[1]) {
      return NextResponse.json(data[1]);
    }
    return NextResponse.json([]);
  } catch (error) {
    console.error('YouTube suggestions API Error:', error);
    return NextResponse.json([]);
  }
}
