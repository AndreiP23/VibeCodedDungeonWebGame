import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_PREFIX = "https://image.pollinations.ai/";

// Server-side proxy so the browser's <img> requests are same-origin. Avoids
// referrer/CSP/CORS gotchas that prevent direct embedding of pollinations URLs.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith(POLLINATIONS_PREFIX)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      // Tell pollinations we're a normal image consumer.
      headers: { Accept: "image/*" },
      // Pollinations is slow on first hit; give it room.
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(`Upstream returned ${upstream.status}`, {
        status: upstream.status >= 400 ? upstream.status : 502,
      });
    }

    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // Pollinations URLs are deterministic by seed, so cache aggressively.
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    return new NextResponse(`Proxy error: ${message}`, { status: 502 });
  }
}
