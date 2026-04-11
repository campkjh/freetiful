import { NextRequest, NextResponse } from 'next/server';

const YT_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// GET /api/youtube?action=searchChannels&q=채널명
// GET /api/youtube?action=channelVideos&channelId=UCxxx
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  if (!YT_KEY) return NextResponse.json({ error: 'API key missing' }, { status: 500 });

  // 1. Search channels by name
  if (action === 'searchChannels') {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) return NextResponse.json({ channels: [] });

    const res = await fetch(
      `${YT_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(q)}&maxResults=5&key=${YT_KEY}`,
    );
    const data = await res.json();
    const channels = (data.items || []).map((item: Record<string, any>) => ({
      id: item.id?.channelId || item.snippet?.channelId,
      title: item.snippet?.title,
      thumbnail: item.snippet?.thumbnails?.default?.url,
      description: item.snippet?.description?.slice(0, 80),
    }));
    return NextResponse.json({ channels });
  }

  // 2. Get videos from a channel
  if (action === 'channelVideos') {
    const channelId = req.nextUrl.searchParams.get('channelId');
    if (!channelId) return NextResponse.json({ videos: [] });

    const res = await fetch(
      `${YT_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${YT_KEY}`,
    );
    const data = await res.json();
    const videos = (data.items || []).map((item: Record<string, any>) => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      thumbnail: item.snippet?.thumbnails?.medium?.url,
      publishedAt: item.snippet?.publishedAt,
    }));
    return NextResponse.json({ videos });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
