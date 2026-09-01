import { NextRequest, NextResponse } from "next/server";
import { fetchShNoticeList } from "../../../server/sh-portal";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const q = searchParams.get("q") ?? undefined;

  try {
    const result = await fetchShNoticeList({ page, srchWord: q });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SH 공고 목록을 가져오지 못했어요." },
      { status: 502 },
    );
  }
}
