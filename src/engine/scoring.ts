import type { HousingProgram, ScoreItem, ScoreMetric, ScoreRubric } from "../types/program";
import type { UserProfile } from "../types/profile";
import { evaluateCondition, type ResolvedContext } from "./eligibility";
import { addYears, ageInYears, yearsBetween } from "./date";

/**
 * Step 5: 배점 계산 엔진. ScoreRubric/ScoreItem만 보고 동작하며(program.ts에
 * "sh-jangi-jeonse-51" 언급이 없는 것처럼) 여기도 특정 공고 이름을 언급하지 않는다.
 *
 * 세 가지가 아니라 네 가지 결과를 구분한다: computed(계산됨) / not-applicable(그
 * 항목 자체가 해당 없음 — 0점이 맞는 답) / unknown(계산에 필요한 정보가 없음 — 0점
 * 취급하되 "몰라서 0"이라는 걸 화면에 알려야 함). eligibility.ts의 pass/fail/unknown
 * 구분과 같은 이유: "모른다"를 "0점"으로 조용히 뭉개면 사용자가 실제보다 낮은 점수를
 * 보고 오해할 수 있다.
 */

export type ItemScoreStatus = "computed" | "not-applicable" | "unknown";

export interface ItemScoreResult {
  itemId: string;
  criterion: string;
  points: number;
  status: ItemScoreStatus;
  note?: string;
}

export interface RubricScoreResult {
  rubricId: string;
  items: ItemScoreResult[];
  penalties: ItemScoreResult[];
  subtotal: number; // items 합
  penaltyTotal: number; // penalties 합(음수)
  total: number;
  /** 하나라도 unknown이 섞여 있으면 total을 "확정 점수"로 표시하면 안 된다. */
  hasUnknown: boolean;
}

export interface ScoringContext {
  asOfDate?: string; // 기본값 program.noticeDate
}

type MetricValue =
  | { kind: "numeric"; value: number }
  | { kind: "categorical"; categories: string[] }
  | { kind: "not-applicable"; note?: string }
  | { kind: "unknown"; note: string };

export function computeScore(
  profile: UserProfile,
  program: HousingProgram,
  ctx: ScoringContext = {},
): RubricScoreResult | { status: "no-rubric"; note: string } {
  const asOfDate = ctx.asOfDate ?? program.noticeDate;
  const rubric = pickApplicableRubric(program, profile, asOfDate);
  if (!rubric) {
    return { status: "no-rubric", note: "적용할 배점표를 찾지 못했습니다." };
  }
  const items = rubric.items.map((item) => scoreItem(item, profile, asOfDate));
  const penalties = (rubric.penalties ?? []).map((item) => scoreItem(item, profile, asOfDate));
  const subtotal = items.reduce((sum, i) => sum + i.points, 0);
  const penaltyTotal = penalties.reduce((sum, i) => sum + i.points, 0);
  return {
    rubricId: rubric.id,
    items,
    penalties,
    subtotal,
    penaltyTotal,
    total: subtotal + penaltyTotal,
    hasUnknown: [...items, ...penalties].some((i) => i.status === "unknown"),
  };
}

/**
 * "가장 구체적인 배점표"를 우선한다: appliesWhen이 비어 있지 않은 배점표 중 하나라도
 * 조건이 전부 pass면 그걸 쓰고, 없으면 appliesWhen이 빈(=기본값) 배점표로 떨어진다.
 * 데이터 배열 순서에 의존하지 않도록 일부러 이렇게 짰다(sh-jangi-jeonse-51.ts의
 * sr-general.appliesWhen 코멘트 참고).
 */
function pickApplicableRubric(program: HousingProgram, profile: UserProfile, asOfDate: string): ScoreRubric | undefined {
  const ctx: ResolvedContext = { asOfDate };
  const specific = program.scoreRubrics.filter((r) => r.appliesWhen.length > 0);
  const matched = specific.find((r) => r.appliesWhen.every((c) => evaluateCondition(c, profile, ctx).status === "pass"));
  if (matched) return matched;
  return program.scoreRubrics.find((r) => r.appliesWhen.length === 0);
}

function scoreItem(item: ScoreItem, profile: UserProfile, asOfDate: string): ItemScoreResult {
  const value = computeMetricValue(item.metric, profile, asOfDate);
  const base = { itemId: item.id, criterion: item.criterion };

  if (value.kind === "not-applicable") return { ...base, points: 0, status: "not-applicable", note: value.note };
  if (value.kind === "unknown") return { ...base, points: 0, status: "unknown", note: value.note };

  if (value.kind === "numeric") {
    const points = pointsForNumericTier(item, value.value);
    if (points == null) {
      return {
        ...base,
        points: 0,
        status: "unknown",
        note: `값 ${value.value}에 해당하는 배점 구간을 찾지 못했습니다(공고문에 그 구간이 명시돼 있지 않을 수 있음).`,
      };
    }
    return { ...base, points, status: "computed" };
  }

  // categorical
  const points = pointsForCategoryTier(item, value.categories);
  if (points == null) return { ...base, points: 0, status: "not-applicable", note: "해당하는 특별자격이 없습니다." };
  return { ...base, points, status: "computed" };
}

function pointsForNumericTier(item: ScoreItem, value: number): number | undefined {
  const eligible = item.tiers.filter((t) => t.matchesAnyOf == null && value >= t.minValue);
  if (eligible.length === 0) return undefined;
  return eligible.reduce((best, t) => (t.minValue > best.minValue ? t : best)).points;
}

function pointsForCategoryTier(item: ScoreItem, categories: string[]): number | undefined {
  const matched = item.tiers.find((t) => t.matchesAnyOf?.some((c) => categories.includes(c)));
  return matched?.points;
}

function computeMetricValue(metric: ScoreMetric, profile: UserProfile, asOfDate: string): MetricValue {
  const { base, detail } = profile;
  switch (metric.type) {
    case "seoul-residency-years":
      if (!detail?.seoulLastMoveInDate) return { kind: "unknown", note: "서울시 최종 전입일 미입력" };
      return { kind: "numeric", value: yearsBetween(detail.seoulLastMoveInDate, asOfDate) };

    case "homeless-period-years": {
      if (!detail?.birthDate) return { kind: "unknown", note: "생년월일 미입력" };
      const age = ageInYears(detail.birthDate, asOfDate);
      if (base.maritalStatus === "미혼" && age < 30) {
        return { kind: "not-applicable", note: "만30세 미만 미혼신청자는 무주택기간 점수가 없습니다." };
      }
      const basis = detail.homelessPeriodBasis;
      let start = addYears(detail.birthDate, 30);
      if (basis?.marriedBeforeAge30) {
        if (!basis.marriageRegisteredOn) return { kind: "unknown", note: "혼인신고일 미입력" };
        start = basis.marriageRegisteredOn;
      }
      if (basis?.previouslyOwnedHome) {
        if (!basis.homeDisposedOn) return { kind: "unknown", note: "주택 처분일 미입력" };
        if (basis.homeDisposedOn > start) start = basis.homeDisposedOn;
      }
      return { kind: "numeric", value: yearsBetween(start, asOfDate) };
    }

    case "applicant-age":
      if (!detail?.birthDate) return { kind: "unknown", note: "생년월일 미입력" };
      return { kind: "numeric", value: ageInYears(detail.birthDate, asOfDate) };

    case "dependents-count":
      if (detail?.dependentsCount == null) return { kind: "unknown", note: "부양가족수 미입력" };
      return { kind: "numeric", value: detail.dependentsCount };

    case "minor-children-count":
      if (detail?.minorChildrenCount == null) return { kind: "unknown", note: "미성년자녀수 미입력" };
      return { kind: "numeric", value: detail.minorChildrenCount };

    case "savings-installments":
      if (base.installments == null) return { kind: "unknown", note: "청약통장 납입횟수 미입력" };
      return { kind: "numeric", value: base.installments };

    case "savings-membership-years":
      if (!base.joinedOn) return { kind: "unknown", note: "청약통장 가입일 미입력" };
      return { kind: "numeric", value: yearsBetween(base.joinedOn, asOfDate) };

    case "special-category-match":
      return { kind: "categorical", categories: detail?.specialCategories ?? [] };

    case "prior-contract-elapsed-years": {
      const h = detail?.priorLongTermLeaseHistory;
      if (!h) return { kind: "unknown", note: "임대차계약 이력 정보 미입력" };
      if (!h.hasHistory) return { kind: "not-applicable" };
      if (!h.contractedOn) return { kind: "unknown", note: "계약 시점 미입력" };
      return { kind: "numeric", value: yearsBetween(h.contractedOn, asOfDate) };
    }
  }
}
