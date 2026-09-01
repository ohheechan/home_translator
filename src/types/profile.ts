/**
 * 사용자 입력을 표현하는 타입. program.ts의 HousingProgram이 "공고문 하나"를
 * 담는 그릇이라면, 이 파일은 "신청자 한 명"을 담는 그릇이다.
 *
 * 와이어프레임(온보딩 → 프로필 3단계 → ... → Result → 배점 세부정보)에서 결정한
 * 2단계 입력 구조를 그대로 따른다:
 *   - BaseProfile: 온보딩 3화면(Profile1/2/3)에서 받는 최소 입력. 이것만으로
 *     "신청 가능한지 / 어느 트랙인지"까지는 판정할 수 있어야 한다(program.ts의
 *     RuleCondition·IncomeThresholdTable·AssetThreshold·EligibilityTrack을 채우는 데
 *     필요한 값 전부).
 *   - ScoringDetail: Result 화면에서 "배점 세부정보 입력하기"로 진입하는
 *     ScoreDetail 화면에서 받는 선택 입력. program.ts의 ScoreRubric(가·감점)과
 *     TieBreaker를 계산하는 데만 필요하고, 자격 판정 자체에는 쓰이지 않는다.
 * 이렇게 나눈 이유: 배점용 필드(생년월일·전입일·부양가족수 등)까지 온보딩에서
 * 한꺼번에 받으면 이탈률이 커진다는 판단 때문 — UserProfile.detail이 없어도
 * 자격 판정 엔진은 동작해야 하고, 배점 계산 엔진만 detail이 없으면 "정보 부족"으로
 * 응답해야 한다.
 */

// ── 1단계: 자격 판정에 필요한 최소 입력 (Profile1/2/3 화면) ──────

/** Profile1.dc.html · 소득·자산 */
export interface IncomeAssetProfile {
  /**
   * 가구 소득(세전, 월, 원 단위). 화면은 "만원" 단위로 입력받지만 program.ts의
   * MedianIncomeTable.byPercent 값과 단위를 맞추기 위해 저장은 원 단위로 한다
   * (화면 ↔ 저장 경계에서 ×10,000 변환).
   * 주의: 본인 소득이 아니라 "가구원 전체 합산" — Profile1 화면에서 실측으로
   * 확인한 실수(초기 라벨이 "본인 기준"이었음) 재발 방지용 주석.
   */
  householdMonthlyIncomeWon: number;
  householdSize: number;
  /** 맞벌이 여부. IncomeThresholdTable을 it-105 계열/it-105-dual 계열 중
   *  무엇으로 조회할지 가르는 값이라 소득액과 별개로 반드시 필요하다. */
  dualIncome: boolean;
  totalAssetWon: number;
  vehicleValueWon: number;
}

/** Profile2.dc.html · 청약통장 */
export interface SavingsAccountProfile {
  /** "없음"도 유효한 값 — 아직 가입 안 한 사용자를 자격 판정에서 자연스럽게
   *  탈락시키려면 필요하다. program.ts의 accountType은 string이라 그대로 맞는다. */
  accountType: "청약저축" | "청약예금" | "청약종합저축" | "없음";
  /** YYYY-MM-DD. 화면은 월 단위(YYYY.MM)까지만 받으므로 일자는 01로 채운다. */
  joinedOn?: string;
  /** 약정 납입횟수. savings-account 조건의 minInstallments/maxInstallments와
   *  직접 비교되는 값이라 사용자가 직접 입력하게 한다(가입일로부터 역산 추정은
   *  중도 해지·연체 등으로 부정확할 수 있음 — Profile2 힌트가 청약홈 확인을 안내). */
  installments?: number;
}

/** Profile3.dc.html · 거주·가구 */
export interface ResidenceHouseholdProfile {
  /** 서울시 자치구명(예: "노원구"). residency 조건의 region 매칭과, 신청주택이
   *  위치한 자치구/연접자치구 여부 판정에 쓰인다. */
  residenceDistrict: string;
  housingOwnership: "무주택세대구성원" | "1주택자" | "2주택 이상";
  /** household-status의 "주거약자형대상" 축은 무주택 여부와 별개 축이라
   *  분리된 필드로 둔다(하나의 enum에 욱여넣지 않음). */
  accessibleHousingTarget: boolean;
  maritalStatus: "미혼" | "예비신혼" | "기혼";
}

export interface BaseProfile
  extends IncomeAssetProfile,
    SavingsAccountProfile,
    ResidenceHouseholdProfile {}

// ── 2단계: 배점 계산에 필요한 선택 입력 (ScoreDetail 화면) ────────

/**
 * 무주택기간 계산 근거. program.ts의 si-homeless-period 항목(만30세부터 계속
 * 무주택인 기간, 30세 이전 혼인 시 혼인신고일부터 기산)을 그대로 반영한다.
 */
export interface HomelessPeriodBasis {
  marriedBeforeAge30: boolean;
  /** marriedBeforeAge30이 true일 때만 의미 있음. YYYY-MM-DD */
  marriageRegisteredOn?: string;
  previouslyOwnedHome: boolean;
  /** previouslyOwnedHome이 true일 때만 의미 있음. YYYY-MM-DD (처분일) */
  homeDisposedOn?: string;
}

/**
 * 출생자녀 가산 판단 근거(program.ts의 REASON_ONE_CHILD / REASON_TWO_OR_MIXED).
 * "몇 명인지"뿐 아니라 "2023.3.27 이전 출생 미성년자녀가 함께 있는지"까지 있어야
 * ①과 ②·③을 구분할 수 있어서 원문 조건 구조를 그대로 옮겼다.
 */
export interface NewbornChildAdjustmentBasis {
  /** 2023.3.28. 이후 출생(태아 포함) 자녀 수 */
  childrenBornAfter20230328: number;
  /** 위 자녀와 별도로, 2023.3.27. 이전 출생한 미성년자녀가 세대에 있는지 */
  hasMinorChildBornOnOrBefore20230327: boolean;
}

/** ScoreDetail 화면의 "특별자격" 칩로우와 1:1 대응. 다중 선택. */
export type SpecialCategory =
  | "생계급여수급자"
  | "의료급여수급자"
  | "차상위계층"
  | "장애정도심함"
  | "장애정도심하지않음"
  | "고령자" // 만65세 이상
  | "노부모부양자"
  | "2자녀이상가구"
  | "국가유공자등";

export interface PriorLongTermLeaseHistory {
  hasHistory: boolean;
  /** hasHistory가 true일 때만 의미 있음. YYYY-MM-DD (계약 시점) — 당첨자
   *  발표일 기준 경과기간을 계산해 감점 구간(si-penalty-recontract)을 정한다. */
  contractedOn?: string;
}

export interface ScoringDetail {
  /** YYYY-MM-DD. 만나이 산출(si-age)과 무주택 기산일 계산에 공통으로 쓰인다. */
  birthDate?: string;
  /** 서울특별시 최종 전입일. YYYY-MM-DD. si-residency(연속거주기간) 산출용. */
  seoulLastMoveInDate?: string;
  homelessPeriodBasis?: HomelessPeriodBasis;
  /** 부양가족수(태아 포함, 신청자 본인 제외) — BaseProfile.householdSize와는
   *  다른 개념이라 별도 필드로 분리했다(세대원 수 vs 배점용 부양가족 수). */
  dependentsCount?: number;
  /** 동일순위 경쟁 시 1차 타이브레이커(minor-children-count)에 쓰인다. */
  minorChildrenCount?: number;
  newbornChildAdjustment?: NewbornChildAdjustmentBasis;
  specialCategories?: SpecialCategory[];
  priorLongTermLeaseHistory?: PriorLongTermLeaseHistory;
}

// ── 최상위: 신청자 한 명 ───────────────────────────────────────

export interface UserProfile {
  base: BaseProfile;
  /** 없으면 자격 판정까지만 가능하고 배점 계산은 "정보 부족"으로 응답해야 한다. */
  detail?: ScoringDetail;
}
