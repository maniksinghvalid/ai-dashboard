import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import type { Video } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<Video[]>(CACHE_KEYS.youtube, CACHE_MAX_AGE.default);

  if (!cached) {
    return NextResponse.json(
      { data: [], cachedAt: null, stale: false, error: "No data available" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: cached.data,
    cachedAt: cached.fetchedAt,
    stale: cached.stale,
  });
}
