import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/utils/db';
import { createClient } from '@/utils/supabase/server';
import { fetchWithRetry, getGitHubToken } from '@/utils/ai';

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference/chat/completions';

async function fetchYouTubeChannelInfo(handleOrUrl: string) {
  if (!handleOrUrl || !handleOrUrl.trim()) {
    return { title: '', description: '', avatar: '', recentVideoTitles: [], handle: '' };
  }

  // Sanitize handle or URL: strip domain/slashes and ensure '@' prefix
  let raw = handleOrUrl.trim();
  raw = raw.replace(/^https?:\/\/(www\.)?youtube\.com\/(c\/|user\/|channel\/|@)?/i, '').replace(/\/.*$/, '').trim();
  
  if (!raw) return { title: '', description: '', avatar: '', recentVideoTitles: [], handle: '' };
  
  const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
  const handleCleanName = cleanHandle.replace(/^@/, '');

  const API_KEY = process.env.YOUTUBE_API_KEY;
  let title = '';
  let description = '';
  let avatar = '';
  let recentVideoTitles: string[] = [];

  // Method A: Try YouTube API if key exists
  if (API_KEY) {
    try {
      let searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&forHandle=${encodeURIComponent(handleCleanName)}&key=${API_KEY}`,
        { cache: 'no-store' }
      );
      let data = searchRes.ok ? await searchRes.json() : null;

      // Fallback API search by query if forHandle returns empty
      if (!data || !data.items || data.items.length === 0) {
        const queryRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handleCleanName)}&maxResults=1&key=${API_KEY}`,
          { cache: 'no-store' }
        );
        if (queryRes.ok) {
          const qData = await queryRes.json();
          if (qData.items && qData.items.length > 0) {
            const channelId = qData.items[0].id?.channelId || qData.items[0].snippet?.channelId;
            if (channelId) {
              const chRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&id=${channelId}&key=${API_KEY}`,
                { cache: 'no-store' }
              );
              if (chRes.ok) data = await chRes.json();
            }
          }
        }
      }

      if (data && data.items && data.items.length > 0) {
        const ch = data.items[0];
        title = ch.snippet?.title || '';
        description = ch.snippet?.description || ch.brandingSettings?.channel?.keywords || '';
        avatar = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || '';
        const channelId = ch.id;

        // Fetch recent video titles from channel
        if (channelId) {
          const vidsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${API_KEY}`,
            { cache: 'no-store' }
          );
          if (vidsRes.ok) {
            const vidsData = await vidsRes.json();
            recentVideoTitles = vidsData.items?.map((v: any) => v.snippet?.title).filter(Boolean) || [];
          }
        }
      }
    } catch (e) {
      console.warn('YouTube API channel fetch warning:', e);
    }
  }

  // Method B: Direct YouTube Web Page fetch (fallback or to get high-res avatar)
  try {
    const res = await fetch(`https://www.youtube.com/${cleanHandle}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
      const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/i) || html.match(/<meta name="description" content="([^"]+)"/i);
      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);

      if (ogTitleMatch && !title) title = ogTitleMatch[1].replace('- YouTube', '').trim();
      if (ogDescMatch && !description) description = ogDescMatch[1].trim();

      if (ogImageMatch && ogImageMatch[1] && !ogImageMatch[1].includes('desktop/yt_')) {
        avatar = ogImageMatch[1];
      }
    }
  } catch (e) {
    console.warn('Direct web fetch channel warning:', e);
  }

  return { title, description, avatar, recentVideoTitles, handle: cleanHandle };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let profile = await db.channelProfile.findUnique({
      where: { userId: user.id },
    });

    // Auto repair avatar if profile exists with handle but missing avatar
    if (profile && profile.youtubeHandle && !profile.channelAvatar) {
      const info = await fetchYouTubeChannelInfo(profile.youtubeHandle);
      if (info.avatar) {
        profile = await db.channelProfile.update({
          where: { id: profile.id },
          data: { channelAvatar: info.avatar, channelTitle: profile.channelTitle || info.title },
        });
      }
    }

    return NextResponse.json({ profile: profile || null });
  } catch (error: any) {
    console.error('GET channel profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      autoDetect = false,
      youtubeHandle,
      channelTitle,
      channelDescription,
      channelAvatar,
      niche,
      audienceAvatar,
      toneOfVoice,
      topCompetitorChannels = [],
      contentLanguage = 'English',
    } = body;

    let finalNiche = niche;
    let finalAvatar = audienceAvatar;
    let finalTone = toneOfVoice;
    let finalCompetitors = topCompetitorChannels;
    let finalTitle = channelTitle;
    let finalDescription = channelDescription;
    let finalChannelAvatar = channelAvatar;

    // Fetch real YouTube Channel metadata if handle provided
    let fetchedInfo = { title: '', description: '', avatar: '', recentVideoTitles: [] as string[], handle: youtubeHandle || '' };
    if (youtubeHandle && youtubeHandle.trim()) {
      fetchedInfo = await fetchYouTubeChannelInfo(youtubeHandle);
      if (fetchedInfo.title) finalTitle = fetchedInfo.title;
      if (fetchedInfo.description) finalDescription = fetchedInfo.description;
      if (fetchedInfo.avatar) finalChannelAvatar = fetchedInfo.avatar;
    }

    // Auto-detect using AI if requested
    if (autoDetect) {
      const GITHUB_TOKEN = getGitHubToken();
      if (GITHUB_TOKEN) {
        const prompt = `Analyze this REAL YouTube channel data and extract the creator profile:
Channel Handle: ${fetchedInfo.handle || youtubeHandle || 'N/A'}
Channel Title: ${finalTitle || 'N/A'}
Description / Bio: ${finalDescription || channelDescription || 'N/A'}
Recent Video Titles: ${fetchedInfo.recentVideoTitles.length > 0 ? fetchedInfo.recentVideoTitles.join(' | ') : 'N/A'}

Provide a JSON output with the following keys:
- niche: precise channel category (e.g. "Tech & AI Explainers", "Stoic Self-Improvement", "Personal Finance", "Gaming Commentary")
- audienceAvatar: specific target viewer persona (e.g. "Beginner creators wanting to hit 1k subs", "Curious adults interested in historical deep dives")
- toneOfVoice: tone register (e.g. "Warm, direct, conversational (Guide, Not Guru)", "High-energy, punchy, analytical")
- topCompetitorChannels: array of 3 real, popular channel names in this exact niche

Return ONLY raw JSON.`;

        try {
          const aiRes = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
            },
            body: JSON.stringify({
              model: 'openai/gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
            }),
          });

          if (aiRes.ok) {
            const data = await aiRes.json();
            const text = data.choices?.[0]?.message?.content || '';
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            finalNiche = parsed.niche || finalNiche;
            finalAvatar = parsed.audienceAvatar || finalAvatar;
            finalTone = parsed.toneOfVoice || finalTone;
            finalCompetitors = parsed.topCompetitorChannels || finalCompetitors;
          }
        } catch (err) {
          console.warn('AI auto-detect channel profile warning:', err);
        }
      }
    }

    const updatedProfile = await db.channelProfile.upsert({
      where: { userId: user.id },
      update: {
        youtubeHandle: fetchedInfo.handle || (youtubeHandle?.trim() ? (youtubeHandle.trim().startsWith('@') ? youtubeHandle.trim() : `@${youtubeHandle.trim()}`) : null),
        channelTitle: finalTitle,
        channelDescription: finalDescription,
        channelAvatar: finalChannelAvatar,
        niche: finalNiche,
        audienceAvatar: finalAvatar,
        toneOfVoice: finalTone,
        topCompetitorChannels: finalCompetitors,
        contentLanguage,
      },
      create: {
        userId: user.id,
        youtubeHandle: fetchedInfo.handle || (youtubeHandle?.trim() ? (youtubeHandle.trim().startsWith('@') ? youtubeHandle.trim() : `@${youtubeHandle.trim()}`) : null),
        channelTitle: finalTitle,
        channelDescription: finalDescription,
        channelAvatar: finalChannelAvatar,
        niche: finalNiche,
        audienceAvatar: finalAvatar,
        toneOfVoice: finalTone,
        topCompetitorChannels: finalCompetitors,
        contentLanguage,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('POST channel profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
