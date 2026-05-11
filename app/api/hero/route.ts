import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/helpers";
import { CACHE_KEYS, CACHE_MAX_AGE } from "@/lib/constants";
import type { HeroStory } from "@/lib/types";

/**
 * Hero eligibility threshold: a topic is hero-promoted when it appears in the
 * top-3 on all 3 platforms (YouTube AND Reddit AND X), ranked by aggregate
 * velocity. This is a deliberate relaxation from the SCRUM-38 ticket's literal
 * "#1 on all 3" wording — sparse X data made strict #1 rarely fire. See D3 in
 * .planning/phases/01-scrum-38-implementation/01-CONTEXT.md before tightening.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<HeroStory>(CACHE_KEYS.hero, CACHE_MAX_AGE.tenMin);

  if (!cached) {
    return NextResponse.json(
      {
        data: null,
        cachedAt: null,
        stale: false,
        error: "No qualifying cross-platform topic",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: cached.data,
    cachedAt: cached.fetchedAt,
    stale: cached.stale,
  });
}
