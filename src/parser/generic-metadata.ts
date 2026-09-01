import { allText, type PdfExtraction } from "./types";

/**
 * Tier C 전용: "처음 보는 기관/상품" PDF에서도 구조를 몰라도 범용 패턴으로 뽑을 수 있는,
 * 리스크 낮은 정보만 최선껏 추출한다(docs/mod01-document-handling-tiers.md 참고).
 *
 * 자격판정·배점처럼 표 구조를 이해해야 하는 값은 여기서 절대 다루지 않는다 — 못 찾으면
 * 그 필드는 그냥 undefined로 비워둔다(추측 금지, 프로젝트 전체 원칙과 동일).
 */
export interface GenericDocumentMetadata {
  title?: string;
  agencyGuess?: string;
  noticeDate?: string;
  contactPhones: string[];
  addressHints: string[];
}

const AGENCY_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /서울주택도시공사|SH\s*공사|SH공사/, label: "서울주택도시공사(SH)" },
  { pattern: /한국토지주택공사|LH\s*공사|LH공사/, label: "한국토지주택공사(LH)" },
  { pattern: /경기주택도시공사|GH\s*공사/, label: "경기주택도시공사(GH)" },
  { pattern: /인천도시공사/, label: "인천도시공사" },
];

/** 문서 첫 페이지에서 가장 그럴듯한 "제목"을 찾는다 — 완벽할 필요 없음, 못 찾으면 undefined. */
function guessTitle(pdf: PdfExtraction): string | undefined {
  const firstPage = pdf.pages[0];
  if (!firstPage) return undefined;
  const lines = firstPage.text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // "공고" 또는 "모집"이 들어간 첫 줄을 제목으로 추정(공고문 표지 관례).
  const candidate = lines.find((l) => /공고|모집/.test(l) && l.length >= 6 && l.length <= 80);
  return candidate;
}

function guessAgency(text: string): string | undefined {
  for (const { pattern, label } of AGENCY_KEYWORDS) {
    if (pattern.test(text)) return label;
  }
  return undefined;
}

/** "공고일은 2026.1.1." 류의 표현이 없는 새 서식 대비, 조금 더 느슨한 날짜 패턴. */
function guessNoticeDate(text: string): string | undefined {
  const patterns = [
    /공고일\s*[:：]?\s*(\d{4})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})/,
    /공고\s*(\d{4})[.\-]\s*(\d{1,2})[.\-]\s*(\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return undefined;
}

function guessPhones(text: string): string[] {
  const matches = text.match(/0\d{1,2}-\d{3,4}-\d{4}/g) ?? [];
  return [...new Set(matches)].slice(0, 5);
}

/** "OO구 OO동" 패턴 — 정확한 지번 주소는 못 뽑아도 대략적인 위치 힌트는 준다. */
function guessAddressHints(text: string): string[] {
  const matches = text.match(/서울특별시\s*[가-힣]{2,4}구(\s*[가-힣0-9]{1,10}동)?/g) ?? [];
  return [...new Set(matches)].slice(0, 5);
}

export function extractGenericMetadata(pdf: PdfExtraction): GenericDocumentMetadata {
  const text = allText(pdf);
  return {
    title: guessTitle(pdf),
    agencyGuess: guessAgency(text),
    noticeDate: guessNoticeDate(text),
    contactPhones: guessPhones(text),
    addressHints: guessAddressHints(text),
  };
}
