import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

function getMockItems(query: string) {
  const cleanKeyword = encodeURIComponent(query.trim().replace(/\s+/g, ','));
  return [
    {
      id: { videoId: 'mock1' },
      snippet: {
        title: `10 Hidden SECRETS About ${query} You Didn't Know`,
        channelTitle: 'Viral Insights',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},video?lock=1` } }
      },
      statistics: { viewCount: '1205000' }
    },
    {
      id: { videoId: 'mock2' },
      snippet: {
        title: `I Tried ${query} For 30 Days (SHOCKING RESULTS)`,
        channelTitle: 'Deep Dive Experiments',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},challenge?lock=2` } }
      },
      statistics: { viewCount: '850000' }
    },
    {
      id: { videoId: 'mock3' },
      snippet: {
        title: `The TRUTH About ${query} - What They Aren't Telling You`,
        channelTitle: 'Truth Seekers',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},secret?lock=3` } }
      },
      statistics: { viewCount: '2400500' }
    },
    {
      id: { videoId: 'mock4' },
      snippet: {
        title: `${query} Masterclass: From Beginner to Pro in 20 Minutes`,
        channelTitle: 'Design & Tech Academy',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},education?lock=4` } }
      },
      statistics: { viewCount: '450200' }
    },
    {
      id: { videoId: 'mock5' },
      snippet: {
        title: `Why 99% of Creators Fail at ${query} (And How to Be the 1%)`,
        channelTitle: 'Creator Mastery',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},creator?lock=5` } }
      },
      statistics: { viewCount: '1105000' }
    },
    {
      id: { videoId: 'mock6' },
      snippet: {
        title: `The Ultimate ${query} Blueprint (Step-by-Step Guide)`,
        channelTitle: 'Niche Academy',
        thumbnails: { high: { url: `https://loremflickr.com/320/180/${cleanKeyword},guide?lock=6` } }
      },
      statistics: { viewCount: '632000' }
    }
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;

  if (!API_KEY) {
    // Return high-end mock data so the UI can still be developed and previewed
    return NextResponse.json({ items: getMockItems(query) });
  }

  try {
    // Restrict search results to recent viral hits from the past 6 months max (180 days)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Search for videos
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query
      )}&type=video&maxResults=6&order=viewCount&publishedAfter=${encodeURIComponent(
        sixMonthsAgo
      )}&key=${API_KEY}`,
      { cache: 'no-store' }
    );

    if (!searchRes.ok) {
      console.warn(`YouTube Search API returned status ${searchRes.status}. Falling back to mock results.`);
      return NextResponse.json({ items: getMockItems(query) });
    }

    const searchData = await searchRes.json();

    if (!searchData.items || searchData.items.length === 0) {
      return NextResponse.json({ items: getMockItems(query) });
    }

    // 2. Fetch statistics (views) for these videos
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${API_KEY}`,
      { cache: 'no-store' }
    );

    if (!statsRes.ok) {
      // If stats call fails, return search results with default view statistics
      const itemsWithoutStats = searchData.items.map((item: any) => ({
        ...item,
        statistics: { viewCount: '0' }
      }));
      return NextResponse.json({ items: itemsWithoutStats });
    }

    const statsData = await statsRes.json();

    // 3. Merge stats into search results
    const itemsWithStats = searchData.items.map((item: any) => {
      const stats = statsData.items?.find((v: any) => v.id === item.id.videoId);
      return {
        ...item,
        statistics: stats?.statistics || { viewCount: '0' }
      };
    });

    return NextResponse.json({ items: itemsWithStats });
  } catch (error) {
    console.error('YouTube API Error, falling back to mocks:', error);
    return NextResponse.json({ items: getMockItems(query) });
  }
}
