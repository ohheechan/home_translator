#!/usr/bin/env python3
"""
Tier A 파서의 1단계: PDF -> 페이지별 텍스트(+표) JSON.

pdfplumber.extract_text()는 레이아웃이 규칙적인 섹션(소득기준표, 자산기준표, 신생아
가산 조항, 감점기준 등)에서는 줄 단위로 깨끗하게 나온다. 반면 5단계 배점표처럼 셀이
줄바꿈되는 표는 텍스트만으로는 컬럼 정렬이 무너지므로, extract_tables()로 별도 추출해
같이 넘긴다. 어느 쪽이 정답인지는 TS 파서가 필드별로 골라 쓴다 — 이 스크립트는 "이해"는
하지 않고 원자료만 최대한 깨끗하게 넘기는 역할.

사용: python3 pdf_to_text.py <input.pdf> <output.json>
"""
import sys
import json
import pdfplumber


def main():
    if len(sys.argv) != 3:
        print("usage: pdf_to_text.py <input.pdf> <output.json>", file=sys.stderr)
        sys.exit(1)
    in_path, out_path = sys.argv[1], sys.argv[2]

    pages = []
    with pdfplumber.open(in_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            try:
                tables = page.extract_tables()
            except Exception:
                tables = []
            pages.append(
                {
                    "pageNumber": i + 1,  # 1-indexed, 공고문 하단 쪽수와 대체로 일치
                    "text": text,
                    "tables": tables,  # list[list[list[str|None]]]
                }
            )

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"pageCount": len(pages), "pages": pages}, f, ensure_ascii=False, indent=1)

    print(f"OK: {len(pages)} pages -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
