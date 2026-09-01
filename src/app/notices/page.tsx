"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NoticeListItem } from "../../server/applyhome";
import type { ShNoticeDetail, ShNoticeListItem } from "../../server/sh-portal";
import { fileToBase64 } from "../../parser/analyze-pdf";

type Tab = "sh" | "applyhome";

// 실제로 청약 신청을 받는 "모집공고" 성격 글만 분석 대상으로 제안한다 — 발표문/안내문/
// 설문조사 같은 글까지 "분석하기" 버튼을 보여주면 당연히 파서가 이해 못 해 Tier B/C로
// 떨어지고, 그건 버그가 아니라 애초에 그런 문서가 아니기 때문이라 혼란만 준다.
function looksLikeApplicationNotice(title: string): boolean {
  return /모집\s*공고/.test(title);
}

export default function NoticesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sh");

  const [shQuery, setShQuery] = useState("장기전세");
  const [shItems, setShItems] = useState<ShNoticeListItem[] | null>(null);
  const [shPage, setShPage] = useState(1);
  const [shLoading, setShLoading] = useState(false);
  const [shError, setShError] = useState<string | null>(null);

  const [selectedSeq, setSelectedSeq] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShNoticeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [ahItems, setAhItems] = useState<NoticeListItem[] | null>(null);
  const [ahLoading, setAhLoading] = useState(false);
  const [ahError, setAhError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "sh") return;
    setShLoading(true);
    setShError(null);
    const params = new URLSearchParams({ page: String(shPage) });
    if (shQuery.trim()) params.set("q", shQuery.trim());
    fetch(`/api/sh-notices?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setShItems(json.items);
      })
      .catch((e) => setShError(e instanceof Error ? e.message : "목록을 가져오지 못했어요."))
      .finally(() => setShLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, shPage]);

  useEffect(() => {
    if (tab !== "applyhome" || ahItems !== null) return;
    setAhLoading(true);
    setAhError(null);
    fetch("/api/applyhome-notices?region=서울")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setAhItems(json.items);
      })
      .catch((e) => setAhError(e instanceof Error ? e.message : "목록을 가져오지 못했어요."))
      .finally(() => setAhLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function runShSearch() {
    setShPage(1);
    setShItems(null);
    // useEffect가 shPage 변화에 반응하지 않을 수 있으니(이미 1인 경우) 직접 재요청
    setShLoading(true);
    setShError(null);
    const params = new URLSearchParams({ page: "1" });
    if (shQuery.trim()) params.set("q", shQuery.trim());
    fetch(`/api/sh-notices?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setShItems(json.items);
      })
      .catch((e) => setShError(e instanceof Error ? e.message : "목록을 가져오지 못했어요."))
      .finally(() => setShLoading(false));
  }

  function openDetail(seq: string) {
    setSelectedSeq(seq);
    setDetail(null);
    setDetailError(null);
    setImportError(null);
    setDetailLoading(true);
    fetch(`/api/sh-notices/${seq}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setDetail(json);
      })
      .catch((e) => setDetailError(e instanceof Error ? e.message : "상세를 가져오지 못했어요."))
      .finally(() => setDetailLoading(false));
  }

  async function importAndAnalyze(seq: string) {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/sh-notices/${seq}/pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "PDF를 가져오지 못했어요.");
      }
      const blob = await res.blob();
      const base64 = await fileToBase64(blob);
      sessionStorage.setItem("importPdfBase64", base64);
      router.push("/");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "분석을 시작하지 못했어요.");
      setImporting(false);
    }
  }

  return (
    <div>
      <h1>진행 중인 공고 둘러보기</h1>
      <p className="lead">
        SH공사 자체 공고와 청약홈에 올라오는 전국 공고를 한눈에 볼 수 있어요. 청약홈은
        공식 API가 공고문 원문(PDF)을 제공하지 않아 원문은 청약홈에서 직접 확인해야
        해요 — 반면 SH 공고는 이 화면에서 바로 전문을 읽고, 장기전세주택 모집공고라면
        곧바로 신청 자격 분석까지 이어갈 수 있어요.
      </p>

      <div className="chips" style={{ marginBottom: 16 }}>
        <div className={`chip ${tab === "sh" ? "selected" : ""}`} onClick={() => setTab("sh")}>
          SH 공고
        </div>
        <div className={`chip ${tab === "applyhome" ? "selected" : ""}`} onClick={() => setTab("applyhome")}>
          청약홈 공고(서울, 전 기관)
        </div>
      </div>

      {tab === "sh" && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <label>제목 검색</label>
            <div className="row">
              <input
                type="text"
                value={shQuery}
                onChange={(e) => setShQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runShSearch()}
                placeholder="예: 장기전세, 전세임대, 도시형생활주택 (비워두면 전체)"
              />
              <button className="btn btn-secondary" style={{ marginTop: 0 }} onClick={runShSearch}>
                검색
              </button>
            </div>
            <p className="hint">
              기본값은 "장기전세"예요 — 지금 이 서비스가 정확하게 분석할 수 있는 상품이라
              먼저 보여드려요. 검색어를 지우면 SH의 모든 공고및공지 게시글을 볼 수 있어요.
            </p>
          </div>

          {shLoading && <div className="spinner-text">불러오는 중…</div>}
          {shError && <div className="error-box">{shError}</div>}

          {shItems && shItems.length === 0 && (
            <div className="card">
              <p className="hint">검색 결과가 없어요.</p>
            </div>
          )}

          {shItems?.map((item) => (
            <div key={item.seq} className="card" style={{ cursor: "pointer" }} onClick={() => openDetail(item.seq)}>
              <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 15 }}>{item.title}</strong>
                {looksLikeApplicationNotice(item.title) && (
                  <span className="badge badge-pass" style={{ flexShrink: 0, marginLeft: 8 }}>
                    모집공고
                  </span>
                )}
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                {item.dept} · {item.date} · 조회 {item.views}
              </p>
            </div>
          ))}

          {shItems && shItems.length > 0 && (
            <div className="row" style={{ marginBottom: 14 }}>
              <button
                className="btn btn-ghost"
                disabled={shPage <= 1}
                onClick={() => setShPage((p) => Math.max(1, p - 1))}
              >
                이전 페이지
              </button>
              <button className="btn btn-ghost" onClick={() => setShPage((p) => p + 1)}>
                다음 페이지
              </button>
            </div>
          )}

          {selectedSeq && (
            <div className="card" style={{ borderColor: "var(--brand)" }}>
              {detailLoading && <div className="spinner-text">공고 내용을 불러오는 중…</div>}
              {detailError && <div className="error-box">{detailError}</div>}
              {detail && (
                <>
                  <h2 style={{ marginBottom: 10 }}>{detail.title}</h2>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13.5,
                      lineHeight: 1.7,
                      color: "#3a423e",
                      maxHeight: 420,
                      overflowY: "auto",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    {detail.bodyText || "본문 내용이 없어요."}
                  </div>

                  {detail.attachment ? (
                    <>
                      <p className="hint" style={{ marginBottom: 10 }}>
                        첨부파일: {detail.attachment.fileName}
                      </p>
                      <a
                        className="btn btn-secondary"
                        href={`/api/sh-notices/${detail.seq}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF 새 창에서 보기 / 다운로드
                      </a>
                      {looksLikeApplicationNotice(detail.title) && (
                        <button
                          className="btn btn-primary"
                          disabled={importing}
                          onClick={() => importAndAnalyze(detail.seq)}
                        >
                          {importing ? "PDF를 가져오는 중…" : "이 공고문으로 분석 시작하기"}
                        </button>
                      )}
                      {importError && <div className="error-box" style={{ marginTop: 10 }}>{importError}</div>}
                    </>
                  ) : (
                    <p className="hint">이 글에는 첨부파일이 없어요.</p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === "applyhome" && (
        <>
          {ahLoading && <div className="spinner-text">불러오는 중…</div>}
          {ahError && <div className="error-box">{ahError}</div>}
          {ahItems && ahItems.length === 0 && (
            <div className="card">
              <p className="hint">현재 서울 지역으로 조회되는 공고가 없어요.</p>
            </div>
          )}
          {ahItems?.map((item, i) => (
            <div key={i} className="card">
              <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 15 }}>{item.houseName}</strong>
                <span className="badge badge-warn" style={{ flexShrink: 0, marginLeft: 8 }}>
                  {item.houseType}
                </span>
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                {item.agency || "사업주체 정보 없음"}
              </p>
              <p className="hint">{item.address}</p>
              <p className="hint">
                접수 {item.receiptStart || "미정"} ~ {item.receiptEnd || "미정"}
              </p>
              {item.detailUrl && (
                <a className="btn btn-secondary" href={item.detailUrl} target="_blank" rel="noreferrer">
                  청약홈에서 원문 보기
                </a>
              )}
            </div>
          ))}
          <p className="hint" style={{ marginTop: 4 }}>
            청약홈 API는 목록·접수기간 같은 정보만 주고 공고문 PDF 자체는 주지 않아요
            (기관마다 원문을 신문·자체 홈페이지 등 서로 다른 곳에 올리기 때문). 자격
            분석까지 하려면 원문 링크에서 PDF를 받아 홈 화면에서 업로드해주세요.
          </p>
        </>
      )}

      <a href="/" className="btn btn-ghost">
        홈으로 돌아가기
      </a>
    </div>
  );
}
