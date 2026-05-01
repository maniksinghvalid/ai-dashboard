import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Placeholder: actual data fetching will be implemented in later tickets
  return NextResponse.json({
    status: "ok",
    refreshedAt: new Date().toISOString(),
  });
}
