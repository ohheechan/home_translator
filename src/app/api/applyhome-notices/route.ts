import { NextRequest, NextResponse } from "next/server";
import { fetchApplyhomeNotices } from "../../../server/applyhome";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") ?? "서울";
  try {
    const items = await fetchApplyhomeNotices({ regionKeyword: region });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "청약홈 공고 목록을 가져오지 못했어요." },
      { status: 502 },
    );
  }
}
