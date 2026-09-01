import type { HousingProgram } from "../types/program";

/**
 * 업로드된 PDF 하나를 3단계 중 어디로 보낼지 결정한다(docs/mod01-document-handling-tiers.md).
 *
 * - "A": SH 장기전세로 인식됐고(회차 텍스트 매치) 핵심 표(신청자격 트랙·소득기준)가
 *   비어있지 않게 뽑혔다. 트랙별 needs-review는 엔진 단계에서 이미 다루므로 여기서는
 *   "표 자체가 통째로 비었나"만 본다.
 * - "B": SH 장기전세로는 인식됐는데 핵심 표가 비었다 — 드리프트인지 파싱 버그인지
 *   불확실. 이전 회차 공고문을 더 요청해서 비교해야 한다(새 유형 이해 용도 아님).
 * - "C": 애초에 SH 장기전세로 인식조차 안 됨(회차 텍스트가 없음) — 처음 보는
 *   기관/상품일 가능성이 높다. 사람 검토 없이 안전한 메타데이터만 보여준다.
 */
export type DocumentTier = "A" | "B" | "C";

export interface TierClassification {
  tier: DocumentTier;
  reasons: string[];
}

export function classifyShJangiJeonseParse(program: HousingProgram, _warnings: string[]): TierClassification {
  // 회차(제N차)를 못 찾으면 parseShJangiJeonse가 id를 "sh-jangi-jeonse-unknown"으로 채운다
  // (src/parser/sh-jangi-jeonse.ts) — 이게 "SH 장기전세 서식으로도 인식 안 됨"의 신호다.
  const recognizedAsShJangiJeonse = program.id !== "sh-jangi-jeonse-unknown";

  if (!recognizedAsShJangiJeonse) {
    return {
      tier: "C",
      reasons: ["공고 회차(제N차 장기전세주택)를 찾지 못해 SH 장기전세주택 서식으로 인식되지 않았습니다."],
    };
  }

  const reasons: string[] = [];
  if (program.eligibilityTracks.length === 0) reasons.push("신청자격 트랙을 하나도 추출하지 못했습니다.");
  if (program.incomeThresholds.length === 0) reasons.push("소득기준표를 추출하지 못했습니다.");
  if (program.scoreRubrics.length === 0) reasons.push("배점표를 추출하지 못했습니다.");

  if (reasons.length > 0) {
    return { tier: "B", reasons };
  }

  return { tier: "A", reasons: [] };
}
