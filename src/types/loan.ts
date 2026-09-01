/**
 * 참고용 정책대출(전세자금대출) 정보. program.ts의 청약 자격판정과는 완전히
 * 분리된 영역이다 — 이 프로그램(SH 장기전세주택)은 당첨돼도 전세보증금을
 * 마련해야 하므로, 보증금 마련에 쓸 수 있는 주택도시기금 전세자금대출 상품군을
 * "참고용"으로만 안내한다.
 *
 * design doc 06장이 이미 지적한 대로 정책대출 조건은 공식 API가 없어 자체
 * 정적 데이터로 관리한다 — 그래서 "확정 안내"가 아니라 "해당 가능성이 있는
 * 상품군 좁히기"로만 쓰고, 정확한 최신 조건(금리 포함)은 항상 주택도시기금
 * 공식 채널에서 재확인하도록 안내해야 한다. LLM은 이 판단에 전혀 관여하지
 * 않는다 — 아래 규칙은 전부 결정적(deterministic) 비교다.
 */

export interface LoanProduct {
  id: string;
  name: string;
  agency: string;
  /** 카드 상단에 보여줄 한 줄 요약 */
  summary: string;
  /** 대상 요건을 사람이 읽는 문장으로 (연령·혼인 등, 판정 로직과 별개로 항상 원문 그대로 보여줌) */
  targetNote: string;
  minAge?: number;
  maxAge?: number;
  /** "혼인 또는 3개월 이내 혼인예정" 요건이 있는 상품(신혼부부전용류)만 표시 */
  requiresNewlywedOrEngaged?: boolean;
  /** 부부(또는 단독세대주) 합산 연소득 상한. 만원 단위. 맞벌이 완화 기준이 없는
   *  상품은 이 값 하나만 쓴다(단독세대주/외벌이 기준과 같다고 가정). undefined면
   *  이 상품엔 소득 상한 자체가 없다는 뜻(예: HF 일반전세자금보증) — 소득 축
   *  검사를 아예 건너뛴다(항상 통과). */
  incomeCapManwon?: number;
  /** BaseProfile.dualIncome이 true일 때 incomeCapManwon 대신 쓰는 완화된 상한.
   *  맞벌이 여부는 Profile1 화면에서 항상 입력받는 필드라 100% 확정 판단 가능하다. */
  incomeCapManwonDualIncome?: number;
  /** 2자녀 이상 가구 등 그 외 완화 조건이 있으면 참고용 문구로만 덧붙인다(판정에는 안 씀). */
  incomeCapNote?: string;
  /** 순자산 상한. 만원 단위. undefined면 이 상품엔 자산 상한 자체가 없거나(HF
   *  일반전세자금보증) 조사 과정에서 공식 수치를 찾지 못한 것 — 어느 쪽이든
   *  자산 축 검사를 건너뛴다(항상 통과, "확인 필요"로 낮추지 않는다). */
  netAssetCapManwon?: number;
  /** 대출한도 서술(지역별로 갈리는 경우가 많아 숫자 하나로 못 담는다). */
  loanLimitNote: string;
  /** 전세보증금 상한이 있는 상품만 설정(예: 청년전용 3억원 이하 주택). */
  depositCapManwon?: number;
  officialUrl: string;
  /** 이 데이터를 조사한 기준일. YYYY-MM-DD. 화면에 "OO 기준" 형태로 노출해
   *  오래된 데이터를 최신인 것처럼 보여주지 않는다. */
  asOf: string;
  /** 자산기준 산정연도가 다르다는 등, 위 필드로 못 담는 개별 캐비어트. 카드에
   *  힌트 한 줄로 그대로 노출한다. */
  note?: string;
}

export type LoanFitLevel = "가능성 높음" | "확인 필요";

export interface LoanMatchResult {
  product: LoanProduct;
  fit: LoanFitLevel;
  /** 판단 근거를 사람이 읽는 문장으로 — present.ts의 checklist 패턴과 동일하게
   *  "왜 이렇게 판단했는지"를 항상 같이 보여준다. */
  reasons: string[];
}
