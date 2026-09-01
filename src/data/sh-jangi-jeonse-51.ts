import type {
  HousingProgram,
  IncomeThresholdTable,
  AssetThreshold,
  EligibilityTrack,
  ScoreRubric,
  ThresholdAdjustment,
} from "../types/program";

/**
 * SH "제51차 장기전세주택 입주자모집공고" (2026.08.31) 를 스키마에 그대로 옮긴 것.
 * 근거 페이지: 7~11쪽(소득·자산·순위표), 29쪽(우선공급), 30쪽(선정순서),
 * 31~32쪽(가·감점 배점표, 감점기준). medianIncome2026(../data/median-income-2026)을
 * percentOfMedianIncome으로 참조한다 — 실제 원화 기준액은 여기 없다.
 */

// ── 소득기준표 ───────────────────────────────────────────────────
// 공고문 7쪽 "출생자녀에 따른 소득 및 자산요건 가산 적용" 표의 ①②③ 사유는
// 소득·자산 양쪽에 공통으로 등장한다. appliesWhen을 구조화 조건으로 표현해서
// 평가 엔진이 사용자의 newbornChildAdjustment 입력으로 기계적으로 판정할 수
// 있게 했다(② 2명 이상과 ③ 1명+기존미성년자녀는 같은 가산액이라 appliesWhen이
// 다른 두 개의 ThresholdAdjustment로 나눠 OR를 표현함).
const NEWBORN_INCOME_ADJUSTMENTS: ThresholdAdjustment[] = [
  {
    reason: "① 2023.3.28. 이후 출생(태아 포함)한 자녀가 1명만 있는 경우",
    appliesWhen: [
      { type: "newborn-children-count", min: 1, max: 1 },
      { type: "pre-existing-minor-child", value: false },
    ],
    percentagePointBonus: 10,
  },
  {
    reason: "② 2023.3.28. 이후 출생(태아 포함)한 자녀가 2명 이상인 경우",
    appliesWhen: [{ type: "newborn-children-count", min: 2 }],
    percentagePointBonus: 20,
  },
  {
    reason: "③ 2023.3.28. 이후 출생 자녀 1명 + 2023.3.27. 이전 출생 미성년자녀가 함께 있는 경우",
    appliesWhen: [
      { type: "newborn-children-count", min: 1, max: 1 },
      { type: "pre-existing-minor-child", value: true },
    ],
    percentagePointBonus: 20,
  },
];

const NEWBORN_ASSET_ADJUSTMENTS: ThresholdAdjustment[] = [
  {
    reason: "① 2023.3.28. 이후 출생(태아 포함)한 자녀가 1명만 있는 경우",
    appliesWhen: [
      { type: "newborn-children-count", min: 1, max: 1 },
      { type: "pre-existing-minor-child", value: false },
    ],
    totalAssetBonusWon: 66_000_000,
    vehicleValueBonusWon: 4_540_000,
  },
  {
    reason: "② 2023.3.28. 이후 출생(태아 포함)한 자녀가 2명 이상인 경우",
    appliesWhen: [{ type: "newborn-children-count", min: 2 }],
    totalAssetBonusWon: 132_000_000,
    vehicleValueBonusWon: 9_090_000,
  },
  {
    reason: "③ 2023.3.28. 이후 출생 자녀 1명 + 2023.3.27. 이전 출생 미성년자녀가 함께 있는 경우",
    appliesWhen: [
      { type: "newborn-children-count", min: 1, max: 1 },
      { type: "pre-existing-minor-child", value: true },
    ],
    totalAssetBonusWon: 132_000_000,
    vehicleValueBonusWon: 9_090_000,
  },
];

const incomeThresholds: IncomeThresholdTable[] = [
  {
    id: "it-70",
    appliesWhen: [
      { type: "area-range", maxM2: 60 },
      { type: "supply-method", value: "공사건설형" },
      { type: "dual-income", value: false },
    ],
    medianIncomeTableId: "kostat-urban-worker-2026",
    percentOfMedianIncome: 70,
    adjustments: NEWBORN_INCOME_ADJUSTMENTS,
    note:
      "공사건설형 60㎡이하 1·2순위 전용(맞벌이 해당사항 없음 — 공고문 7쪽 표에 '/' 표기됨).",
  },
  {
    id: "it-105",
    appliesWhen: [{ type: "area-range", maxM2: 60 }, { type: "dual-income", value: false }],
    medianIncomeTableId: "kostat-urban-worker-2026",
    percentOfMedianIncome: 105,
    adjustments: NEWBORN_INCOME_ADJUSTMENTS,
    note:
      "매입형 60㎡이하 전 순위, 공사건설형 3·4순위, 우선공급 60㎡이하 공통(맞벌이 아님).",
  },
  {
    id: "it-105-dual",
    appliesWhen: [{ type: "area-range", maxM2: 60 }, { type: "dual-income", value: true }],
    medianIncomeTableId: "kostat-urban-worker-2026",
    percentOfMedianIncome: 140,
    note:
      "맞벌이 세대 전용 소득기준. 출생자녀 가산은 맞벌이 소득기준에는 중복 적용되지 않음(공고문 7쪽 각주) — 그래서 adjustments를 아예 비워둠.",
  },
  {
    id: "it-150",
    appliesWhen: [
      { type: "area-range", minM2: 60, minExclusive: true },
      { type: "dual-income", value: false },
    ],
    medianIncomeTableId: "kostat-urban-worker-2026",
    percentOfMedianIncome: 150,
    adjustments: NEWBORN_INCOME_ADJUSTMENTS,
    note: "60㎡초과 전 순위 공통(맞벌이 아님).",
  },
  {
    id: "it-150-dual",
    appliesWhen: [
      { type: "area-range", minM2: 60, minExclusive: true },
      { type: "dual-income", value: true },
    ],
    medianIncomeTableId: "kostat-urban-worker-2026",
    percentOfMedianIncome: 200,
    note: "60㎡초과 맞벌이 세대 전용 소득기준.",
  },
];

// ── 자산기준표 ───────────────────────────────────────────────────
const assetThresholds: AssetThreshold[] = [
  {
    id: "asset-common",
    appliesWhen: [],
    totalAssetLimitWon: 662_000_000, // 66,200만원
    vehicleValueLimitWon: 45_420_000, // 4,542만원
    adjustments: NEWBORN_ASSET_ADJUSTMENTS,
    note:
      "면적·순위·공급방식 구분 없이 전 신청자 공통(공고문 8쪽). 2023.3.27. 이전 출생자녀만 있는 경우 가산 미적용(위 adjustments의 어느 appliesWhen에도 걸리지 않음).",
  },
];

// ── 신청 트랙(순위 × 면적 × 공급방식) ───────────────────────────
const eligibilityTracks: EligibilityTrack[] = [
  // 일반공급(일반) 1순위
  {
    id: "et-r1-u50-const",
    label: "일반공급 1순위 · 공사건설형 · 50㎡미만",
    rank: 1,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "공사건설형" },
      { type: "household-status", value: "무주택세대구성원" },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-70"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r1-u50-buy",
    label: "일반공급 1순위 · 매입형 · 50㎡미만",
    rank: 1,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "매입형" },
      { type: "residency", region: "신청주택이 위치한 자치구" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r1-50to60-const",
    label: "일반공급 1순위 · 공사건설형 · 50㎡이상 60㎡이하",
    rank: 1,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-70"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r1-50to60-buy",
    label: "일반공급 1순위 · 매입형 · 50㎡이상 60㎡이하",
    rank: 1,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "매입형" },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r1-60to85",
    label: "일반공급 1순위 · 60㎡초과 85㎡이하",
    rank: 1,
    conditions: [
      { type: "area-range", minM2: 60, minExclusive: true, maxM2: 85 },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-150", "it-150-dual"],
    assetThresholdId: "asset-common",
    note: "공고문 원문에 공사건설형/매입형 구분 없이 통합 기재됨.",
  },
  {
    id: "et-r1-over85",
    label: "일반공급 1순위 · 85㎡초과",
    rank: 1,
    conditions: [
      { type: "area-range", minM2: 85, minExclusive: true },
      { type: "savings-account", accountType: "청약예금", minMembershipYears: 2 },
      {
        type: "custom",
        description:
          "청약 예치기준금액 이상 납입: 85㎡초과~102㎡이하 600만원 이상, 102㎡초과~135㎡이하 1,000만원 이상",
      },
    ],
    incomeThresholdIds: ["it-150", "it-150-dual"],
    assetThresholdId: "asset-common",
  },
  // 우선공급 (1순위 접수기간에 신청, 별도 정원)
  {
    id: "et-pref",
    label: "우선공급 · 60㎡이하",
    rank: 1,
    conditions: [
      { type: "area-range", maxM2: 60 },
      {
        type: "custom",
        description:
          "우선공급 자격기준 충족: 고령자 / 장애인 / 노부모부양자 / 2자녀이상가구 / 국가유공자 등 중 하나(상세 공고문 29쪽)",
      },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
    note:
      "일반공급과 별도 정원(모집공고 기준 38호)으로 배정. 우선공급 미달분은 일반공급 대상세대로 자동 전환됨. 국가유공자 등은 국가보훈부 통보 순위에 의하며 배점표를 적용하지 않음.",
  },
  // 일반공급(일반) 2순위
  {
    id: "et-r2-u50-const",
    label: "일반공급 2순위 · 공사건설형 · 50㎡미만",
    rank: 2,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", maxInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-70"],
    assetThresholdId: "asset-common",
    note: "약정납입횟수 24회 미만(미가입자 포함) 전원 신청 가능하나 6회 이상 납입자가 우선 선발됨(30쪽 선정순서).",
  },
  {
    id: "et-r2-u50-buy",
    label: "일반공급 2순위 · 매입형 · 50㎡미만",
    rank: 2,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "매입형" },
      { type: "residency", region: "신청주택이 위치한 자치구의 연접자치구(2순위)" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r2-50to60-const",
    label: "일반공급 2순위 · 공사건설형 · 50㎡이상 60㎡이하",
    rank: 2,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", maxInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-70"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r2-50to60-buy",
    label: "일반공급 2순위 · 매입형 · 50㎡이상 60㎡이하",
    rank: 2,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "매입형" },
      { type: "savings-account", minInstallments: 6, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r2-60to85",
    label: "일반공급 2순위 · 60㎡초과 85㎡이하",
    rank: 2,
    conditions: [
      { type: "area-range", minM2: 60, minExclusive: true, maxM2: 85 },
      { type: "savings-account", minInstallments: 6, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-150", "it-150-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r2-over85",
    label: "일반공급 2순위 · 85㎡초과",
    rank: 2,
    conditions: [
      { type: "area-range", minM2: 85, minExclusive: true },
      { type: "custom", description: "1순위에 해당하지 않는 자" },
    ],
    incomeThresholdIds: ["it-150", "it-150-dual"],
    assetThresholdId: "asset-common",
  },
  // 일반공급(일반) 3순위
  {
    id: "et-r3-u50-const",
    label: "일반공급 3순위 · 공사건설형 · 50㎡미만",
    rank: 3,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r3-u50-buy",
    label: "일반공급 3순위 · 매입형 · 50㎡미만",
    rank: 3,
    conditions: [
      { type: "area-range", maxM2: 50, maxExclusive: true },
      { type: "supply-method", value: "매입형" },
      {
        type: "custom",
        description: "공고일 현재 신청주택이 위치한 자치구/연접자치구에 거주하지 않는 자",
      },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r3-50to60-const",
    label: "일반공급 3순위 · 공사건설형 · 50㎡이상 60㎡이하",
    rank: 3,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", minInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r3-50to60-buy",
    label: "일반공급 3순위 · 매입형 · 50㎡이상 60㎡이하",
    rank: 3,
    conditions: [
      { type: "area-range", minM2: 50, maxM2: 60 },
      { type: "supply-method", value: "매입형" },
      { type: "custom", description: "1·2순위에 해당하지 않는 사람(미가입자 포함)" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
  },
  {
    id: "et-r3-60to85",
    label: "일반공급 3순위 · 60㎡초과 85㎡이하",
    rank: 3,
    conditions: [
      { type: "area-range", minM2: 60, minExclusive: true, maxM2: 85 },
      { type: "custom", description: "1·2순위에 해당하지 않는 자(미가입자 포함)" },
    ],
    incomeThresholdIds: ["it-150", "it-150-dual"],
    assetThresholdId: "asset-common",
  },
  // 일반공급(일반) 4순위
  {
    id: "et-r4-u60-const",
    label: "일반공급 4순위 · 공사건설형 · 60㎡이하",
    rank: 4,
    conditions: [
      { type: "area-range", maxM2: 60 },
      { type: "supply-method", value: "공사건설형" },
      { type: "savings-account", maxInstallments: 24, accountType: "청약저축" },
    ],
    incomeThresholdIds: ["it-105", "it-105-dual"],
    assetThresholdId: "asset-common",
    note: "약정납입횟수 24회 미만(미가입자 포함) 전원 신청 가능하나 6회 이상 납입자가 우선 선발됨.",
  },
];

// ── 가·감점 배점표 (31~32쪽) ────────────────────────────────────

/**
 * 공통 감점: 2009.11.30. 이후 공고에 의거 장기전세주택을 계약한 이력이 있는 경우.
 * metric이 "prior-contract-elapsed-years"라 이력 자체가 없으면(hasHistory=false)
 * 평가 엔진이 자동으로 0점(not-applicable) 처리한다 — tiers에 "이력 없음" 구간을
 * 억지로 추가할 필요가 없다.
 */
const commonPenalties: ScoreRubric["penalties"] = [
  {
    id: "si-penalty-recontract",
    criterion: "장기전세주택 임대차계약 이력(당첨자 발표일 기준)",
    unit: "years",
    metric: { type: "prior-contract-elapsed-years" },
    tiers: [
      { minValue: 0, points: -6, label: "3년 이내 임대차계약 사실이 있는 경우" },
      { minValue: 3, points: -4, label: "3년 초과 5년 이내 임대차계약 사실이 있는 경우" },
      { minValue: 5, points: -2, label: "5년 초과 임대차계약 사실이 있는 경우(가·나목 이외)" },
    ],
    note:
      "결혼·출산·노부모부양·사망 등 사유로 무주택세대구성원 수가 변동되어 다른 면적으로 이주 신청하는 경우 감점 제외(구성원 수가 감소한 경우에 한함, 32쪽) — 이 예외는 현재 엔진이 자동 판정하지 못하고 note로만 남김.",
  },
];

const scoreRubrics: ScoreRubric[] = [
  {
    id: "sr-general",
    // 실측(Step 5): 원래 custom{"일반공급(일반) 및 우선공급 신청자"}였는데, 자유
    // 텍스트라 엔진이 기계적으로 판정할 수 없었다. sr-jugeoyakja(주거약자형대상,
    // 구조화된 household-status 조건)를 먼저 시도하고 안 맞으면 이 빈 배열(=항상
    // 적용되는 기본값)로 떨어지는 방식으로 엔진을 짰다 — appliesWhen: []는 "이
    // 배점표가 기본값"이라는 뜻으로 예약해서 쓴다.
    appliesWhen: [],
    items: [
      {
        id: "si-residency",
        criterion: "공급 신청자의 서울특별시 연속거주기간(만19세 이후)",
        unit: "years",
        metric: { type: "seoul-residency-years" },
        tiers: [
          { minValue: 10, points: 5, label: "10년 이상" },
          { minValue: 7, points: 4, label: "7년 이상 10년 미만" },
          { minValue: 5, points: 3, label: "5년 이상 7년 미만" },
          { minValue: 3, points: 2, label: "3년 이상 5년 미만" },
          { minValue: 0, points: 1, label: "3년 미만" },
        ],
        note: "상계장암지구 신청자는 의정부시를 서울로 간주.",
      },
      {
        id: "si-homeless-period",
        criterion: "무주택기간",
        unit: "years",
        metric: { type: "homeless-period-years" },
        tiers: [
          { minValue: 10, points: 5, label: "10년 이상" },
          { minValue: 7, points: 4, label: "7년 이상 10년 미만" },
          { minValue: 5, points: 3, label: "5년 이상 7년 미만" },
          { minValue: 3, points: 2, label: "3년 이상 5년 미만" },
          { minValue: 0, points: 1, label: "3년 미만" },
        ],
        note:
          "만30세 미만 미혼신청자는 무주택기간 점수 없음(0점) — homeless-period-years 메트릭이 이 경우 not-applicable을 반환해 tiers의 '3년 미만=1점'과 섞이지 않게 한다.",
      },
      {
        id: "si-age",
        criterion: "공급 신청자의 (만)나이",
        unit: "age",
        metric: { type: "applicant-age" },
        tiers: [
          { minValue: 50, points: 5, label: "50세 이상" },
          { minValue: 45, points: 4, label: "45세 이상 50세 미만" },
          { minValue: 40, points: 3, label: "40세 이상 45세 미만" },
          { minValue: 35, points: 2, label: "35세 이상 40세 미만" },
          { minValue: 0, points: 1, label: "35세 미만" },
        ],
      },
      {
        id: "si-dependents",
        criterion: "부양가족수(태아 포함, 공급신청자 제외)",
        unit: "count",
        metric: { type: "dependents-count" },
        tiers: [
          { minValue: 5, points: 5, label: "5인 이상" },
          { minValue: 4, points: 4, label: "4인" },
          { minValue: 3, points: 3, label: "3인" },
          { minValue: 2, points: 2, label: "2인" },
          { minValue: 1, points: 1, label: "1인" },
        ],
        note: "0인(부양가족 없음)에 대한 점수가 공고문 표에 명시되어 있지 않음 — 지금 엔진은 이 경우 해당 구간을 못 찾아 status:unknown으로 남긴다(임의로 0점을 단정하지 않음).",
      },
      {
        id: "si-savings-85-under",
        criterion: "청약저축(청약저축) 납입횟수 — 85㎡ 이하 신청자",
        unit: "installments",
        metric: { type: "savings-installments" },
        tiers: [
          { minValue: 96, points: 5, label: "96회 이상" },
          { minValue: 84, points: 4, label: "84회 이상 96회 미만" },
          { minValue: 72, points: 3, label: "72회 이상 84회 미만" },
          { minValue: 60, points: 2, label: "60회 이상 72회 미만" },
          { minValue: 24, points: 1, label: "24회 이상 60회 미만" },
        ],
        note: "85㎡초과 1순위 신청자는 이 항목 대신 si-deposit-period-85-over 적용(상호 배타적) — 지금 엔진은 둘 다 계산해서 호출자가 면적에 맞게 골라야 한다.",
      },
      {
        id: "si-deposit-period-85-over",
        criterion: "청약예금 가입기간 — 85㎡초과 1순위 신청자",
        unit: "years",
        metric: { type: "savings-membership-years" },
        tiers: [
          { minValue: 8, points: 5, label: "8년 이상" },
          { minValue: 6, points: 4, label: "6년 이상 8년 미만" },
          { minValue: 4, points: 3, label: "4년 이상 6년 미만" },
          { minValue: 2, points: 2, label: "2년 이상 4년 미만" },
        ],
        note: "해당 주택형에 신청 가능한 청약예금 기준. 85㎡ 이하 신청자는 si-savings-85-under 적용.",
      },
    ],
    penalties: commonPenalties,
    note: "배점 동일할 경우 미성년자녀 수가 많은 자 우선, 그래도 같으면 전산추첨(tieBreakers 참고).",
  },
  {
    id: "sr-jugeoyakja",
    appliesWhen: [{ type: "household-status", value: "주거약자형대상" }],
    items: [
      {
        id: "si-jy-dependents",
        criterion: "부양가족수(태아 포함, 공급신청자 제외)",
        unit: "count",
        metric: { type: "dependents-count" },
        tiers: [
          { minValue: 3, points: 3, label: "3인 이상" },
          { minValue: 2, points: 2, label: "2인" },
          { minValue: 1, points: 1, label: "1인" },
        ],
      },
      {
        id: "si-jy-residency",
        criterion: "공급 신청자의 서울특별시 연속거주기간(만19세 이후)",
        unit: "years",
        metric: { type: "seoul-residency-years" },
        tiers: [
          { minValue: 5, points: 3, label: "5년 이상" },
          { minValue: 3, points: 2, label: "3년 이상 5년 미만" },
          { minValue: 1, points: 1, label: "1년 이상 3년 미만" },
        ],
      },
      {
        id: "si-jy-vulnerable",
        criterion: "사회취약계층",
        unit: "custom",
        metric: { type: "special-category-match" },
        tiers: [
          { minValue: 2, points: 2, label: "생계급여 또는 의료급여 수급자", matchesAnyOf: ["생계급여수급자", "의료급여수급자"] },
          { minValue: 1, points: 1, label: "차상위계층이거나 생계·의료급여 이외의 수급자", matchesAnyOf: ["차상위계층"] },
        ],
        note:
          "3점 구간 없음(이 항목 최고점은 2점). matchesAnyOf는 profile.detail.specialCategories 값과 정확히 일치해야 한다(src/types/profile.ts의 SpecialCategory). 차상위계층 정의는 국민기초생활 보장법 제2조제10호.",
      },
      {
        id: "si-jy-savings",
        criterion: "공급 신청자의 주택청약종합저축(청약저축) 납입횟수",
        unit: "installments",
        metric: { type: "savings-installments" },
        tiers: [
          { minValue: 60, points: 3, label: "60회 이상" },
          { minValue: 48, points: 2, label: "48회 이상 60회 미만" },
          { minValue: 36, points: 1, label: "36회 이상 48회 미만" },
        ],
      },
      {
        id: "si-jy-disability",
        criterion: "장애인",
        unit: "custom",
        metric: { type: "special-category-match" },
        tiers: [
          { minValue: 2, points: 2, label: "장애의 정도가 심한 장애인", matchesAnyOf: ["장애정도심함"] },
          { minValue: 1, points: 1, label: "장애의 정도가 심하지 않은 장애인", matchesAnyOf: ["장애정도심하지않음"] },
        ],
        note: "si-jy-vulnerable와 동일한 matchesAnyOf 방식 적용.",
      },
    ],
    penalties: commonPenalties,
    note:
      "penalties는 sr-general과 동일한 공통 감점기준을 중복 보유함 — 스키마가 아직 여러 ScoreRubric 간 항목 공유를 지원하지 않기 때문(향후 개선 후보).",
  },
];

export const shJangiJeonse51: HousingProgram = {
  id: "sh-jangi-jeonse-51",
  agency: "서울주택도시개발공사(SH)",
  title: "제51차 장기전세주택 입주자모집공고",
  noticeDate: "2026-08-31",
  supplyType: "장기전세주택",
  rankingModel: { kind: "priority-tier+score" },
  incomeThresholds,
  assetThresholds,
  eligibilityTracks,
  scoreRubrics,
  tieBreakers: [{ type: "minor-children-count" }, { type: "random-lottery" }],
  verifiedBy: "manual",
  sourceNote:
    "사람이 SH 홈페이지에 게시된 '제51차 장기전세주택 입주자모집공고' PDF(2026.08.31, 서울주택도시개발공사)를 직접 읽고 7~11쪽, 29~32쪽 내용을 옮겨 작성함. 소득·자산 자격은 자가진단이 아니라 사회보장정보시스템·주택소유확인시스템 등 공적자료로 사후 검증됨(사용자 입력값은 예비 추정 용도로만 사용해야 함).",
};
