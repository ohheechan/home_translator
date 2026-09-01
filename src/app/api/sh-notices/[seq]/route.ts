import { NextResponse } from "next/server";
import { fetchShNoticeDetail } from "../../../../server/sh-portal";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params;
  if (!/^\d+$/.test(seq)) {
    return NextResponse.json({ error: "잘못된 공고 번호예요." }, { status: 400 });
  }
  try {
    const detail = await fetchShNoticeDetail(seq);
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "공고 상세를 가져오지 못했어요." },
      { status: 502 },
    );
  }
}
