import { NextResponse } from 'next/server';

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * METHOD 1: youtube-transcript.ai service
 */
async function fetchViaTranscriptService(videoId: string): Promise<string> {
  const res = await fetch(
    `https://youtube-transcript.ai/transcript/${videoId}.txt?lang=en`,
    {
      headers: {
        Accept: 'text/plain,text/html,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!res.ok) {
    throw new Error(`Transcript service responded with HTTP ${res.status}`);
  }

  const text = await res.text();
  if (!text || text.trim().length < 30) {
    throw new Error('Transcript service returned an empty response.');
  }

  return text.trim();
}

/**
 * METHOD 2: Direct YouTube watch page timedtext parsing (with escaped JSON support)
 */
async function fetchViaDirectTimedtext(videoId: string): Promise<string> {
  const BROWSER_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  };

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!pageRes.ok) {
    throw new Error(`YouTube page returned HTTP ${pageRes.status}`);
  }

  const html = await pageRes.text();

  // Try raw captionTracks pattern first, then escaped string pattern
  let captionTracks: Array<{ languageCode: string; baseUrl: string }> | null = null;
  const rawMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  
  if (rawMatch) {
    try {
      captionTracks = JSON.parse(rawMatch[1]);
    } catch (e) {
      // Continue to fallback
    }
  }

  if (!captionTracks) {
    const escapedMatch = html.match(/\\?"captionTracks\\?":\s*(\\?\[.*?\\?\])/);
    if (escapedMatch) {
      try {
        const unescaped = escapedMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        captionTracks = JSON.parse(unescaped);
      } catch (e) {
        // Continue
      }
    }
  }

  if (!captionTracks || !captionTracks.length) {
    throw new Error('No caption tracks found in player HTML.');
  }

  // Prefer English, fall back to first available
  const track =
    captionTracks.find((t) => t.languageCode === 'en') ||
    captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
    captionTracks[0];

  if (!track?.baseUrl) {
    throw new Error('No usable caption track URL found.');
  }

  const xmlRes = await fetch(track.baseUrl, {
    headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
    signal: AbortSignal.timeout(10000),
  });

  if (!xmlRes.ok) {
    throw new Error(`Caption XML fetch returned HTTP ${xmlRes.status}`);
  }

  const xml = await xmlRes.text();

  const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
  const segments: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = textRegex.exec(xml)) !== null) {
    const decoded = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n/g, ' ')
      .trim();
    if (decoded) segments.push(decoded);
  }

  if (!segments.length) {
    throw new Error('Parsed transcript XML had no text content.');
  }

  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * METHOD 3: Public LemnosLife YouTube API Proxy
 */
async function fetchViaLemnosProxy(videoId: string): Promise<string> {
  const res = await fetch(`https://yt.lemnoslife.com/noKey/transcript?videoId=${videoId}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Lemnos Proxy returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data?.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
    const lines = data.transcript.map((item: any) => item.text || item.lines?.join(' ') || '').filter(Boolean);
    if (lines.length > 0) {
      return lines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  throw new Error('Lemnos Proxy returned empty transcript array.');
}

/**
 * METHOD 4: DecAPI / Vercel public transcript proxy
 */
async function fetchViaVercelProxy(videoId: string): Promise<string> {
  const res = await fetch(`https://subtitles-youtube.vercel.app/api/transcript?videoId=${videoId}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Vercel Proxy returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    const lines = data.map((item: any) => item.text || '').filter(Boolean);
    if (lines.length > 0) {
      return lines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  throw new Error('Vercel proxy returned invalid payload');
}

export async function POST(request: Request) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: "Please provide an array of 'urls'." },
        { status: 400 }
      );
    }

    const results = [];

    for (const url of urls) {
      const cleanUrl = url.trim();
      if (!cleanUrl) continue;

      const videoId = extractVideoId(cleanUrl);
      if (!videoId) {
        results.push({ url: cleanUrl, status: 'error', error: 'Invalid YouTube URL' });
        continue;
      }

      let text: string | null = null;
      let lastError = '';

      // Tier 1: Service API
      try {
        text = await fetchViaTranscriptService(videoId);
        console.log(`[transcript] ✅ Tier 1 service method succeeded for ${videoId}`);
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[transcript] ⚠️ Tier 1 service method failed for ${videoId}: ${lastError}`);
      }

      // Tier 2: Direct YouTube timedtext extraction
      if (!text) {
        try {
          text = await fetchViaDirectTimedtext(videoId);
          console.log(`[transcript] ✅ Tier 2 direct method succeeded for ${videoId}`);
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[transcript] ⚠️ Tier 2 direct method failed for ${videoId}: ${lastError}`);
        }
      }

      // Tier 3: Lemnos Proxy API
      if (!text) {
        try {
          text = await fetchViaLemnosProxy(videoId);
          console.log(`[transcript] ✅ Tier 3 Lemnos proxy succeeded for ${videoId}`);
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[transcript] ⚠️ Tier 3 Lemnos proxy failed for ${videoId}: ${lastError}`);
        }
      }

      // Tier 4: Vercel Proxy API
      if (!text) {
        try {
          text = await fetchViaVercelProxy(videoId);
          console.log(`[transcript] ✅ Tier 4 Vercel proxy succeeded for ${videoId}`);
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[transcript] ⚠️ Tier 4 Vercel proxy failed for ${videoId}: ${lastError}`);
        }
      }

      if (text) {
        results.push({ url: cleanUrl, status: 'success', text });
      } else {
        console.error(`[transcript] ❌ All 4 extraction tiers failed for ${videoId}. Last error: ${lastError}`);
        results.push({
          url: cleanUrl,
          status: 'error',
          error: lastError.includes('no captions') || lastError.includes('empty')
            ? 'This video has no captions available.'
            : 'YouTube blocked automatic transcript access. Please paste the transcript manually.',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Transcript Extraction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
