import type { BaseProfile, ScoringDetail } from "../types/profile";
import type { LoanProduct, LoanMatchResult, LoanFitLevel } from "../types/loan";
import { LOAN_PRODUCTS } from "../data/loan-products";

/**
 * Step: 참고용 정책대출 후보 좁히기. eligibility.ts와 같은 "확정 판정이 아니면
 * 함부로 탈락시키지 말고 확인 필요로 남겨라" 원칙을 따르되, 대출 쪽은 애초에
 * program.ts만큼 세밀한 입력을 받지 않으므로(순자산이 아니라 총자산, 부부합산이
 * 아니라 가구 전체 합산 소득) 판정 가능한 축이 더 좁다. 그래서 이 파일은 셋 중
 * 하나만 한다:
 *
 *  1) 100% 확정적으로 배제 가능한 축(혼인 요건, birthDate가 있을 때의 연령)만
 *     "탈락"으로 처리해 목록에서 아예 뺀다.
 *  2) 소득·자산은 "상한 이하로 입력된 값(가구 전체 소득/총자산)"이 상품 기준
 *     (부부합산 소득/순자산)의 상한을 넘지 않으면, 더 좁은 기준값도 반드시
 *     그 이하이므로 "가능성 높음"으로 판정한다. 반대로 넘으면 실제로 넘는지는
 *     확정할 수 없으므로(가구원 중 다른 소득자가 있거나, 부채를 뺀 순자산이
 *     낮을 수 있음) "확인 필요"로 남긴다 — 절대 "대상 아님"으로 단정하지 않는다.
 *  3) 판정 불가능한 축(연령 정보 없음 등)은 "확인 필요" 사유로 남긴다.
 */

function calcAge(birthDateIso: string, asOf: Date = new Date()): number {
  const b = new Date(birthDateIso);
  let age = asOf.getFullYear() - b.getFullYear();
  const beforeBirthdayThisYear =
    asOf.getMonth() < b.getMonth() || (asOf.getMonth() === b.getMonth() && asOf.getDate() < b.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

function fmtManwon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}만원`;
}

/** null을 반환하면 "대상 아님"으로 확정돼 목록에서 제외된다. */
function evaluateProduct(
  product: LoanProduct,
  base: BaseProfile,
  detail: ScoringDetail | undefined,
): LoanMatchResult | null {
  const reasons: string[] = [];
  let fit: LoanFitLevel = "가능성 높음";

  // ── 혼인 요건: BaseProfile.maritalStatus는 항상 있으므로 100% 확정 판단 가능 ──
  if (product.requiresNewlywedOrEngaged && base.maritalStatus === "미혼") {
    return null;
  }

  // ── 연령 요건: birthDate는 선택 입력(배점 세부정보)이라 있을 때만 확정 판단 ──
  if (product.minAge !== undefined || product.maxAge !== undefined) {
    if (detail?.birthDate) {
      const age = calcAge(detail.birthDate);
      const tooYoung = product.minAge !== undefined && age < product.minAge;
      const tooOld = product.maxAge !== undefined && age > product.maxAge;
      if (tooYoung || tooOld) return null;
    } else {
      reasons.push("연령 요건(" + product.targetNote + ") 충족 여부는 생년월일을 입력해야 확인할 수 있어요.");
      fit = "확인 필요";
    }
  }

  // ── 소득: 가구 전체 합산(상한선 역할) vs 상품의 부부합산 기준 ──
  const householdAnnualIncomeManwon = (base.householdMonthlyIncomeWon / 10_000) * 12;
  if (householdAnnualIncomeManwon > product.incomeCapManwon) {
    reasons.push(
      `가구 전체 합산 연소득 약 ${fmtManwon(householdAnnualIncomeManwon)}이 상품 기준(부부합산 ${fmtManwon(product.incomeCapManwon)})을 넘어요 — 이 상품 기준은 가구원 전체가 아니라 부부(또는 단독세대주) 소득만 보므로, 가구원 중 다른 소득자가 있다면 실제로는 충족할 수 있어요.`,
    );
    fit = "확인 필요";
  }

  // ── 자산: 총자산(상한선 역할) vs 상품의 순자산 기준 ──
  const totalAssetManwon = base.totalAssetWon / 10_000;
  if (totalAssetManwon > product.netAssetCapManwon) {
    reasons.push(
      `총자산 ${fmtManwon(totalAssetManwon)}이 순자산 기준 ${fmtManwon(product.netAssetCapManwon)}을 넘어요 — 이 상품 기준은 총자산에서 부채를 뺀 순자산으로 보므로, 부채가 있다면 실제로는 충족할 수 있어요.`,
    );
    fit = "확인 필요";
  }

  if (fit === "가능성 높음") {
    reasons.push("입력하신 정보 기준으로는 기본 요건에 부합해 보여요.");
  }

  return { product, fit, reasons };
}

export function matchLoanProducts(
  base: BaseProfile,
  detail: ScoringDetail | undefined,
  products: LoanProduct[] = LOAN_PRODUCTS,
): LoanMatchResult[] {
  return products
    .map((product) => evaluateProduct(product, base, detail))
    .filter((r): r is LoanMatchResult => r !== null);
}
