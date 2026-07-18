import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

function extractVideoId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export async function POST(request: Request) {
  try {
    const { urls } = await request.json(); 
    
    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: "Please provide an array of 'urls'." }, { status: 400 });
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
        const transcriptLines = await YoutubeTranscript.fetchTranscript(videoId);
        // Combine all lines into a single block of text
        const text = transcriptLines.map((line: any) => line.text).join(' ');
        results.push({ url: cleanUrl, status: 'success', text });
      } catch (err: any) {
        console.error(`Error fetching transcript for ${videoId}:`, err);
        results.push({ url: cleanUrl, status: 'error', error: err.message || 'Failed to extract transcript. Video might be private or have no captions.' });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Transcript Extraction Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
