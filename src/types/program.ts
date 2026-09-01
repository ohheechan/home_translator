/**
 * 청약/임대주택 공고 하나를 표현하는 데이터 모델.
 *
 * 설계 원칙: 이 파일은 "어떤 공고문이든" 담을 수 있어야 하는 그릇(스키마)이다.
 * 실제 판정 로직(엔진)은 이 타입들만 보고 동작하며, 공고문마다 달라지는 값은
 * 전부 이 스키마를 채우는 데이터(src/data/*.ts)로 분리한다.
 *
 * 지금 단계에서는 "SH 장기전세주택 51차" 공고문 하나를 실제로 이 스키마에
 * 채워보면서(src/data/sh-jangi-jeonse-51.ts) 스키마가 실제 복잡도를 감당하는지
 * 검증하는 것이 목표다. 향후 MOD-01(공고문 구조화 추출)이 새 PDF를 읽고
 * 이 스키마와 동일한 형태의 데이터를 만들어내면, 아래 엔진(다음 단계에서 작성)은
 * 코드 변경 없이 바로 그 공고문도 처리할 수 있어야 한다.
 */

// ── 공통: 조건 표현 ──────────────────────────────────────────────

/**
 * 자격 판단의 최소 단위 조건. 공고문마다 조건의 조합이 다르므로
 * "태그드 유니온" + custom 탈출구로 설계한다. 스키마가 아직 못 담는
 * 예외조항은 최소한 사람이 읽을 설명이라도 남겨서 누락을 방지한다.
 */
export type RuleCondition =
  | {
      type: "area-range";
      minM2?: number;
      maxM2?: number;
      /**
       * 실측(Step 4 평가 엔진 작성 중 발견): 같은 표 안에 "미만"(제외)과
       * "이하"(포함), "초과"(제외)와 "이상"(포함)이 섞여 나온다(예: "50㎡미만"
       * vs "50㎡이상 60㎡이하" vs "60㎡초과 85㎡이하"). minM2/maxM2만으로는
       * 경계값 자체(정확히 60㎡인 경우 등)를 어느 쪽에 넣을지 판정할 수 없어서
       * 추가했다. 생략 시 기본값은 포함(이상/이하)이다.
       */
      minExclusive?: boolean; // true면 "초과"
      maxExclusive?: boolean; // true면 "미만"
    }
  | { type: "supply-method"; value: string } // 예: "공사건설형" | "매입형" | "우선공급"
  | { type: "applicant-rank"; value: number }
  | { type: "dual-income"; value: boolean }
  | { type: "residency"; region: string; minYears?: number }
  | {
      type: "savings-account";
      minInstallments?: number;
      /**
       * 실측: SH 장기전세 51차 2·4순위는 "24회 미만(6회 이상 우선)"처럼 상한이
       * 있는 잔여 구간을 조건으로 쓴다(사실상 1순위에서 못 채운 잔여 지원자용
       * 등급). minInstallments만으로는 이 상한을 표현할 수 없어 추가했다.
       */
      maxInstallments?: number;
      minMembershipYears?: number;
      accountType?: string; // "청약저축" | "청약예금" | "청약종합저축"
    }
  | { type: "household-status"; value: "무주택세대구성원" | "주거약자형대상" }
  /**
   * 출생자녀 가산 판정용(실측: SH 8쪽). 2023.3.28. 이후 출생(태아 포함)한
   * 자녀 수를 min/max 범위로 표현한다 — "1명만"은 {min:1,max:1}, "2명 이상"은
   * {min:2}.
   */
  | { type: "newborn-children-count"; min?: number; max?: number }
  /** 2023.3.27. 이전 출생 미성년자녀가 세대에 있는지(출생자녀 가산 ③ 판정용). */
  | { type: "pre-existing-minor-child"; value: boolean }
  | { type: "custom"; description: string };

// ── 소득/자산 기준 ───────────────────────────────────────────────

/**
 * 조건부 가산(출생자녀 가산 등). 소득·자산 기준 양쪽에서 재사용한다.
 *
 * 실측 수정(Step 1): SH 장기전세 51차 8쪽 "출생자녀 가산" 표를 보면 같은
 * 사유(①②③)가 소득기준에는 %p 가산으로, 자산기준에는 총자산·자동차가액 각각
 * "다른 금액"으로 적용된다 — 자산 쪽은 %가 아니라 절대 원(₩) 단위 가산이다.
 * 애초 percentagePointBonus 하나만 있던 설계로는 자산 가산을 표현할 수 없어서
 * 필드를 용도별로 분리했다. 하나의 ThresholdAdjustment는 자신이 속한 표
 * (소득/자산)에 맞는 필드만 채운다.
 *
 * 실측 수정(Step 4): 처음엔 reason이 사람이 읽는 설명이자 매칭 키를 겸했는데,
 * 평가 엔진을 짜보니 자유 텍스트로는 "이 가산이 지금 이 신청자에게 적용되는지"를
 * 기계적으로 판단할 수 없었다(①②③ 문구를 프로그램이 이해할 방법이 없음).
 * 그래서 reason은 사람이 읽을 설명으로만 남기고, 적용 여부 판정은 appliesWhen
 * (RuleCondition[], 전부 참이어야 적용 — AND)으로 옮겼다. "2명 이상 또는 1명+
 * 기존 미성년자녀"처럼 OR가 필요한 경우는 ThresholdAdjustment를 여러 개로
 * 나눠 표현한다(하나의 appliesWhen 안에서는 OR를 표현하지 않음).
 */
export interface ThresholdAdjustment {
  reason: string; // 예: "① 2023.3.28. 이후 출생(태아 포함)한 자녀가 1명만 있는 경우"
  appliesWhen: RuleCondition[];
  percentagePointBonus?: number; // 소득기준표용, %p 단위 (예: +10)
  totalAssetBonusWon?: number; // 자산기준표용: 총자산 한도 가산액(원)
  vehicleValueBonusWon?: number; // 자산기준표용: 자동차가액 한도 가산액(원)
}

/**
 * "가구원수별 가구당 월평균소득" 표는 공고문마다 새로 정의되는 값이 아니라,
 * 통계청이 매년 고시하는 전국 공통 자료를 청약 공고문들이 함께 참조하는
 * 것이다(실측: SH 장기전세 51차 공고문 8쪽 각주 — "통계청에서 발표한 전년도
 * 도시근로자 가구원수별 가구당 월평균소득 금액을 기준으로 한다는 의미").
 * 그래서 이 표는 HousingProgram이 아니라 별도 공유 자료로 분리하고,
 * 프로그램은 자신이 쓰는 percentOfMedianIncome 값으로 이 표를 "참조"만 한다.
 * 이렇게 하면 소득기준표가 매년 갱신될 때 프로그램 데이터를 건드릴 필요가 없다.
 */
export interface MedianIncomeTable {
  id: string; // 예: "kostat-urban-worker-2026"
  year: number;
  sourceNote: string;
  /** percentOfMedian → (가구원수 → 월평균소득 기준액(원)) */
  byPercent: Record<number, Record<number, number>>;
  /** 표에 없는 7인 이상 가구를 계산하는 방법이 공고문에 명시된 경우에만 채움 */
  extraPerPersonAbove6?: number;
}

/**
 * 소득기준 "적용 조건". 실제 기준액은 이 프로그램의 percentOfMedianIncome 값을
 * MedianIncomeTable에서 조회해서 얻는다 — 값을 여기 직접 들고 있지 않는다.
 * 한 공고문 안에 면적대·공급방식·순위·맞벌이 여부에 따라 여러 개가 동시에
 * 존재할 수 있다 (SH 장기전세 51차 실측: 6개 이상).
 */
export interface IncomeThresholdTable {
  id: string;
  appliesWhen: RuleCondition[];
  medianIncomeTableId: string; // MedianIncomeTable.id 참조
  percentOfMedianIncome: number; // 기준 % (예: 70, 105, 150 ...)
  adjustments?: ThresholdAdjustment[];
  note?: string;
}

export interface AssetThreshold {
  id: string;
  appliesWhen: RuleCondition[];
  totalAssetLimitWon: number;
  vehicleValueLimitWon: number;
  adjustments?: ThresholdAdjustment[];
  note?: string;
}

// ── 순위 판정 ────────────────────────────────────────────────────

/**
 * 이 공고가 지원자 순위를 정하는 방식. 프로그램마다 완전히 다르다는 것을
 * (SH 장기전세 검증으로) 확인했으므로, "무주택기간+부양가족수+통장가입기간
 * 84점 만점" 같은 고정 공식을 절대 엔진에 하드코딩하지 않는다.
 */
export type RankingModel =
  | { kind: "priority-tier" } // 순위(1~4순위)로만 결정, 동순위는 tieBreakers로
  | { kind: "point-based"; maxScore: number } // 누적 점수제 (예: 민간분양 청약가점제, maxScore는 공고문마다 다를 수 있음)
  | { kind: "priority-tier+score" }; // 순위 먼저 결정 후 동순위 내 배점합산 (SH 장기전세 방식)

/**
 * 알게 된 것(Step 1에서 발견, Step 5에서 부분 해결):
 * SH 장기전세 51차 30쪽 "동일순위 경쟁 시 입주자 선정기준" 표를 보면 같은 순위 안에서도
 * "소득 70% 이하 우선 → (남은 주택 있을 시) 70% 초과 105% 이하" 처럼 소득 구간이 먼저
 * 지원자를 나누고, 그다음 저축 순위, 그다음 배점합산 순으로 선발한다. EligibilityTrack에
 * selectionOrder를 추가해 "같은 순위 안에서 어느 트랙을 먼저 보여줄지"는 표현할 수 있게
 * 했지만, "선순위 트랙 물량이 다 차야 다음 트랙을 연다"는 재고(잔여세대) 기반 로직은
 * 여전히 표현하지 못한다 — 그러려면 단지별 공급호수 데이터가 있어야 하는데(residency
 * 조건이 단지별 자치구를 못 담는 것과 같은 이유로) 지금 스키마엔 없다. 이건 "내 점수/
 * 순위 계산" 수준을 넘어서는 배정 시뮬레이터의 일이라 지금은 범위 밖으로 남겨둔다.
 */

/** 면적×공급방식×순위 조합 하나 = "신청 트랙" 하나 */
export interface EligibilityTrack {
  id: string;
  label: string; // 예: "매입형 60㎡이하 1순위(공사건설형)"
  rank: number; // 이 트랙 안에서의 순위(1~4)
  conditions: RuleCondition[];
  /**
   * IncomeThresholdTable.id 참조 목록. 배열인 이유: 실측 결과 같은 트랙이라도
   * 신청자가 맞벌이인지 아닌지에 따라 서로 다른 소득기준표(예: 105% vs 맞벌이 140%)가
   * 적용된다 — 트랙 하나에 소득기준표 하나가 고정되지 않는다. 평가 엔진은 신청자의
   * 프로필(dual-income 여부 등)로 각 후보의 IncomeThresholdTable.appliesWhen을
   * 매칭시켜 실제 적용될 하나를 골라야 한다.
   */
  incomeThresholdIds?: string[];
  assetThresholdId?: string; // AssetThreshold.id 참조
  /** 동일 순위 안에서 선발 순서(작을수록 먼저) — 위 RankingModel 코멘트 참고. */
  selectionOrder?: number;
  note?: string;
}

// ── 가점/배점표 ──────────────────────────────────────────────────

export interface ScoreTier {
  minValue: number; // 이 구간에 들어가기 위한 최소값(년/회/세 등, criterion에 따라 단위 다름)
  points: number;
  label?: string; // 예: "10년 이상"
  /**
   * 실측(Step 5): unit이 "custom"인 항목(예: 사회취약계층, 장애 정도)은 배점이
   * 순서형 수치가 아니라 서로 배타적인 범주다 — "차상위계층"이 "생계급여수급자"보다
   * 작은 값이라서가 아니라 그냥 다른 범주라서 점수가 다르다. 이런 항목은 minValue
   * 비교 대신 matchesAnyOf(신청자가 고른 특별자격 중 하나라도 여기 포함되면 이 구간
   * 적용)로 판정한다. matchesAnyOf가 있으면 minValue는 무시한다.
   */
  matchesAnyOf?: string[];
}

/**
 * 이 항목의 점수를 사용자 프로필의 어떤 값으로부터 계산하는지 — 구조화된 값.
 * 실측(Step 5): criterion은 사람이 읽는 설명일 뿐이라("서울특별시 연속거주기간(만19세
 * 이후)") 평가 엔진이 "그래서 프로필의 어느 필드를 봐야 하는지"를 문자열 파싱 없이는
 * 알 방법이 없었다 — ThresholdAdjustment.reason과 같은 종류의 문제라 같은 방식(구조화된
 * 필드 추가)으로 풀었다.
 */
export type ScoreMetric =
  | { type: "seoul-residency-years" }
  | { type: "homeless-period-years" }
  | { type: "applicant-age" }
  | { type: "dependents-count" }
  | { type: "minor-children-count" }
  | { type: "savings-installments" }
  | { type: "savings-membership-years" }
  /** unit "custom" 항목 전용 — ScoreTier.matchesAnyOf와 짝을 이룬다. */
  | { type: "special-category-match" }
  /** 감점 항목(재계약 이력 등) 전용: 해당 이력 자체가 없으면 "not-applicable"(무감점)로
   *  처리되고, 있으면 계약시점부터의 경과년수로 구간을 찾는다. */
  | { type: "prior-contract-elapsed-years" };

export interface ScoreItem {
  id: string;
  criterion: string; // 예: "서울특별시 연속거주기간"
  unit: "years" | "count" | "age" | "installments" | "boolean" | "custom";
  metric: ScoreMetric;
  tiers: ScoreTier[];
  note?: string;
}

/**
 * 배점표 자체가 적용 대상(일반공급/주거약자형 등)에 따라 여러 벌 존재할 수 있어
 * appliesWhen으로 스코핑한다. penalties는 감점 항목(재계약 이력 등)을 별도로 분리해
 * "가점 32점 만점" 같은 단일 스칼라로 뭉개지 않고 근거를 추적 가능하게 유지한다.
 */
export interface ScoreRubric {
  id: string;
  appliesWhen: RuleCondition[];
  items: ScoreItem[];
  penalties?: ScoreItem[];
  note?: string;
}

export type TieBreaker =
  | { type: "minor-children-count" }
  | { type: "random-lottery" } // 전산추첨
  | { type: "custom"; description: string };

// ── 공고 최상위 타입 ─────────────────────────────────────────────

export interface HousingProgram {
  id: string; // 예: "sh-jangi-jeonse-51"
  agency: string; // 예: "서울주택도시개발공사(SH)"
  title: string;
  noticeDate: string; // YYYY-MM-DD, 자격 판단 기준일
  supplyType: string; // 예: "장기전세주택" | "행복주택" | "신혼희망타운" | "민간분양"
  rankingModel: RankingModel;

  incomeThresholds: IncomeThresholdTable[];
  assetThresholds: AssetThreshold[];
  eligibilityTracks: EligibilityTrack[];
  scoreRubrics: ScoreRubric[];
  tieBreakers: TieBreaker[];

  /** 이 데이터가 어떻게 만들어졌는지 표시 — 신뢰도가 서로 달라 서비스단에서 다르게
   *  취급해야 한다. "manual": 사람이 공고문을 읽고 직접 입력(51차). "rule-parsed":
   *  Tier A 규칙기반 파서가 섹션/표 헤더를 앵커로 추출(MOD-01, LLM 미사용) — 필드별로
   *  parseWarnings가 비어있어야 신뢰 가능. "llm-extracted": LLM이 자유 추출(미구현,
   *  Tier A가 못 잡는 신규 서식 대비 최후 수단으로만 검토 중). */
  verifiedBy: "manual" | "rule-parsed" | "llm-extracted";
  /** verifiedBy가 "rule-parsed"일 때, 파서가 확신하지 못했거나 못 찾은 필드 목록.
   *  비어있지 않으면 이 프로그램 데이터는 그대로 엔진에 태우지 말고 사람 확인 후
   *  사용해야 한다(Tier B). */
  parseWarnings?: string[];
  sourceNote?: string;
}
