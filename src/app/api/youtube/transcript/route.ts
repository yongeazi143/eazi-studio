import { NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

async function fetchTranscriptWithYoutubei(videoId: string): Promise<string> {
  const youtube = await Innertube.create({
    retrieve_player: false,
  });

  const info = await youtube.getInfo(videoId);
  const transcriptData = await info.getTranscript();

  const segments =
    transcriptData?.transcript?.content?.body?.initial_segments ?? [];

  const text = segments
    .map((seg: any) => seg?.snippet?.text ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    throw new Error('No transcript segments found — video may have no captions.');
  }

  return text;
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

      try {
        const text = await fetchTranscriptWithYoutubei(videoId);
        results.push({ url: cleanUrl, status: 'success', text });
      } catch (err: any) {
        console.error(`Error fetching transcript for ${videoId}:`, err);
        results.push({
          url: cleanUrl,
          status: 'error',
          error:
            err?.message?.includes('no captions') || err?.message?.includes('disabled')
              ? 'This video has no captions available.'
              : 'YouTube blocked the transcript request. Please paste it manually.',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Transcript Extraction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
