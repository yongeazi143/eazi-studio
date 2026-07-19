import { NextResponse } from 'next/server';

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * PRIMARY METHOD: youtube-transcript.ai
 * A free public REST API that handles YouTube's bot detection on their end.
 * No API key, no signup, no library needed.
 */
async function fetchViaTranscriptService(videoId: string): Promise<string> {
  const res = await fetch(
    `https://youtube-transcript.ai/transcript/${videoId}.txt?lang=en`,
    {
      headers: {
        Accept: 'text/plain,text/html,*/*',
        'User-Agent': 'EaziStudio/1.0 (content-creator-tool)',
      },
      // 15 second timeout via AbortSignal
      signal: AbortSignal.timeout(15000),
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
 * FALLBACK METHOD: Direct YouTube timedtext extraction
 * Fetches the YouTube watch page, extracts caption track URLs, and fetches the XML.
 * Works when the primary service is unavailable.
 */
async function fetchViaDirectTimedtext(videoId: string): Promise<string> {
  const BROWSER_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!pageRes.ok) {
    throw new Error(`YouTube page returned HTTP ${pageRes.status}`);
  }

  const html = await pageRes.text();

  // Extract captionTracks array from ytInitialPlayerResponse
  const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!captionMatch) {
    throw new Error('No caption tracks found — video may have no captions or YouTube blocked the request.');
  }

  const captionTracks: Array<{ languageCode: string; baseUrl: string }> = JSON.parse(
    captionMatch[1]
  );

  if (!captionTracks.length) {
    throw new Error('Caption track list is empty.');
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

  // Parse <text> tags from XML and decode HTML entities
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

      // Method 1: youtube-transcript.ai service (primary)
      try {
        text = await fetchViaTranscriptService(videoId);
        console.log(`[transcript] ✅ Service method succeeded for ${videoId}`);
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[transcript] ⚠️ Service method failed for ${videoId}: ${lastError}`);
      }

      // Method 2: Direct timedtext extraction (fallback)
      if (!text) {
        try {
          text = await fetchViaDirectTimedtext(videoId);
          console.log(`[transcript] ✅ Direct method succeeded for ${videoId}`);
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[transcript] ⚠️ Direct method failed for ${videoId}: ${lastError}`);
        }
      }

      if (text) {
        results.push({ url: cleanUrl, status: 'success', text });
      } else {
        console.error(`[transcript] ❌ All methods failed for ${videoId}. Last error: ${lastError}`);
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
