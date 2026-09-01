import type { RuleCondition } from "../types/program";
import type { TrackEvaluation, ConditionStatus } from "./eligibility";
import type { RubricScoreResult, ItemScoreStatus } from "./scoring";

/**
 * Step 7: 판정/배점 결과를 화면(Result.dc.html의 "핵심 조건 요약 · 내 자격 판정 ·
 * 예상 가점 · 면책문구" 구조)에 바로 얹을 수 있는 형태로 다듬는다. 여기서 새 판정
 * 로직은 만들지 않는다 — eligibility.ts/scoring.ts가 이미 낸 결론을 사람이 읽을
 * 문장으로 바꾸는 것만 한다.
 *
 * 면책문구는 와이어프레임 Result.dc.html에 쓴 문장을 그대로 가져온다 — 두 군데가
 * 서로 다른 말을 하면 안 되기 때문이다. 문구를 바꿀 일이 있으면 이 파일과
 * Result.dc.html을 같이 고쳐야 한다.
 */

export const PRELIMINARY_ESTIMATE_DISCLAIMER =
  "이 결과는 입력하신 정보 기준의 예비 추정치이며 법적 효력이 없습니다. 소득·자산 등 실제 자격은 서류심사 시 공적자료로 최종 확인되며, 대출 금리·한도는 은행 또는 청약홈에서 반드시 다시 확인하세요.";

export type Headline = "신청 가능" | "신청 불가" | "확인 필요";

export interface PresentedChecklistItem {
  label: string;
  status: ConditionStatus | "pass" | "fail" | "unknown";
  detail?: string;
}

export interface PresentedScoreItem {
  label: string;
  points: number;
  status: ItemScoreStatus;
  note?: string;
}

export interface PresentedResult {
  headline: Headline;
  trackLabel: string;
  /** headline이 "확인 필요"일 때, 무엇을 더 입력/확인해야 하는지 모아서 보여줄 목록 */
  outstandingItems: string[];
  checklist: PresentedChecklistItem[];
  score?: {
    total: number;
    /** 이 프로그램은 84점 만점 같은 고정 상한이 없다(design doc 05장 참고) —
     *  그래서 maxScore가 아니라 "만점 없음, 항목별 합산"이라는 사실 자체를 알린다. */
    hasFixedMax: false;
    hasUnknown: boolean;
    items: PresentedScoreItem[];
    penalties: PresentedScoreItem[];
  };
  disclaimer: string;
}

const CONDITION_LABELS: Record<RuleCondition["type"], string> = {
  "area-range": "희망 면적",
  "supply-method": "공급방식",
  "applicant-rank": "순위",
  "dual-income": "맞벌이 여부",
  residency: "거주지역 요건",
  "savings-account": "청약통장 요건",
  "household-status": "무주택·주거약자 요건",
  "newborn-children-count": "출생자녀 가산 요건",
  "pre-existing-minor-child": "출생자녀 가산 요건",
  custom: "그 외 요건(공고문 원문 확인 필요)",
};

function conditionLabel(condition: RuleCondition): string {
  return CONDITION_LABELS[condition.type];
}

function formatWon(won: number): string {
  if (!Number.isFinite(won)) return "-";
  const man = Math.round(won / 10_000);
  return `${man.toLocaleString("ko-KR")}만원`;
}

function headlineFor(status: TrackEvaluation["status"]): Headline {
  if (status === "eligible") return "신청 가능";
  if (status === "ineligible") return "신청 불가";
  return "확인 필요";
}

export function presentTrackResult(
  track: TrackEvaluation,
  score?: RubricScoreResult | { status: "no-rubric"; note: string },
  options: { desiredAreaM2?: number } = {},
): PresentedResult {
  const checklist: PresentedChecklistItem[] = [
    {
      label: "소득기준",
      status: track.income.status,
      detail:
        track.income.status === "unknown"
          ? track.income.note
          : track.income.limitWon != null && track.income.actualWon != null
            ? `가구소득 ${formatWon(track.income.actualWon)} / 기준 ${formatWon(track.income.limitWon)} 이하${
                track.income.appliedAdjustmentReasons.length ? ` (가산 적용: ${track.income.appliedAdjustmentReasons.join(", ")})` : ""
              }`
            : track.income.note,
    },
    {
      label: "자산기준",
      status: track.asset.status,
      detail:
        track.asset.status === "unknown"
          ? track.asset.note
          : track.asset.totalAssetLimitWon != null
            ? `총자산 ${formatWon(track.asset.totalAssetActualWon ?? 0)} / 기준 ${formatWon(track.asset.totalAssetLimitWon)} 이하, ` +
              `자동차 ${formatWon(track.asset.vehicleValueActualWon ?? 0)} / 기준 ${formatWon(track.asset.vehicleValueLimitWon ?? 0)} 이하`
            : track.asset.note,
    },
    ...track.conditionResults
      .filter((c) => c.status !== "pass")
      .map((c) => ({ label: conditionLabel(c.condition), status: c.status, detail: c.note })),
  ];

  const outstandingItems = checklist
    .filter((c) => c.status === "unknown" || c.status === "needs-review")
    .map((c) => `${c.label}${c.detail ? ": " + c.detail : ""}`);

  let presentedScore: PresentedResult["score"];
  if (score && !("status" in score)) {
    const relevantItems = score.items.filter((i) => {
      // si-savings-85-under / si-deposit-period-85-over는 상호 배타적 — 희망 면적을
      // 알면 관련 없는 쪽은 화면에서 뺀다(엔진은 둘 다 계산해서 넘겨준다).
      if (options.desiredAreaM2 == null) return true;
      if (i.itemId === "si-savings-85-under" && options.desiredAreaM2 > 85) return false;
      if (i.itemId === "si-deposit-period-85-over" && options.desiredAreaM2 <= 85) return false;
      return true;
    });
    const relevantIds = new Set(relevantItems.map((i) => i.itemId));
    const total =
      relevantItems.reduce((s, i) => s + i.points, 0) + score.penalties.reduce((s, i) => s + i.points, 0);
    presentedScore = {
      total,
      hasFixedMax: false,
      hasUnknown: [...relevantItems, ...score.penalties].some((i) => i.status === "unknown"),
      items: relevantItems
        .filter((i) => relevantIds.has(i.itemId))
        .map((i) => ({ label: i.criterion, points: i.points, status: i.status, note: i.note })),
      penalties: score.penalties.map((i) => ({ label: i.criterion, points: i.points, status: i.status, note: i.note })),
    };
    if (presentedScore.hasUnknown) {
      outstandingItems.push("배점 세부정보 일부 미입력 — 입력하면 더 정확한 예상순위를 볼 수 있어요");
    }
  } else if (score && "status" in score) {
    outstandingItems.push(score.note);
  }

  return {
    headline: headlineFor(track.status),
    trackLabel: track.label,
    outstandingItems,
    checklist,
    score: presentedScore,
    disclaimer: PRELIMINARY_ESTIMATE_DISCLAIMER,
  };
}
