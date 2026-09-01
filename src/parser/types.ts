/**
 * Tier A 파서 공통 타입. PDF 자체는 안 다루고(그건 scripts-py/pdf_to_text.py가 함),
 * 그 결과물(JSON)을 이 타입으로 받아서 구조화한다.
 */

export interface PdfPage {
  pageNumber: number; // 1-indexed
  text: string;
  /** pdfplumber.extract_tables() 결과. 셀이 비어있으면 null. */
  tables: (string | null)[][][];
}

export interface PdfExtraction {
  pageCount: number;
  pages: PdfPage[];
}

/**
 * 파서가 뭔가를 못 찾거나 확신하지 못했을 때 쌓는 경고. 이게 하나라도 있으면
 * verifiedBy: "rule-parsed" 데이터를 엔진에 바로 태우면 안 된다(Tier B로 취급) —
 * "모르면 조용히 틀리지 말고 확실히 모른다고 말한다" 원칙을 파서 단계에도 적용.
 */
export type ParseWarnings = string[];

export function allText(pdf: PdfExtraction): string {
  return pdf.pages.map((p) => p.text).join("\n");
}

/** marker 정규식이 매치되는 첫 페이지를 찾는다. 못 찾으면 undefined. */
export function findPage(pdf: PdfExtraction, marker: RegExp): PdfPage | undefined {
  return pdf.pages.find((p) => marker.test(p.text));
}

/** "1,234,567" 형태의 숫자 문자열(콤마 포함)을 정수로 변환. */
export function parseCommaNumber(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10);
}
