import type {
  AssetThreshold,
  EligibilityTrack,
  HousingProgram,
  IncomeThresholdTable,
  MedianIncomeTable,
  RuleCondition,
  ScoreItem,
  ScoreRubric,
  ScoreTier,
  ThresholdAdjustment,
} from "../types/program";
import { allText, findPage, parseCommaNumber, type PdfExtraction, type ParseWarnings } from "./types";

/**
 * Tier A 규칙기반 파서 — SH 장기전세주택 전용(docs/mod01-document-handling-tiers.md 참고).
 *
 * 설계 원칙(49차·50차·51차 3개 문서 실측 비교로 확정 — docs/sh-jangi-jeonse-format-consistency.md):
 *  - 페이지 번호가 아니라 섹션/표 안의 고정 문구를 앵커로 찾는다(별표 개수가 회차마다
 *    다르므로 페이지 번호 파싱은 위험하다고 실측으로 확인됨).
 *  - 못 찾거나 애매하면 절대 추측하지 않고 warnings에 적고 그 필드는 비워둔다.
 *    warnings가 하나라도 있으면 이 결과는 Tier B(사람 확인 필요)로 취급해야 한다.
 *  - 이 파서가 다루는 건 "일반공급(일반)"과 "일반공급(주거약자)" 배점표, 공통 자산·소득
 *    기준, 신생아 가산, 재계약 감점, 기본 메타데이터, 그리고 면적×공급방식×순위별
 *    EligibilityTrack(신청자격 표, 우선공급 제외)이다. "N순위 미해당자"처럼 이전 순위
 *    조건의 보수(complement)를 추론해야 하는 행은 51차 수작업 데이터처럼 정확한
 *    maxInstallments 등으로 자동 변환하지 않고 custom 조건(needs-review)으로 남긴다 —
 *    보수 추론을 잘못하면 조용히 틀린 판정을 낼 수 있어서, 확신 없는 자동 추론보다
 *    사람 확인을 택했다.
 */

export interface ParsedShJangiJeonse {
  program: HousingProgram;
  /** program.incomeThresholds가 참조하는 실제 소득기준표. HousingProgram 스키마 밖의
   *  공유 자료라서(program.ts의 MedianIncomeTable 코멘트 참고) 별도로 반환한다 —
   *  평가 엔진(evaluateProgram)의 medianIncomeTables 인자로 그대로 넘기면 된다. */
  medianIncomeTable: MedianIncomeTable | undefined;
  warnings: ParseWarnings;
}

// ── 메타데이터 ───────────────────────────────────────────────────

function parseMetadata(pdf: PdfExtraction, warnings: ParseWarnings) {
  const text = allText(pdf);

  const roundMatch = text.match(/제\s*(\d+)\s*차\s*장기전세주택/);
  const round = roundMatch ? parseInt(roundMatch[1], 10) : undefined;
  if (round == null) warnings.push("공고 회차(제N차)를 찾지 못함");

  const dateMatch = text.match(/입주자\s*모집\s*공고일은\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  let noticeDate: string | undefined;
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    noticeDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  } else {
    warnings.push("입주자 모집 공고일을 찾지 못함");
  }

  return { round, noticeDate };
}

// ── 소득기준표(가구원수별 가구당 월평균소득) ────────────────────────

function parseMedianIncomeTable(
  pdf: PdfExtraction,
  id: string,
  warnings: ParseWarnings,
): MedianIncomeTable | undefined {
  const page = findPage(pdf, /가구원수별\s*가구당\s*월평균소득\s*표/);
  if (!page) {
    warnings.push("소득기준표(가구원수별 가구당 월평균소득 표)를 찾지 못함");
    return undefined;
  }

  const lines = page.text.split("\n");
  const startIdx = lines.findIndex((l) => /가구원수별\s*가구당\s*월평균소득\s*표/.test(l));
  const byPercent: Record<number, Record<number, number>> = {};
  let rowsFound = 0;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const rowMatch = line.match(/^(\d+)%\s+(.+)$/);
    if (!rowMatch) {
      // 표가 끝났다고 볼 수 있는 지점(다음 큰 섹션 시작 등)이면 중단
      if (rowsFound > 0 && /^[가-힣]/.test(line) && !/원/.test(line)) break;
      continue;
    }
    const percent = parseInt(rowMatch[1], 10);
    const valueTokens = rowMatch[2].match(/[\d,]+원/g) ?? [];
    const values = valueTokens.map((t) => parseCommaNumber(t.replace("원", "")));
    if (values.length === 0 || values.length > 6) {
      warnings.push(`소득기준표 ${percent}% 행의 값 개수가 이상함(${values.length}개) — 건너뜀`);
      continue;
    }
    // 실측: 값 개수가 6보다 적으면 항상 "큰 가구원수 쪽"부터 채워지고 작은 가구원수가
    // 비어있다(1인/2인가구 기준액이 더 낮은 % 구간과 겹쳐 표에 생략되는 패턴, 49·50차
    // 공통 확인). 그래서 6인가구를 오른쪽 끝으로 정렬한다.
    const startHousehold = 7 - values.length;
    const row: Record<number, number> = {};
    values.forEach((v, idx) => {
      row[startHousehold + idx] = v;
    });
    byPercent[percent] = row;
    rowsFound++;
  }

  if (rowsFound === 0) {
    warnings.push("소득기준표 행을 하나도 파싱하지 못함");
    return undefined;
  }
  if (rowsFound < 8) {
    warnings.push(`소득기준표에서 ${rowsFound}개 %구간만 찾음(보통 11개 안팎) — 표가 페이지 경계에서 잘렸을 수 있음`);
  }

  return {
    id,
    year: new Date().getFullYear(), // 공고문에 연도가 명시적으로 안 나오는 경우가 많아 호출부에서 override 권장
    sourceNote: "Tier A 파서가 공고문의 <가구원수별 가구당 월평균소득 표>에서 추출(통계청 도시근로자 가구 월평균소득 기준).",
    byPercent,
  };
}

// ── 자산기준(공통) + 신생아 소득·자산 가산 ───────────────────────────

const NEWBORN_APPLIES_WHEN: RuleCondition[][] = [
  [
    { type: "newborn-children-count", min: 1, max: 1 },
    { type: "pre-existing-minor-child", value: false },
  ],
  [{ type: "newborn-children-count", min: 2 }],
  [
    { type: "newborn-children-count", min: 1, max: 1 },
    { type: "pre-existing-minor-child", value: true },
  ],
];
const NEWBORN_REASONS = [
  "① 2023.3.28. 이후 출생(태아 포함)한 자녀가 1명만 있는 경우",
  "② 2023.3.28. 이후 출생(태아 포함)한 자녀가 2명 이상인 경우",
  "③ 2023.3.28. 이후 출생 자녀 1명 + 2023.3.27. 이전 출생 미성년자녀가 함께 있는 경우",
];

interface AssetParseResult {
  base: { totalAssetLimitWon: number; vehicleValueLimitWon: number };
  incomeAdjustments: ThresholdAdjustment[];
  assetAdjustments: ThresholdAdjustment[];
}

/**
 * "- 자산 가산 적용" 섹션(기본/①/②③ 3열의 총자산·자동차 표)과 그 위의
 * "- 소득 가산 적용" 표(기본/①/②③/맞벌이)를 함께 파싱한다. 두 표가 항상 붙어서
 * 나오는 걸 49·50·51차 공통으로 확인했다.
 */
function parseAssetAndNewbornAdjustments(pdf: PdfExtraction, warnings: ParseWarnings): AssetParseResult | undefined {
  const page = findPage(pdf, /자산\s*가산\s*적용/);
  if (!page) {
    warnings.push("'자산 가산 적용' 섹션을 찾지 못함");
    return undefined;
  }
  const text = page.text;

  const assetLine = text.match(/총자산\s+([\d,]+)만원\s+([\d,]+)만원\s+([\d,]+)만원/);
  const carLine = text.match(/자동차\s+([\d,]+)만원\s+([\d,]+)만원\s+([\d,]+)만원/);
  if (!assetLine || !carLine) {
    warnings.push("자산기준 표(총자산/자동차 3열)를 파싱하지 못함");
    return undefined;
  }
  const toWon = (manwon: string) => parseCommaNumber(manwon) * 10_000;
  const assetVals = [toWon(assetLine[1]), toWon(assetLine[2]), toWon(assetLine[3])];
  const carVals = [toWon(carLine[1]), toWon(carLine[2]), toWon(carLine[3])];

  const assetAdjustments: ThresholdAdjustment[] = [
    {
      reason: NEWBORN_REASONS[0],
      appliesWhen: NEWBORN_APPLIES_WHEN[0],
      totalAssetBonusWon: assetVals[1] - assetVals[0],
      vehicleValueBonusWon: carVals[1] - carVals[0],
    },
    {
      reason: NEWBORN_REASONS[1],
      appliesWhen: NEWBORN_APPLIES_WHEN[1],
      totalAssetBonusWon: assetVals[2] - assetVals[0],
      vehicleValueBonusWon: carVals[2] - carVals[0],
    },
    {
      reason: NEWBORN_REASONS[2],
      appliesWhen: NEWBORN_APPLIES_WHEN[2],
      totalAssetBonusWon: assetVals[2] - assetVals[0],
      vehicleValueBonusWon: carVals[2] - carVals[0],
    },
  ];

  // 소득 가산표: "70% 80% 90%" / "105% 115% 125% 140%" / "150% 160% 170% 200%" 처럼
  // 한 행에 기본/①/②③/맞벌이 값이 %로 나열된다. 행이 여러 개(면적·순위 구간별)이므로
  // 전부 찾아서 appliesWhen 없는 "일반적 가산폭(%p)"만 검증용으로 뽑는다 — 실측상 어느
  // 구간이든 ①은 기본+10%p, ②③은 기본+20%p로 항상 동일했다(49·50·51차 공통).
  // 주의: 이 표는 "자산 가산 적용" 표보다 한 페이지 앞(소득이 자산보다 먼저 나옴)에
  // 있는 경우가 있어(49차 실측: 소득=7쪽, 자산=8쪽) 자산 표가 있던 page.text가 아니라
  // "소득 가산 적용" 마커로 별도 페이지를 찾는다.
  const incomePage = findPage(pdf, /소득\s*가산\s*적용/);
  const incomeAdjText = incomePage?.text ?? text;
  const pctRows = [...incomeAdjText.matchAll(/(\d+)%\s+(\d+)%\s+(\d+)%(?:\s+(\d+)%)?/g)];
  let incomeBonusConfirmed = false;
  for (const row of pctRows) {
    const base = parseInt(row[1], 10);
    const b1 = parseInt(row[2], 10);
    const b23 = parseInt(row[3], 10);
    if (b1 - base === 10 && b23 - base === 20) incomeBonusConfirmed = true;
  }
  if (!incomeBonusConfirmed) {
    warnings.push("소득 가산표에서 기대한 +10%p/+20%p 패턴을 확인하지 못함 — 신생아 소득가산 값 검증 필요");
  }

  const incomeAdjustments: ThresholdAdjustment[] = [
    { reason: NEWBORN_REASONS[0], appliesWhen: NEWBORN_APPLIES_WHEN[0], percentagePointBonus: 10 },
    { reason: NEWBORN_REASONS[1], appliesWhen: NEWBORN_APPLIES_WHEN[1], percentagePointBonus: 20 },
    { reason: NEWBORN_REASONS[2], appliesWhen: NEWBORN_APPLIES_WHEN[2], percentagePointBonus: 20 },
  ];

  return {
    base: { totalAssetLimitWon: assetVals[0], vehicleValueLimitWon: carVals[0] },
    incomeAdjustments,
    assetAdjustments,
  };
}

// ── 배점표(5단계: 일반공급(일반)/우선공급, 3단계: 일반공급(주거약자)) ────

/** "10년 이상" / "7년 이상\n10년 미만" 같은 셀 텍스트에서 하한값(minValue)을 뽑는다. */
function tierMinValue(cell: string): number | undefined {
  const m = cell.match(/(\d+)\s*(?:년|세|인|회)\s*이상/);
  if (m) return parseInt(m[1], 10);
  // "3년 미만" 같은 최하 구간은 0으로 취급(문서 표기상 하한이 없는 구간)
  if (/미만/.test(cell)) return 0;
  return undefined;
}

/**
 * ScoreMetric은 항목마다 다르므로(criterion 텍스트 → metric 매핑) 라벨 기반으로
 * 정해진 매핑 테이블을 쓴다. 이 매핑은 49·50·51차에서 확인된 항목명 그대로다 —
 * 새 항목명이 나오면 매핑에 없으니 자동으로 warning이 붙는다(아래 참고).
 */
const CRITERION_METRIC: { match: RegExp; metric: ScoreItem["metric"]; unit: ScoreItem["unit"] }[] = [
  { match: /서울특별시\s*연속거주기간/, metric: { type: "seoul-residency-years" }, unit: "years" },
  { match: /무주택기간/, metric: { type: "homeless-period-years" }, unit: "years" },
  { match: /\(만\)\s*나이/, metric: { type: "applicant-age" }, unit: "age" },
  { match: /부양가족\s*수/, metric: { type: "dependents-count" }, unit: "count" },
  { match: /청약저축.*납입\s*횟수/, metric: { type: "savings-installments" }, unit: "installments" },
  { match: /청약예금.*가입\s*기간/, metric: { type: "savings-membership-years" }, unit: "years" },
  { match: /사회취약계층/, metric: { type: "special-category-match" }, unit: "custom" },
  { match: /장애인/, metric: { type: "special-category-match" }, unit: "custom" },
];

function parseScoreRubricTable(
  rows: (string | null)[][],
  headerPoints: number[],
  idPrefix: string,
  warnings: ParseWarnings,
): ScoreItem[] {
  const items: ScoreItem[] = [];
  let n = 0;
  for (const row of rows) {
    const labelCell = row.find((c) => c && /^[①-⑨]/.test(c.trim()));
    if (!labelCell) continue;
    const criterion = labelCell.replace(/^[①-⑨]\s*/, "").split("\n")[0].trim();

    const labelCellFlat = labelCell.replace(/\s+/g, " ");
    const mapping = CRITERION_METRIC.find((m) => m.match.test(labelCellFlat));
    if (!mapping) {
      warnings.push(`배점표 항목 "${criterion}"에 대응하는 ScoreMetric 매핑이 없음 — 이 항목은 스킵됨`);
      continue;
    }

    // labelCell 이후의 non-null 셀들을 순서대로 점수 컬럼(headerPoints 순서)에 매칭.
    const labelIdx = row.indexOf(labelCell);
    const valueCells = row.slice(labelIdx + 1).filter((c): c is string => !!c && c.trim().length > 0);
    if (valueCells.length !== headerPoints.length) {
      warnings.push(
        `배점표 항목 "${criterion}"의 구간 셀 개수(${valueCells.length})가 배점 컬럼 수(${headerPoints.length})와 안 맞음 — 스킵됨`,
      );
      continue;
    }

    const tiers: ScoreTier[] = valueCells.map((cell, i) => {
      const min = tierMinValue(cell) ?? 0;
      return { minValue: min, points: headerPoints[i], label: cell.replace(/\n/g, " ") };
    });

    // 사회취약계층/장애인처럼 minValue로 순서를 매길 수 없는 항목은 matchesAnyOf가
    // 필요하지만, 그건 카테고리 텍스트(생계급여수급자 등) 인식이 필요해 이번 1차
    // 구현에서는 자동화하지 않고 항상 warning으로 사람 확인을 요청한다.
    if (mapping.unit === "custom") {
      warnings.push(`"${criterion}" 항목은 범주형(matchesAnyOf)이라 자동 추출 대상에서 제외 — 수동 확인 필요`);
      continue;
    }

    items.push({
      id: `${idPrefix}-${++n}`,
      criterion,
      unit: mapping.unit,
      metric: mapping.metric,
      tiers,
    });
  }
  return items;
}

function parseScoreRubrics(pdf: PdfExtraction, warnings: ParseWarnings): ScoreRubric[] {
  // 실측 버그(50차): "가·감점 배점표"라는 문구는 실제 표보다 앞쪽의 안내문
  // ("...'가·감점 배점표'(31~32쪽)...")에도 등장해서, 텍스트 마커만으로 페이지를
  // 찾으면 표가 없는 페이지가 잡힐 수 있다. 그래서 텍스트가 아니라 "①로 시작하는
  // 셀 + 5점 헤더를 가진 실제 표"를 모든 페이지의 extract_tables() 결과에서 직접
  // 찾는다 — 이게 훨씬 확실한 앵커다.
  let scoreTable: (string | null)[][] | undefined;
  for (const p of pdf.pages) {
    for (const t of p.tables) {
      const flat = t.flatMap((row) => row).filter((c): c is string => !!c).join(" ");
      if (/①/.test(flat) && /5점/.test(flat)) {
        scoreTable = t;
        break;
      }
    }
    if (scoreTable) break;
  }
  if (!scoreTable) {
    warnings.push("배점표 형태의 표를 어느 페이지에서도 찾지 못함(extract_tables 실패 가능성)");
    return [];
  }

  // "일반공급\n(일반),\n우선공급" 행부터 "일반공급\n(주거약자)" 행 전까지가 5점 만점 표,
  // 그 이후가 3점 만점 표. 실측 헤더 행에 5점/4점/3점/2점/1점이 순서대로 등장.
  const jugeoyakjaStartIdx = scoreTable.findIndex((r) => r.some((c) => c && /주거약자/.test(c)));

  const generalRows = jugeoyakjaStartIdx > 0 ? scoreTable.slice(0, jugeoyakjaStartIdx) : scoreTable;
  const jugeoyakjaRows = jugeoyakjaStartIdx > 0 ? scoreTable.slice(jugeoyakjaStartIdx) : [];

  const generalItems = parseScoreRubricTable(generalRows, [5, 4, 3, 2, 1], "si-general", warnings);
  const jugeoyakjaItems = parseScoreRubricTable(jugeoyakjaRows, [3, 2, 1], "si-jy", warnings);

  // 알려진 갭(실측 확인, 49·50차 공통): pdfplumber.extract_tables()가 "⑤-2. (85㎡ 초과
  // 1순위 신청자) 청약예금 가입기간" 행을 표 경계 인식 실패로 통째로 빠뜨린다(매핑 실패가
  // 아니라 행 자체가 안 잡힘 — extract_text()엔 있는데 extract_tables()엔 없음).
  // 일반공급(일반)은 범주형 제외 항목이 없어 마땅히 6개가 나와야 하므로, 6개 미만이면
  // 이 갭이 발생했다고 보고 명시적으로 경고한다 — 조용히 5개짜리 배점표로 넘어가지 않는다.
  if (generalItems.length > 0 && generalItems.length < 6) {
    warnings.push(
      `일반공급(일반) 배점표 항목이 ${generalItems.length}개만 추출됨(정상 6개) — 표 추출 라이브러리가 행을 누락했을 가능성(예: ⑤-2 청약예금 가입기간). 반드시 원문 대조 필요.`,
    );
  }

  const rubrics: ScoreRubric[] = [];
  if (generalItems.length > 0) {
    rubrics.push({ id: "sr-general", appliesWhen: [], items: generalItems, note: "Tier A 파서 자동 추출(일반공급 일반)." });
  } else {
    warnings.push("일반공급(일반) 배점표 항목을 하나도 추출하지 못함");
  }
  if (jugeoyakjaItems.length > 0) {
    rubrics.push({
      id: "sr-jugeoyakja",
      appliesWhen: [{ type: "household-status", value: "주거약자형대상" }],
      items: jugeoyakjaItems,
      note: "Tier A 파서 자동 추출(일반공급 주거약자).",
    });
  } else {
    warnings.push("일반공급(주거약자) 배점표 항목을 하나도 추출하지 못함");
  }

  return rubrics;
}

// ── 재계약 감점 ─────────────────────────────────────────────────

function parsePenalty(pdf: PdfExtraction, warnings: ParseWarnings): ScoreItem | undefined {
  const page = findPage(pdf, /장기전세주택\s*임대차계약\s*사실이\s*있는\s*경우/);
  if (!page) {
    warnings.push("재계약 감점 기준 섹션을 찾지 못함");
    return undefined;
  }
  // 셀이 줄바꿈되면서 "-2점"이 라벨과 다른 줄로 떨어지는 경우가 있어(49·50차 실측:
  // "다목" 줄) 줄바꿈을 공백으로 정규화한 뒤 찾는다.
  const text = page.text.replace(/\s+/g, " ");
  const m6 = text.match(/3년\s*이내에.{0,40}?-6점/);
  const m4 = text.match(/5년\s*이내에.{0,40}?-4점/);
  const m2 = text.match(/(?:가목\s*및\s*나목\s*이외|이외의).{0,60}?-2점/);
  if (!m6 || !m4 || !m2) {
    warnings.push("재계약 감점 -6/-4/-2점 문구를 모두 찾지 못함");
    return undefined;
  }
  return {
    id: "si-penalty-recontract",
    criterion: "장기전세주택 재계약 이력",
    unit: "years",
    metric: { type: "prior-contract-elapsed-years" },
    tiers: [
      { minValue: 0, points: -6, label: "당첨자 발표일 기준 3년 이내 재계약 이력" },
      { minValue: 3, points: -4, label: "3년 이상 5년 이내 재계약 이력" },
      { minValue: 5, points: -2, label: "5년 초과 재계약 이력" },
    ],
  };
}

// ── 신청자격 표(EligibilityTrack) ─────────────────────────────────

type SupplyMethod = "공사건설형" | "매입형";

const SUPPLY_MARKER_RE = /공사\s*건설형\(일반[^)]*\)|서울시\s*매입형\(일반공급\)/g;

function isEligibilityTableHeader(row: (string | null)[]): boolean {
  // "신청면적"+"순위"로 시작하는 표만 대상 — 우선공급 표(2번째 칸이 소득기준으로 다름)와
  // 신생아 소득가산 표(1번째 칸이 "신청주택 면적")는 이 조건에서 자연히 걸러진다.
  return row[0]?.trim() === "신청면적" && row[1]?.trim() === "순위";
}

interface TaggedTable {
  supplyMethod: SupplyMethod;
  table: (string | null)[][];
}

/**
 * 각 신청자격 표가 "공사건설형"인지 "매입형"인지 태깅한다. 표 자체엔 그 정보가 없고
 * 앞쪽 안내문("○ 공사 건설형(일반, 주거약자)" 등)에만 있는데, 표 다음 페이지로
 * 이어지는 표는 새 마커 없이 이전 상태를 이어받는다(49차 실측: 매입형 표가 6~7쪽에
 * 걸쳐 있고 7쪽엔 새 마커가 없음). 마커/표 각각의 페이지 내 문자열 위치로 순서를
 * 맞춰서 판정한다(표 헤더 "신청면적"이 페이지 텍스트에도 그대로 나온다는 점 이용).
 */
function tagEligibilityTables(pdf: PdfExtraction, warnings: ParseWarnings): TaggedTable[] {
  const tagged: TaggedTable[] = [];
  let carryOver: SupplyMethod | undefined;

  for (const page of pdf.pages) {
    const markers = [...page.text.matchAll(SUPPLY_MARKER_RE)].map((m) => ({
      offset: m.index ?? 0,
      method: (m[0].startsWith("공사") ? "공사건설형" : "매입형") as SupplyMethod,
    }));

    const candidateTables = page.tables.filter((t) => t.length > 0 && isEligibilityTableHeader(t[0]));
    if (candidateTables.length === 0) continue;

    // "신청면적" 리터럴이 페이지 텍스트에 등장하는 순서 == candidateTables 순서라고
    // 가정(pdfplumber가 표를 위→아래 순서로 찾는다는 전제, 49·50차에서 확인됨).
    let searchFrom = 0;
    for (const table of candidateTables) {
      const offset = page.text.indexOf("신청면적", searchFrom);
      searchFrom = offset >= 0 ? offset + 1 : searchFrom;
      const precedingMarkers = markers.filter((m) => offset < 0 || m.offset < offset);
      const method = precedingMarkers.length > 0 ? precedingMarkers[precedingMarkers.length - 1].method : carryOver;
      if (!method) {
        warnings.push(`신청자격 표(페이지 ${page.pageNumber})의 공급방식(공사건설형/매입형)을 판정하지 못해 건너뜀`);
        continue;
      }
      tagged.push({ supplyMethod: method, table });
      carryOver = method;
    }
  }
  return tagged;
}

/** "60㎡초과\n85㎡이하" / "50㎡미만" / "85㎡초과" / "50㎡이상\n60㎡이하" 등을 area-range 조건으로. */
function parseAreaLabel(label: string): RuleCondition | undefined {
  const flat = label.replace(/\s+/g, "");
  let m = flat.match(/^(\d+)㎡이상(\d+)㎡이하$/);
  if (m) return { type: "area-range", minM2: +m[1], maxM2: +m[2] };
  m = flat.match(/^(\d+)㎡이하$/);
  if (m) return { type: "area-range", maxM2: +m[1] };
  m = flat.match(/^(\d+)㎡미만$/);
  if (m) return { type: "area-range", maxM2: +m[1], maxExclusive: true };
  m = flat.match(/^(\d+)㎡초과(\d+)㎡이하$/);
  if (m) return { type: "area-range", minM2: +m[1], minExclusive: true, maxM2: +m[2] };
  m = flat.match(/^(\d+)㎡초과$/);
  if (m) return { type: "area-range", minM2: +m[1], minExclusive: true };
  return undefined;
}

interface IncomePctResult {
  basePercent: number;
  dualPercent?: number;
}

/** "70% 이하" / "105% 이하\n(맞벌이: 140% 이하)" / "105% 이하 (맞벌이: 140% 이하)" 등을 파싱. */
function parseIncomePercent(cell: string): IncomePctResult | undefined {
  const baseMatch = cell.match(/^(\d+)%\s*이하/);
  if (!baseMatch) return undefined;
  const dualMatch = cell.match(/맞벌이[:\s]*(\d+)%\s*이하/);
  return { basePercent: parseInt(baseMatch[1], 10), dualPercent: dualMatch ? parseInt(dualMatch[1], 10) : undefined };
}

/**
 * "소득 외 기준" 칸을 조건으로. 명확한 수치 패턴(약정납입회차/가입경과/거주지)만 구조화하고,
 * "N순위 미해당자"/"그 외 거주"처럼 이전 순위를 참조하는 표현은 custom(needs-review)으로
 * 남긴다 — 위 헤더 코멘트 참고.
 */
function parseNonIncomeCondition(cell: string): RuleCondition[] {
  const flat = cell.replace(/\s+/g, " ").trim();
  const conditions: RuleCondition[] = [];

  // 실측 버그(49차): "1순위 미해당자 (단, 약정납입회차 6회 이상 우선)"처럼 "미해당자"
  // 문구 안에 "N회 이상"이 부가 우선조건으로 섞여 나오는 행이 있다. 이걸 먼저 걸러내지
  // 않으면 뒤의 "약정납입회차 N회 이상" 정규식이 이 문구를 "N회 이상이 필수 조건"으로
  // 잘못 해석해서, 실제로는 이 순위에 들어갈 수 있는 신청자(N회 미만 납입자)를 부당하게
  // 배제하는 조건을 만들어낸다 — 조용히 틀린 판정으로 이어지는 심각한 오류라 "미해당자"가
  // 있으면 다른 무엇보다 먼저 custom(needs-review)으로 처리한다.
  if (/미해당자|그\s*외/.test(flat)) {
    conditions.push({ type: "custom", description: flat });
    return conditions;
  }

  const installments = flat.match(/약정납입회차\s*(\d+)회\s*이상/);
  if (installments) {
    conditions.push({ type: "savings-account", minInstallments: parseInt(installments[1], 10), accountType: "청약저축" });
    return conditions; // "(단, N회 이상 우선)" 같은 부가 문구는 note로만 다뤄야 하므로 여기선 조건화하지 않음
  }

  const membership = flat.match(/가입하여\s*(\d+)년\s*경과/);
  if (membership) {
    conditions.push({ type: "savings-account", minMembershipYears: parseInt(membership[1], 10), accountType: "청약예금" });
    conditions.push({ type: "custom", description: flat }); // 예치기준금액(면적별 상이) 등 부가 조건은 구조화하지 않고 원문 보존
    return conditions;
  }

  if (/신청주택이\s*위치한\s*자치구의\s*연접자치구/.test(flat)) {
    conditions.push({ type: "residency", region: "신청주택이 위치한 자치구의 연접자치구" });
    return conditions;
  }
  if (/신청주택이\s*위치한\s*자치구/.test(flat)) {
    conditions.push({ type: "residency", region: "신청주택이 위치한 자치구" });
    return conditions;
  }

  // "1순위 미해당자", "1,2순위 미해당자", "그 외 거주" 등 — 이전 행 조건의 보수를
  // 사람이 판단해야 하므로 자동으로 조건을 만들지 않는다.
  conditions.push({ type: "custom", description: flat });
  return conditions;
}

interface EligibilityParseResult {
  tracks: EligibilityTrack[];
  incomeThresholds: IncomeThresholdTable[];
}

function parseEligibilityTracks(
  pdf: PdfExtraction,
  medianIncomeTableId: string,
  assetThresholdId: string,
  warnings: ParseWarnings,
): EligibilityParseResult {
  const taggedTables = tagEligibilityTables(pdf, warnings);
  if (taggedTables.length === 0) {
    warnings.push("신청자격 표(면적×공급방식×순위)를 하나도 찾지 못함");
    return { tracks: [], incomeThresholds: [] };
  }

  const tracks: EligibilityTrack[] = [];
  const incomeThresholdsById = new Map<string, IncomeThresholdTable>();
  let trackN = 0;

  const incomeIdFor = (basePercent: number, dual: boolean, areaCond: RuleCondition): string => {
    const id = `it-${basePercent}${dual ? "-dual" : ""}`;
    if (!incomeThresholdsById.has(id)) {
      incomeThresholdsById.set(id, {
        id,
        appliesWhen: dual ? [areaCond, { type: "dual-income", value: true }] : [areaCond, { type: "dual-income", value: false }],
        medianIncomeTableId,
        percentOfMedianIncome: basePercent,
      });
    }
    return id;
  };

  for (const { supplyMethod, table } of taggedTables) {
    let currentArea: string | undefined;
    let currentIncomeCell: string | undefined;

    for (const row of table.slice(1)) {
      const [areaCell, rankCell, incomeCell, nonIncomeCell] = row;
      if (areaCell) currentArea = areaCell;
      if (incomeCell) currentIncomeCell = incomeCell;
      if (!currentArea || !rankCell || !currentIncomeCell || !nonIncomeCell) {
        warnings.push(`신청자격 표에서 필수 칸이 비어 행을 건너뜀(공급방식=${supplyMethod}, 순위칸="${rankCell}")`);
        continue;
      }

      const areaCond = parseAreaLabel(currentArea);
      if (!areaCond) {
        warnings.push(`면적 구간 문구를 해석하지 못함: "${currentArea}" — 이 행 건너뜀`);
        continue;
      }
      const rankMatch = rankCell.match(/(\d+)순위/);
      if (!rankMatch) {
        warnings.push(`순위 문구를 해석하지 못함: "${rankCell}" — 이 행 건너뜀`);
        continue;
      }
      const rank = parseInt(rankMatch[1], 10);

      const pct = parseIncomePercent(currentIncomeCell);
      if (!pct) {
        warnings.push(`소득기준 문구를 해석하지 못함: "${currentIncomeCell}" — 이 행은 소득기준 없이 생성됨`);
      }

      const incomeThresholdIds: string[] = [];
      if (pct) {
        incomeThresholdIds.push(incomeIdFor(pct.basePercent, false, areaCond));
        incomeThresholdIds.push(incomeIdFor(pct.dualPercent ?? pct.basePercent, true, areaCond));
      }

      const nonIncomeConditions = parseNonIncomeCondition(nonIncomeCell);
      const hasNeedsReview = nonIncomeConditions.some((c) => c.type === "custom");
      if (hasNeedsReview) {
        warnings.push(
          `신청자격 트랙 ${supplyMethod}/${currentArea.replace(/\s+/g, " ")}/${rank}순위: "소득 외 기준"이 이전 순위를 참조하는 표현("${nonIncomeCell.replace(/\s+/g, " ")}")이라 needs-review 조건으로 남김.`,
        );
      }

      trackN++;
      tracks.push({
        id: `et-auto-${trackN}`,
        label: `일반공급 ${rank}순위 · ${supplyMethod} · ${currentArea.replace(/\s+/g, " ")}`,
        rank,
        conditions: [areaCond, { type: "supply-method", value: supplyMethod }, ...nonIncomeConditions],
        incomeThresholdIds: incomeThresholdIds.length > 0 ? incomeThresholdIds : undefined,
        assetThresholdId,
        note: hasNeedsReview
          ? `원문 "소득 외 기준": "${nonIncomeCell}" — 이전 순위 조건을 참조하는 표현이라 자동으로 구조화하지 못함, 수동 확인 필요.`
          : undefined,
      });
    }
  }

  return { tracks, incomeThresholds: [...incomeThresholdsById.values()] };
}

// ── 오케스트레이션 ───────────────────────────────────────────────

export function parseShJangiJeonse(pdf: PdfExtraction, medianIncomeTableId?: string): ParsedShJangiJeonse {
  const warnings: ParseWarnings = [];

  const { round, noticeDate } = parseMetadata(pdf, warnings);
  const id = round != null ? `sh-jangi-jeonse-${round}` : "sh-jangi-jeonse-unknown";
  const incomeTableId = medianIncomeTableId ?? `kostat-urban-worker-${noticeDate?.slice(0, 4) ?? "unknown"}`;

  const medianIncomeTable = parseMedianIncomeTable(pdf, incomeTableId, warnings);
  const assetResult = parseAssetAndNewbornAdjustments(pdf, warnings);
  const scoreRubrics = parseScoreRubrics(pdf, warnings);
  const penalty = parsePenalty(pdf, warnings);
  if (penalty && scoreRubrics.length > 0) {
    // 재계약 감점은 두 배점표(일반/주거약자) 공통 적용(49·50·51차 공통 확인)
    for (const r of scoreRubrics) r.penalties = [penalty];
  }

  const assetThresholdId = "at-common";
  const assetThresholds: AssetThreshold[] = assetResult
    ? [
        {
          id: assetThresholdId,
          appliesWhen: [],
          totalAssetLimitWon: assetResult.base.totalAssetLimitWon,
          vehicleValueLimitWon: assetResult.base.vehicleValueLimitWon,
          adjustments: assetResult.assetAdjustments,
          note: "Tier A 파서 자동 추출(자산기준 공통 + 신생아 가산).",
        },
      ]
    : [];

  const { tracks: eligibilityTracks, incomeThresholds: parsedIncomeThresholds } = parseEligibilityTracks(
    pdf,
    incomeTableId,
    assetThresholdId,
    warnings,
  );
  // 신생아 소득가산(%p)은 모든 소득기준표에 공통 적용(49·50·51차 확인) — 여기서 붙인다.
  const incomeThresholds: IncomeThresholdTable[] = parsedIncomeThresholds.map((t) => ({
    ...t,
    adjustments: assetResult?.incomeAdjustments,
  }));

  const program: HousingProgram = {
    id,
    agency: "서울주택도시개발공사(SH)",
    title: round != null ? `제${round}차 장기전세주택 입주자모집공고` : "장기전세주택 입주자모집공고(회차 미확인)",
    noticeDate: noticeDate ?? "unknown",
    supplyType: "장기전세주택",
    rankingModel: { kind: "priority-tier+score" },
    incomeThresholds,
    assetThresholds,
    eligibilityTracks,
    scoreRubrics,
    tieBreakers: [{ type: "minor-children-count" }, { type: "random-lottery" }],
    verifiedBy: "rule-parsed",
    parseWarnings: warnings,
  };

  return { program, medianIncomeTable, warnings };
}
