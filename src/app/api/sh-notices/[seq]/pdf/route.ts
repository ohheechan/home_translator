import { NextResponse } from "next/server";
import { fetchShNoticePdf } from "../../../../../server/sh-portal";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params;
  if (!/^\d+$/.test(seq)) {
    return NextResponse.json({ error: "잘못된 공고 번호예요." }, { status: 400 });
  }
  try {
    const { bytes, fileName, contentType } = await fetchShNoticePdf(seq);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF를 가져오지 못했어요." },
      { status: 502 },
    );
  }
}
