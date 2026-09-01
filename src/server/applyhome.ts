/**
 * 청약홈 분양정보 조회 서비스(data.go.kr, odcloud stage 37000) 클라이언트.
 * api-explore/FINDINGS.md에서 실측 확인한 두 오퍼레이션만 쓴다:
 *  - getAPTLttotPblancDetail (APT 분양/신혼희망타운 등)
 *  - getPblPvtRentLttotPblancDetail (공공지원민간임대)
 * 둘 다 "공고가 어디 있고 언제 접수하는지"까지만 주고, 소득·자산·배점 같은
 * 자격판정 데이터는 안 준다 — 그래서 이 서비스는 "목록/원문 링크 안내"용으로만
 * 쓴다(present.ts 배점 엔진과는 무관).
 *
 * DATA_GO_KR_SERVICE_KEY는 data.go.kr이 발급하는 그대로(이미 URL-encode된 값,
 * %2F/%3D%3D 포함)를 환경변수에 넣어야 한다 — URLSearchParams로 다시 encode하면
 * 이중 인코딩되어 401이 난다(FINDINGS.md에 기록된 실측 함정). 그래서 이 값만
 * 쿼리스트링에 직접(re-encode 없이) 이어붙인다.
 */

const ODCLOUD_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";

export interface NoticeListItem {
  source: "applyhome";
  houseType: string; // HOUSE_SECD_NM
  houseName: string;
  agency: string;
  address: string;
  region: string;
  receiptStart: string;
  receiptEnd: string;
  detailUrl: string;
  houseManageNo: string;
  pblancNo: string;
}

interface OdcloudResponse {
  data: Record<string, unknown>[];
}

async function fetchOdcloud(path: string, extraParams: Record<string, string>, perPage: number): Promise<Record<string, unknown>[]> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("서버에 DATA_GO_KR_SERVICE_KEY가 설정되어 있지 않아요.");
  }
  const qs = new URLSearchParams({ page: "1", perPage: String(perPage) });
  for (const [k, v] of Object.entries(extraParams)) qs.set(k, v);
  const url = `${ODCLOUD_BASE}/${path}?${qs.toString()}&serviceKey=${serviceKey}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`청약홈 API 호출에 실패했어요 (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as OdcloudResponse;
  return json.data ?? [];
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v);
}

export async function fetchApplyhomeNotices(opts: { regionKeyword?: string } = {}): Promise<NoticeListItem[]> {
  const region = opts.regionKeyword ?? "서울";

  const [apt, rent] = await Promise.all([
    fetchOdcloud("getAPTLttotPblancDetail", {}, 100).catch(() => []),
    fetchOdcloud("getPblPvtRentLttotPblancDetail", {}, 100).catch(() => []),
  ]);

  const items: NoticeListItem[] = [];

  for (const row of apt) {
    const regionNm = str(row, "SUBSCRPT_AREA_CODE_NM");
    const addr = str(row, "HSSPLY_ADRES");
    // 공급지역명이 있으면 그걸로만 판단한다(광역 사업 설명문에 다른 지역명이 우연히
    // 섞여있어 주소 부분일치만으로 거르면 오탐이 생긴다 — 예: 인천 공고인데 주소에
    // "서울특별시 강서구"가 인접 사업지 설명으로 함께 적힌 경우). 지역명 필드가 아예
    // 비어있을 때만 주소 부분일치로 대체한다.
    const matchesRegion = regionNm ? regionNm.includes(region) : addr.includes(region);
    if (!matchesRegion) continue;
    items.push({
      source: "applyhome",
      houseType: str(row, "HOUSE_SECD_NM") || str(row, "HOUSE_DTL_SECD_NM"),
      houseName: str(row, "HOUSE_NM"),
      agency: str(row, "BSNS_MBY_NM"),
      address: addr,
      region: regionNm,
      receiptStart: str(row, "RCEPT_BGNDE"),
      receiptEnd: str(row, "RCEPT_ENDDE"),
      detailUrl: str(row, "PBLANC_URL"),
      houseManageNo: str(row, "HOUSE_MANAGE_NO"),
      pblancNo: str(row, "PBLANC_NO"),
    });
  }

  for (const row of rent) {
    const regionNm = str(row, "SUBSCRPT_AREA_CODE_NM");
    const addr = str(row, "HSSPLY_ADRES");
    // 공급지역명이 있으면 그걸로만 판단한다(광역 사업 설명문에 다른 지역명이 우연히
    // 섞여있어 주소 부분일치만으로 거르면 오탐이 생긴다 — 예: 인천 공고인데 주소에
    // "서울특별시 강서구"가 인접 사업지 설명으로 함께 적힌 경우). 지역명 필드가 아예
    // 비어있을 때만 주소 부분일치로 대체한다.
    const matchesRegion = regionNm ? regionNm.includes(region) : addr.includes(region);
    if (!matchesRegion) continue;
    items.push({
      source: "applyhome",
      houseType: str(row, "HOUSE_SECD_NM") || "공공지원민간임대",
      houseName: str(row, "HOUSE_NM"),
      agency: str(row, "BSNS_MBY_NM"),
      address: addr,
      region: regionNm,
      receiptStart: str(row, "SUBSCRPT_RCEPT_BGNDE"),
      receiptEnd: str(row, "SUBSCRPT_RCEPT_ENDDE"),
      detailUrl: str(row, "PBLANC_URL"),
      houseManageNo: str(row, "HOUSE_MANAGE_NO"),
      pblancNo: str(row, "PBLANC_NO"),
    });
  }

  items.sort((a, b) => (a.receiptStart < b.receiptStart ? 1 : -1));
  return items;
}
