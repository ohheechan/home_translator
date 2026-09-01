import type {
  HousingProgram,
  RuleCondition,
  EligibilityTrack,
  IncomeThresholdTable,
  ThresholdAdjustment,
  MedianIncomeTable,
} from "../types/program";
import type { UserProfile } from "../types/profile";
import { yearsBetween } from "./date";

/**
 * Step 4: 순위/자격 판정 엔진. HousingProgram과 UserProfile만 보고 동작하며
 * "sh-jangi-jeonse-51" 같은 특정 공고문 이름을 코드 어디에도 언급하지 않는다
 * (program.ts 맨 위에 적힌 설계 원칙 그대로).
 *
 * 세 가지 상태(pass/fail/unknown, 트랙 전체로는 eligible/ineligible/needs-review)로
 * 결과를 낸다 — "모른다"를 "된다"로 뭉개지 않는 게 핵심이다. 실제로 이 프로그램의
 * 소득·자산은 자가진단이 아니라 서류심사에서 공적자료로 확정되므로(디자인 문서
 * 09장 참고), 이 엔진의 출력은 어차피 "예비 추정"일 수밖에 없다 — unknown을
 * 정직하게 남기는 것이 그 전제와도 맞는다.
 */

/**
 * "needs-review"는 "unknown"과 구분한다: unknown은 사용자가 값을 더 입력하면
 * 풀리는 데이터 부족(예: 배점 세부정보 미입력)이고, needs-review는 애초에
 * custom 탈출구처럼 기계적으로 판정할 수 없어서 사람이 공고문 원문을 봐야
 * 하는 경우다. 둘 다 트랙 상태를 "needs-review"로 밀어올리는 건 같지만,
 * 화면에서는 서로 다른 안내 문구가 필요하다(전자는 "입력하면 확인돼요",
 * 후자는 "공고문을 직접 확인해주세요").
 */
export type ConditionStatus = "pass" | "fail" | "unknown" | "needs-review";

export interface ConditionEvaluation {
  condition: RuleCondition;
  status: ConditionStatus;
  note?: string;
}

export interface IncomeEvaluation {
  status: "pass" | "fail" | "unknown";
  thresholdId?: string;
  limitWon?: number;
  actualWon?: number;
  appliedAdjustmentReasons: string[];
  note?: string;
}

export interface AssetEvaluation {
  status: "pass" | "fail" | "unknown";
  thresholdId?: string;
  totalAssetLimitWon?: number;
  totalAssetActualWon?: number;
  vehicleValueLimitWon?: number;
  vehicleValueActualWon?: number;
  appliedAdjustmentReasons: string[];
  note?: string;
}

export type TrackStatus = "eligible" | "ineligible" | "needs-review";

export interface TrackEvaluation {
  trackId: string;
  label: string;
  rank: number;
  status: TrackStatus;
  conditionResults: ConditionEvaluation[];
  income: IncomeEvaluation;
  asset: AssetEvaluation;
}

export interface EvaluationContext {
  /** 신청 희망 면적(㎡). 없으면 면적 조건이 있는 트랙은 "unknown"으로 남는다. */
  desiredAreaM2?: number;
  desiredSupplyMethod?: string;
  /**
   * HousingProgram/EligibilityTrack에는 "이 공고에 포함된 개별 단지가 각각
   * 어느 자치구에 있는지"를 담는 자료가 없다(실측: SH 51차는 단지마다 자치구가
   * 다른데 — 강남구/구로구/성북구 등 — EligibilityTrack은 면적·공급방식·순위
   * 단위로만 나뉜다). residency 조건("신청주택이 위치한 자치구" 등)을 판정하려면
   * 어떤 단지를 보고 있는지가 필요해서 호출자가 여기로 넘겨야 한다. 이건 알려진
   * 스키마 갭이다 — 다음에 HousingProgram에 단지(HousingUnit) 목록을 추가해서
   * program.ts 안으로 옮기는 게 맞아 보인다.
   */
  unitDistrict?: string;
  adjacentDistricts?: string[];
  /** YYYY-MM-DD. 기본값은 program.noticeDate — 청약통장 가입기간 등 기간 계산의 기준일. */
  asOfDate?: string;
}

export interface ResolvedContext extends EvaluationContext {
  asOfDate: string;
}

export function evaluateProgram(
  profile: UserProfile,
  program: HousingProgram,
  medianIncomeTables: MedianIncomeTable[],
  ctx: EvaluationContext = {},
): TrackEvaluation[] {
  const resolved: ResolvedContext = { ...ctx, asOfDate: ctx.asOfDate ?? program.noticeDate };
  return program.eligibilityTracks.map((track) =>
    evaluateTrack(profile, program, track, medianIncomeTables, resolved),
  );
}

function evaluateTrack(
  profile: UserProfile,
  program: HousingProgram,
  track: EligibilityTrack,
  medianIncomeTables: MedianIncomeTable[],
  ctx: ResolvedContext,
): TrackEvaluation {
  const conditionResults = track.conditions.map((c) => evaluateCondition(c, profile, ctx));
  const income = evaluateIncome(profile, program, track, medianIncomeTables);
  const asset = evaluateAsset(profile, program, track);

  const hasFail =
    conditionResults.some((r) => r.status === "fail") || income.status === "fail" || asset.status === "fail";
  const hasUnknown =
    conditionResults.some((r) => r.status === "unknown" || r.status === "needs-review") ||
    income.status === "unknown" ||
    asset.status === "unknown";

  const status: TrackStatus = hasFail ? "ineligible" : hasUnknown ? "needs-review" : "eligible";

  return { trackId: track.id, label: track.label, rank: track.rank, status, conditionResults, income, asset };
}

// ── 조건 판정 ────────────────────────────────────────────────────

/** scoring.ts에서도 ScoreRubric.appliesWhen 판정에 재사용한다(단일 소스 유지). */
export function evaluateCondition(condition: RuleCondition, profile: UserProfile, ctx: ResolvedContext): ConditionEvaluation {
  const { base, detail } = profile;
  switch (condition.type) {
    case "area-range": {
      if (ctx.desiredAreaM2 == null) {
        return { condition, status: "unknown", note: "희망 면적을 아직 선택하지 않았습니다." };
      }
      const a = ctx.desiredAreaM2;
      if (condition.minM2 != null) {
        const ok = condition.minExclusive ? a > condition.minM2 : a >= condition.minM2;
        if (!ok) return { condition, status: "fail" };
      }
      if (condition.maxM2 != null) {
        const ok = condition.maxExclusive ? a < condition.maxM2 : a <= condition.maxM2;
        if (!ok) return { condition, status: "fail" };
      }
      return { condition, status: "pass" };
    }
    case "supply-method": {
      if (!ctx.desiredSupplyMethod) {
        return { condition, status: "unknown", note: "희망 공급방식을 아직 선택하지 않았습니다." };
      }
      return { condition, status: ctx.desiredSupplyMethod === condition.value ? "pass" : "fail" };
    }
    case "applicant-rank":
      // rank는 트랙 자체의 속성(EligibilityTrack.rank)으로 이미 표현되므로
      // 신청자 프로필과 직접 비교할 대상이 아니다 — 이 조건 유형은 지금까지
      // 실측 데이터에서 쓰인 적이 없다(program.ts 코멘트 참고).
      return { condition, status: "unknown", note: "순위는 조건이 아니라 트랙 판정 결과로 정해집니다." };
    case "dual-income":
      return { condition, status: base.dualIncome === condition.value ? "pass" : "fail" };
    case "residency":
      return evaluateResidency(condition, profile, ctx);
    case "savings-account":
      return evaluateSavingsAccount(condition, base, ctx.asOfDate);
    case "household-status":
      if (condition.value === "무주택세대구성원") {
        return { condition, status: base.housingOwnership === "무주택세대구성원" ? "pass" : "fail" };
      }
      return { condition, status: base.accessibleHousingTarget ? "pass" : "fail" };
    case "newborn-children-count": {
      const n = detail?.newbornChildAdjustment?.childrenBornAfter20230328;
      if (n == null) {
        return { condition, status: "unknown", note: "출생자녀 정보가 없습니다(배점 세부정보 미입력)." };
      }
      if (condition.min != null && n < condition.min) return { condition, status: "fail" };
      if (condition.max != null && n > condition.max) return { condition, status: "fail" };
      return { condition, status: "pass" };
    }
    case "pre-existing-minor-child": {
      const v = detail?.newbornChildAdjustment?.hasMinorChildBornOnOrBefore20230327;
      if (v == null) {
        return { condition, status: "unknown", note: "출생자녀 정보가 없습니다(배점 세부정보 미입력)." };
      }
      return { condition, status: v === condition.value ? "pass" : "fail" };
    }
    case "custom":
      // 자유 서술형 예외조항 — 기계적으로 판정할 수 없다는 게 이 탈출구의
      // 존재 이유이므로 여기서 억지로 판정하지 않는다.
      return { condition, status: "needs-review", note: condition.description };
  }
}

function evaluateResidency(
  condition: Extract<RuleCondition, { type: "residency" }>,
  profile: UserProfile,
  ctx: ResolvedContext,
): ConditionEvaluation {
  if (ctx.unitDistrict == null) {
    return {
      condition,
      status: "unknown",
      note:
        "신청하려는 특정 단지의 자치구를 알아야 판정할 수 있습니다 — HousingProgram에는 단지별 자치구 데이터가 없어 호출자가 EvaluationContext.unitDistrict를 넘겨야 합니다(알려진 스키마 갭).",
    };
  }
  const district = profile.base.residenceDistrict;
  const wantsAdjacent = condition.region.includes("연접자치구");
  if (wantsAdjacent) {
    if (!ctx.adjacentDistricts) {
      return { condition, status: "unknown", note: "연접자치구 목록이 없습니다." };
    }
    return { condition, status: ctx.adjacentDistricts.includes(district) ? "pass" : "fail" };
  }
  if (condition.region.includes("신청주택이 위치한 자치구") || condition.region.includes("그 외 서울")) {
    return {
      condition,
      status: district === ctx.unitDistrict ? "pass" : "fail",
      note: "region이 자유 서술형 문구라 휴리스틱(문자열 포함 여부)으로 판정했습니다 — 완벽하지 않을 수 있습니다.",
    };
  }
  // region이 실제 지명을 담고 있는 경우(다른 공고문에서는 이럴 수 있음)의 대비책
  return { condition, status: district === condition.region ? "pass" : "fail" };
}

function evaluateSavingsAccount(
  condition: Extract<RuleCondition, { type: "savings-account" }>,
  base: UserProfile["base"],
  asOfDate: string,
): ConditionEvaluation {
  if (condition.accountType && base.accountType !== condition.accountType) {
    return {
      condition,
      status: "fail",
      note: base.accountType === "없음" ? "청약통장 미가입" : `통장 종류 불일치(보유: ${base.accountType})`,
    };
  }
  if (condition.minInstallments != null) {
    if (base.installments == null) return { condition, status: "unknown", note: "납입횟수 미입력" };
    if (base.installments < condition.minInstallments) return { condition, status: "fail" };
  }
  if (condition.maxInstallments != null) {
    if (base.installments == null) return { condition, status: "unknown", note: "납입횟수 미입력" };
    // "OO회 미만" — 상한은 제외(exclusive)
    if (base.installments >= condition.maxInstallments) return { condition, status: "fail" };
  }
  if (condition.minMembershipYears != null) {
    if (!base.joinedOn) return { condition, status: "unknown", note: "가입일 미입력" };
    const years = yearsBetween(base.joinedOn, asOfDate);
    if (years < condition.minMembershipYears) return { condition, status: "fail" };
  }
  return { condition, status: "pass" };
}

// ── 소득/자산 판정 ───────────────────────────────────────────────

/** appliesWhen의 모든 조건이 프로필상 pass일 때만 참으로 본다(AND, unknown/fail은 탈락). */
function allConditionsPass(conditions: RuleCondition[], profile: UserProfile, ctx: ResolvedContext): boolean {
  return conditions.every((c) => evaluateCondition(c, profile, ctx).status === "pass");
}

function pickApplicableIncomeThreshold(
  program: HousingProgram,
  track: EligibilityTrack,
  profile: UserProfile,
): IncomeThresholdTable | undefined {
  const candidates = (track.incomeThresholdIds ?? [])
    .map((id) => program.incomeThresholds.find((t) => t.id === id))
    .filter((t): t is IncomeThresholdTable => !!t);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  // 후보가 여럿이면(실측: 맞벌이 여부로 갈리는 경우) dual-income 조건으로 좁힌다.
  const matched = candidates.filter((c) => {
    const dualCond = c.appliesWhen.find((w): w is Extract<RuleCondition, { type: "dual-income" }> => w.type === "dual-income");
    if (!dualCond) return true;
    return dualCond.value === profile.base.dualIncome;
  });
  return matched[0] ?? candidates[0];
}

function pickApplicableAdjustment(
  adjustments: ThresholdAdjustment[] | undefined,
  profile: UserProfile,
  ctx: ResolvedContext,
): ThresholdAdjustment | undefined {
  if (!adjustments) return undefined;
  return adjustments.find((adj) => allConditionsPass(adj.appliesWhen, profile, ctx));
}

function lookupMedianIncome(
  tables: MedianIncomeTable[],
  id: string,
  percent: number,
  householdSize: number,
): number | undefined {
  const table = tables.find((t) => t.id === id);
  if (!table) return undefined;
  const row = table.byPercent[percent];
  if (row && row[householdSize] != null) return row[householdSize];
  if (householdSize > 6 && table.extraPerPersonAbove6 != null) {
    const base6 = row?.[6];
    if (base6 == null) return undefined;
    return base6 + table.extraPerPersonAbove6 * (householdSize - 6);
  }
  return undefined;
}

function evaluateIncome(
  profile: UserProfile,
  program: HousingProgram,
  track: EligibilityTrack,
  medianIncomeTables: MedianIncomeTable[],
): IncomeEvaluation {
  const ctx: ResolvedContext = { asOfDate: program.noticeDate };
  const table = pickApplicableIncomeThreshold(program, track, profile);
  if (!table) {
    return { status: "unknown", appliedAdjustmentReasons: [], note: "이 트랙에 적용할 소득기준표를 찾지 못했습니다." };
  }
  const adjustment = pickApplicableAdjustment(table.adjustments, profile, ctx);
  const effectivePercent = table.percentOfMedianIncome + (adjustment?.percentagePointBonus ?? 0);
  const limit = lookupMedianIncome(medianIncomeTables, table.medianIncomeTableId, effectivePercent, profile.base.householdSize);
  if (limit == null) {
    return {
      status: "unknown",
      thresholdId: table.id,
      appliedAdjustmentReasons: adjustment ? [adjustment.reason] : [],
      note: `가구원수 ${profile.base.householdSize}인, 기준 ${effectivePercent}%에 해당하는 소득기준표 값을 찾지 못했습니다.`,
    };
  }
  const actual = profile.base.householdMonthlyIncomeWon;
  const noAdjustmentInfo = !profile.detail?.newbornChildAdjustment && (table.adjustments?.length ?? 0) > 0;
  return {
    status: actual <= limit ? "pass" : "fail",
    thresholdId: table.id,
    limitWon: limit,
    actualWon: actual,
    appliedAdjustmentReasons: adjustment ? [adjustment.reason] : [],
    note: noAdjustmentInfo ? "출생자녀 가산 정보 없음 — 해당 시 기준이 완화될 수 있습니다." : undefined,
  };
}

function evaluateAsset(profile: UserProfile, program: HousingProgram, track: EligibilityTrack): AssetEvaluation {
  const ctx: ResolvedContext = { asOfDate: program.noticeDate };
  const table = track.assetThresholdId
    ? program.assetThresholds.find((a) => a.id === track.assetThresholdId)
    : undefined;
  if (!table) {
    return { status: "unknown", appliedAdjustmentReasons: [], note: "이 트랙에 적용할 자산기준표가 없습니다." };
  }
  const adjustment = pickApplicableAdjustment(table.adjustments, profile, ctx);
  const totalLimit = table.totalAssetLimitWon + (adjustment?.totalAssetBonusWon ?? 0);
  const vehicleLimit = table.vehicleValueLimitWon + (adjustment?.vehicleValueBonusWon ?? 0);
  const totalActual = profile.base.totalAssetWon;
  const vehicleActual = profile.base.vehicleValueWon;
  const passed = totalActual <= totalLimit && vehicleActual <= vehicleLimit;
  const noAdjustmentInfo = !profile.detail?.newbornChildAdjustment && (table.adjustments?.length ?? 0) > 0;
  return {
    status: passed ? "pass" : "fail",
    thresholdId: table.id,
    totalAssetLimitWon: totalLimit,
    totalAssetActualWon: totalActual,
    vehicleValueLimitWon: vehicleLimit,
    vehicleValueActualWon: vehicleActual,
    appliedAdjustmentReasons: adjustment ? [adjustment.reason] : [],
    note: noAdjustmentInfo ? "출생자녀 가산 정보 없음 — 해당 시 기준이 완화될 수 있습니다." : undefined,
  };
}
