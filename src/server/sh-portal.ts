/**
 * SH공사 자체 "인터넷청약시스템"(i-sh.co.kr) 공고 게시판을 서버사이드에서 읽어오는
 * 헬퍼. 왜 필요한가 — api-explore/FINDINGS.md에서 실측 확인했듯, 청약홈/data.go.kr
 * API 생태계 전체에 SH 장기전세주택 같은 SH 자체 상품이 아예 없다(청약홈이 다루는
 * 상품군: APT 분양/오피스텔/공공지원민간임대/무순위·잔여세대/임의공급 — SH 장기전세는
 * 이 중 어디에도 속하지 않고 SH 자체 시스템에서만 공고·접수됨). 그래서 "SH 공고
 * 목록"은 청약홈 API로 대체할 수 없고, SH 사이트 자체를 읽어야 한다.
 *
 * 이 게시판(청약정보>공고및공지>주택분양, brd_id=GS0401)은 공개 API가 없다 —
 * 목록/상세 모두 서버사이드 렌더링이 아니라 폼 POST + 세션 쿠키 기반이라, 이
 * 모듈이 매 요청마다 쿠키 잭(list.do → view.do → innoFD.do 순서)을 직접 흉내낸다.
 * robots.txt에 이 경로를 막는 규칙이 없고, 공개 게시판(로그인 없이 누구나 보는
 * 공고문)만 다룬다 — 청약 신청 자체(로그인·본인인증 필요)는 건드리지 않는다.
 *
 * 실측 근거(2026-09-01): 제51차 장기전세주택 입주자모집공고(seq=309467)로
 * list.do → view.do(POST) → innoFD.do(GET) 순서를 그대로 재현해 실제 PDF(766KB,
 * "제51차 장기전세 입주자 모집공고.pdf")를 받아오는 것까지 확인했다.
 */

const BASE = "https://www.i-sh.co.kr/app/lay2/program/S48T1581C1617/www/brd/m_244";
const BRD_ID = "GS0401";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface ShNoticeListItem {
  seq: string;
  title: string;
  dept: string;
  date: string;
  views: string;
}

export interface ShNoticeListResult {
  items: ShNoticeListItem[];
  page: number;
}

export interface ShNoticeAttachment {
  fileName: string;
  fileSeq: string;
}

export interface ShNoticeDetail {
  seq: string;
  title: string;
  bodyText: string;
  attachment: ShNoticeAttachment | null;
}

/** Set-Cookie 응답 헤더(여러 개일 수 있음)에서 "name=value" 쌍만 뽑아 Cookie 헤더용 문자열로 합친다. */
function collectCookies(res: Response, jar: Map<string, string>) {
  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = setCookie.length > 0 ? setCookie : (res.headers.get("set-cookie")?.split(/,(?=[^;]+=[^;]+;)/) ?? []);
  for (const c of raw) {
    const pair = c.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** list.do를 한 번 GET해서 세션 쿠키(JEUSSID 등)를 얻는다. 목록 자체도 이 응답에서 파싱한다. */
async function primeSession(jar: Map<string, string>): Promise<string> {
  const res = await fetch(`${BASE}/list.do`, {
    headers: { "User-Agent": UA },
  });
  collectCookies(res, jar);
  return res.text();
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 제목 검색으로 필터링된 공고 목록. srchWord가 없으면 전체 목록(최신순). */
export async function fetchShNoticeList(opts: { page?: number; srchWord?: string } = {}): Promise<ShNoticeListResult> {
  const page = opts.page ?? 1;
  const jar = new Map<string, string>();
  const body = new URLSearchParams({ page: String(page) });
  if (opts.srchWord) {
    body.set("srchTp", "0"); // 0: 제목 검색
    body.set("srchWord", opts.srchWord);
  }
  const res = await fetch(`${BASE}/list.do`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  collectCookies(res, jar);
  const html = await res.text();

  const items: ShNoticeListItem[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const seqMatch = row.match(/getDetailView\('(\d+)'\)/);
    if (!seqMatch) continue;
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((c) => stripTags(c[1]).trim());
    // 셀 구성: [번호, 제목(+NEW뱃지 텍스트 섞임), 부서명, 날짜, 조회수]
    if (cells.length < 5) continue;
    const title = cells[1].replace(/^NEW\s*/, "").trim();
    items.push({
      seq: seqMatch[1],
      title,
      dept: cells[2],
      date: cells[3],
      views: cells[4],
    });
  }

  return { items, page };
}

/** 공고 상세: 전문 텍스트 + 첨부파일 메타(있으면). PDF 다운로드에 필요한 file_seq도 함께 얻는다. */
export async function fetchShNoticeDetail(seq: string): Promise<ShNoticeDetail> {
  const jar = new Map<string, string>();
  await primeSession(jar);

  const res = await fetch(`${BASE}/view.do`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      Referer: `${BASE}/list.do`,
    },
    body: new URLSearchParams({ seq }).toString(),
  });
  const html = await res.text();

  const titleMatch = html.match(/<caption>([^<]+)<\/caption>/);
  const bodyMatch = html.match(/<td colspan="2" class="cont">([\s\S]*?)<\/td>\s*<\/tr>/);
  // 첨부파일 링크 위에 아이콘 예시가 HTML 주석으로 남아있어("<!-- ... <a class=btnAttach>.pdf</a> ... -->")
  // onclick="existFile(...)"가 있는 진짜 링크만 골라야 한다(주석은 이 속성이 없음).
  const attachNameMatch = html.match(/class="btnAttach[^"]*"[^>]*onclick="existFile[^>]*>\s*([\s\S]*?)\s*<\/a>/);
  const fileSeqMatch = html.match(/file_seq=(\d+)/);

  return {
    seq,
    title: titleMatch ? titleMatch[1].trim() : `공고 ${seq}`,
    bodyText: bodyMatch ? stripTags(bodyMatch[1]) : "",
    attachment:
      attachNameMatch && fileSeqMatch
        ? { fileName: stripTags(attachNameMatch[1]).trim(), fileSeq: fileSeqMatch[1] }
        : null,
  };
}

export interface ShNoticePdf {
  bytes: ArrayBuffer;
  fileName: string;
  contentType: string;
}

/**
 * list.do(세션 획득) → view.do(POST, 첨부파일 존재 확인 겸 세션 유지) → innoFD.do(GET, 실제 파일)
 * 순서를 그대로 재현한다. 셋 중 하나라도 건너뛰면 innoFD.do가 401을 준다(실측 확인됨).
 */
export async function fetchShNoticePdf(seq: string): Promise<ShNoticePdf> {
  const jar = new Map<string, string>();
  await primeSession(jar);

  const viewRes = await fetch(`${BASE}/view.do`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      Referer: `${BASE}/list.do`,
    },
    body: new URLSearchParams({ seq }).toString(),
  });
  collectCookies(viewRes, jar);
  const viewHtml = await viewRes.text();

  const fileSeqMatch = viewHtml.match(/file_seq=(\d+)/);
  if (!fileSeqMatch) {
    throw new Error("이 공고에는 첨부파일(PDF)이 없어요.");
  }
  const fileSeq = fileSeqMatch[1];

  const dlRes = await fetch(
    `https://www.i-sh.co.kr/app/com/file/innoFD.do?brdId=${BRD_ID}&seq=${seq}&fileTp=A&fileSeq=${fileSeq}`,
    {
      headers: {
        "User-Agent": UA,
        Cookie: cookieHeader(jar),
        Referer: `${BASE}/view.do`,
      },
    },
  );
  if (!dlRes.ok) {
    throw new Error(`SH 사이트에서 파일을 받아오지 못했어요 (HTTP ${dlRes.status}).`);
  }
  const disposition = dlRes.headers.get("content-disposition") ?? "";
  const nameMatch = disposition.match(/filename="?([^";]+)"?/);
  let fileName = "공고문.pdf";
  if (nameMatch) {
    try {
      fileName = decodeURIComponent(nameMatch[1]);
    } catch {
      fileName = nameMatch[1];
    }
  }
  const bytes = await dlRes.arrayBuffer();
  return { bytes, fileName, contentType: dlRes.headers.get("content-type") ?? "application/pdf" };
}
