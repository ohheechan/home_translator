import type { LoanProduct } from "../types/loan";

/**
 * 2026-09-01 기준 웹 조사 정리 (KB국민은행 대출가이드, 서울주거포털 등 복수
 * 출처 교차확인). 주택도시기금 대출은 시행세칙 개정으로 조건이 자주 바뀌고
 * 출처마다 소득기준 숫자가 다르게 적혀 있는 경우도 있어(예: 일반 버팀목
 * 소득기준을 5천만원/7.5천만원으로 다르게 안내하는 글이 공존) — 이 파일의
 * 값은 "참고용 근사치"다. 실제 신청 전에는 반드시 officialUrl에서 최신
 * 조건과 금리를 확인해야 한다(present.ts의 PRELIMINARY_ESTIMATE_DISCLAIMER
 * 에도 같은 문구가 있다).
 *
 * 이 프로그램(SH 장기전세주택)은 매입/구입이 아니라 "전세"이므로, 구입자금
 * 대출인 디딤돌대출과 분양형 상품인 신혼희망타운 연계대출은 대상에서 제외
 * 했다 — design doc 06장이 이 서비스가 지원하는 청약 유형 전체(분양 포함)를
 * 염두에 두고 그 둘까지 나열했지만, 실제 구현 범위(SH 장기전세주택)에 맞지
 * 않는 상품을 보여주면 오히려 오해를 준다.
 *
 * 풀을 "소득 수준별로 실제 갈리는" 상품까지 넓히기 위해 주택도시기금(버팀목
 * 계열) 소득기준을 넘는 가구를 위한 소득 무상한 상품(HF 일반전세자금보증)과,
 * 이 서비스 사용자가 전부 서울 거주자라는 전제(자치구 선택 화면 자체가
 * 서울 25개구뿐)로 항상 적용 대상인 서울시 자체 이자지원 사업 2종도 포함한다
 * — 이 둘은 버팀목 대출과 별도로 "같이" 받을 수 있는 것도 있어(loanLimitNote에
 * 명시) 단순 대체재가 아니라 풀을 넓히는 진짜 선택지다.
 *
 * 전세사기피해자 전용/비정상거처(옛 위험건축물) 이주지원 버팀목대출도 실존
 * 하지만, 이 둘은 애초에 소득·자산이 아니라 "공식 피해자 결정통지서"·"비정상
 * 거처 확인서" 같은 사전 행정 절차로만 판가름 나서 이 서비스가 입력받는 어떤
 * 항목으로도 대상 여부를 전혀 좁힐 수 없고, 여러 출처를 뒤져도 신뢰할 만한
 * 소득·한도 숫자를 확인하지 못했다 — 숫자를 지어내느니 카드로 만들지 않고
 * Result 화면에 짧은 안내 문구로만 존재를 알린다(추정치를 실제 조건처럼
 * 보여주는 게 더 나쁘다는 이 프로젝트의 원칙).
 */
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: "beotimok-general",
    name: "버팀목전세자금대출",
    agency: "주택도시기금 (취급은행: 우리·국민·신한·농협·하나은행)",
    summary: "무주택 세대주라면 가장 먼저 확인해볼 기본 전세자금대출",
    targetNote: "만 19세 이상 무주택 세대주(1개월 이내 세대주 예정자 포함)",
    minAge: 19,
    incomeCapManwon: 5_000,
    incomeCapNote: "미성년 2자녀 이상 가구는 6,000만원까지 완화",
    netAssetCapManwon: 34_500,
    loanLimitNote: "수도권 최대 1억 2천만원 / 수도권 외 최대 8천만원 (전세보증금의 70% 이내, 2자녀 이상 가구는 수도권 2억 5천만원·지방 1억 6천만원까지 확대)",
    officialUrl: "https://nhuf.molit.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "beotimok-youth",
    name: "청년전용 버팀목전세자금대출",
    agency: "주택도시기금 (취급은행: 우리·국민·신한·농협·하나은행)",
    summary: "만 34세 이하 청년 단독세대주를 위한 낮은 금리의 전세자금대출",
    targetNote: "만 19~34세 단독세대주(예정자 포함), 무주택",
    minAge: 19,
    maxAge: 34,
    incomeCapManwon: 5_000,
    incomeCapNote: "신혼가구는 7,500만원, 미성년 2자녀 이상 가구는 6,000만원까지 완화",
    netAssetCapManwon: 34_500,
    loanLimitNote: "최대 1억 5천만원(만 25세 미만 단독세대주는 1억 2천만원), 전세보증금의 80% 이내",
    depositCapManwon: 30_000,
    officialUrl: "https://nhuf.molit.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "beotimok-newlywed",
    name: "신혼부부전용 버팀목전세자금대출",
    agency: "주택도시기금 (취급은행: 우리·국민·신한·농협·하나은행)",
    summary: "혼인 7년 이내(또는 3개월 내 결혼예정) 부부를 위한 확대 한도 전세자금대출",
    targetNote: "혼인기간 7년 이내 또는 3개월 이내 결혼예정자, 무주택 세대주",
    requiresNewlywedOrEngaged: true,
    incomeCapManwon: 7_500,
    incomeCapNote: "정부가 1억원으로 완화 예정이라는 보도가 있음 — 신청 시점 기준 재확인 필요",
    netAssetCapManwon: 34_500,
    loanLimitNote: "수도권 최대 3억원 / 수도권 외 최대 2억원, 전세보증금의 80% 이내",
    officialUrl: "https://nhuf.molit.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "beotimok-newborn",
    name: "신생아 특례 버팀목전세자금대출",
    agency: "주택도시기금 (취급은행: 우리·국민·신한·농협·하나은행)",
    summary: "최근 2년 내 자녀를 출산·입양한 가구를 위한 대폭 확대된 한도의 전세자금대출",
    targetNote: "대출접수일 기준 2년 이내 자녀를 출산(2023.1.1. 이후 출생, 입양 포함)한 무주택 세대주",
    incomeCapManwon: 13_000,
    incomeCapManwonDualIncome: 20_000,
    incomeCapNote: "맞벌이는 2억원까지 완화(단, 부부 중 한 명은 1억 3천만원 이하여야 함)",
    netAssetCapManwon: 34_500,
    loanLimitNote: "임차보증금의 80% 이내, 호당 최대 2억 4천만원",
    officialUrl: "https://nhuf.molit.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "jungsokiup-youth",
    name: "중소기업취업청년 전세자금대출",
    agency: "주택도시기금 (취급은행: 우리·국민·신한·농협·하나은행 등)",
    summary: "중소·중견기업 재직 청년을 위한 낮은 금리의 전세자금대출(이른바 '중기청')",
    targetNote: "만 19~34세(병역 이행 시 최대 39세) 무주택 세대주로 중소·중견기업 재직자 또는 정부지원 청년창업자",
    minAge: 19,
    maxAge: 34,
    incomeCapManwon: 3_500,
    incomeCapManwonDualIncome: 5_000,
    incomeCapNote: "단독세대주/외벌이 3,500만원, 맞벌이는 5,000만원까지 완화",
    netAssetCapManwon: 36_100,
    loanLimitNote: "최대 1억원(재직 1년 미만이면 2천만원 이하로 제한될 수 있음), 임차보증금 2억원 이하 주택 대상",
    depositCapManwon: 20_000,
    note: "순자산 기준은 조사 시점 자료 특성상 다른 상품보다 오래된 값(2023년 조사분)일 수 있어요 — 최신 금액은 꼭 재확인하세요.",
    officialUrl: "https://nhuf.molit.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "hf-general-guarantee",
    name: "일반전세자금보증(HF, 소득 제한 없음)",
    agency: "한국주택금융공사(HF) — 시중은행 전세대출에 붙는 보증",
    summary: "버팀목 계열 소득기준을 넘는 가구도 쓸 수 있는, 소득 상한이 없는 일반 은행 전세대출용 보증",
    targetNote: "무주택 세대주(1주택자는 보증한도가 줄어듦) — 소득 상한은 없지만 은행 자체 심사(신용도·DTI 등)를 통과해야 실행돼요",
    loanLimitNote: "임차보증금 수도권 7억원 이하(지방 5억원 이하) 주택 대상, 무주택자는 최대 4억원까지 보증(1주택자는 2억원)",
    note: "버팀목 계열처럼 정부가 직접 소득기준을 두는 상품이 아니라, 은행이 시중금리로 빌려주는 전세대출에 HF가 보증을 서는 구조예요 — 그래서 금리가 버팀목 계열보다 높을 수 있어요.",
    officialUrl: "https://www.hf.go.kr",
    asOf: "2026-09-01",
  },
  {
    id: "seoul-newlywed-interest-support",
    name: "서울시 신혼부부 임차보증금 이자지원",
    agency: "서울특별시 (전월세보증금지원센터, 02-2133-1200)",
    summary: "서울시가 전세자금대출 이자를 보전해주는 신혼부부 전용 지원 — 버팀목 등 다른 전세자금대출과 별도로 신청 가능",
    targetNote: "혼인신고일 기준 7년 이내(또는 추천서 신청일로부터 6개월 내 결혼예정)인 무주택 부부, 서울시 거주",
    requiresNewlywedOrEngaged: true,
    incomeCapManwon: 13_000,
    incomeCapNote: "부부합산 기준",
    loanLimitNote: "임차보증금 7억원 이하 주택 대상, 최대 3억원(보증금의 90% 이내) 대출분에 대해 연 1.0~3.0% 이자를 서울시가 지원(신혼예정 +0.2%p, 자녀 +0.5~1.5%p 추가 우대, 최대 연 4.5%까지)",
    note: "부부당 생애 1회, 신랑·신부 중 1명만 신청할 수 있어요.",
    officialUrl: "https://housing.seoul.go.kr/site/main/content/sh01_0400800",
    asOf: "2026-09-01",
  },
  {
    id: "seoul-youth-interest-support",
    name: "서울시 청년 임차보증금 이자지원",
    agency: "서울특별시 (전월세보증금지원센터, 02-2133-1200)",
    summary: "서울시가 전세자금대출 이자를 보전해주는 청년 전용 지원 — 버팀목 등 다른 전세자금대출과 별도로 신청 가능",
    targetNote: "만 19~39세 무주택 청년, 서울시 거주",
    minAge: 19,
    maxAge: 39,
    incomeCapManwon: 5_000,
    loanLimitNote: "최대 2억원(보증금의 90% 이내) 대출분에 대해 연 2.0% 이자를 서울시가 지원, 계약기간에 따라 최대 8년까지 연장 가능",
    officialUrl: "https://housing.seoul.go.kr/site/main/content/sh01_040901",
    asOf: "2026-09-01",
  },
];
