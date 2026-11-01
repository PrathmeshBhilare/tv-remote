import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface YouTubeVideoResult {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  thumbnailUrl?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ success: true, videos: [] });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to search YouTube' });
    }

    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);

    if (!match) {
      return NextResponse.json({ success: true, videos: [] });
    }

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents || [];

    const videos: YouTubeVideoResult[] = [];

    for (const item of contents) {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        const id = v.videoId;
        const title = v.title?.runs?.[0]?.text || 'Video';
        const channel = v.ownerText?.runs?.[0]?.text || '';
        const duration = v.lengthText?.simpleText || '';
        const thumbnailUrl = v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

        if (id) {
          videos.push({
            id,
            title,
            channel,
            duration,
            thumbnailUrl,
          });
        }

        if (videos.length >= 6) break;
      }
    }

    return NextResponse.json({ success: true, videos });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Search failed',
    });
  }
}

