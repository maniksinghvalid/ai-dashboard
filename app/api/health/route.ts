import { NextResponse } from "next/server";
import { getRedis } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = getRedis();
    const ping = await redis.ping();
    return NextResponse.json({ status: "ok", redis: ping });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        redis: "unreachable",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
