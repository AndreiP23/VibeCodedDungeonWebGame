import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_PREFIX = "https://image.pollinations.ai/";
const MAX_CACHE_ENTRIES = 200;

interface CachedImage {
  bytes: ArrayBuffer;
  contentType: string;
}

// In-memory byte cache keyed by raw pollinations URL. The whole point of this
// proxy is to (1) sidestep cross-origin gotchas and (2) shield the user from
// pollinations.ai rate limits — caching the image bytes once they arrive is
// what lets the avatar shown on /character also appear on /game without a
// fresh upstream hit. Naive FIFO eviction at MAX_CACHE_ENTRIES.
const byteCache = new Map<string, CachedImage>();

function cacheGet(key: string): CachedImage | undefined {
  return byteCache.get(key);
}

function cacheSet(key: string, value: CachedImage): void {
  if (byteCache.size >= MAX_CACHE_ENTRIES) {
    // Drop the oldest entry (Map preserves insertion order).
    const firstKey = byteCache.keys().next().value;
    if (firstKey !== undefined) byteCache.delete(firstKey);
  }
  byteCache.set(key, value);
}

// Server-side proxy so the browser's <img> requests are same-origin. Avoids
// referrer/CSP/CORS gotchas that prevent direct embedding of pollinations URLs.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith(POLLINATIONS_PREFIX)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const cached = cacheGet(url);
  if (cached) {
    return new NextResponse(cached.bytes, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Proxy-Cache": "HIT",
      },
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(`Upstream returned ${upstream.status}`, {
        status: upstream.status >= 400 ? upstream.status : 502,
      });
    }

    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
    const bytes = await upstream.arrayBuffer();
    cacheSet(url, { bytes, contentType });

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Proxy-Cache": "MISS",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    return new NextResponse(`Proxy error: ${message}`, { status: 502 });
  }
}
