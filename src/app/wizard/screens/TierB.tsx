import type { WizardState } from "../types";

export default function TierB({ state, onRestart }: { state: WizardState; onRestart: () => void }) {
  const meta = state.doc?.genericMetadata;
  const reasons = state.doc?.tierReasons ?? [];

  return (
    <div>
      <h1>이 공고문은 확실하게 처리하지 못했어요</h1>
      <p className="lead">
        SH 장기전세주택 서식으로는 인식됐지만, 아래 항목을 문서에서 예상한 형태로
        찾지 못했어요. 잘못된 자격 판정을 보여드리는 것보다, 지금은 계산하지 않는 게
        안전하다고 판단했어요.
      </p>
      <div className="card">
        <h2>확인이 필요한 부분</h2>
        <ul style={{ paddingLeft: 18, fontSize: 14, color: "#3a423e", margin: 0, lineHeight: 1.8 }}>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      {meta && (meta.title || meta.agencyGuess || meta.noticeDate || meta.contactPhones.length > 0) && (
        <div className="card">
          <h2>확인된 기본 정보</h2>
          {meta.title && (
            <div className="checklist-item">
              <span>공고 제목</span>
              <span style={{ textAlign: "right", maxWidth: "65%" }}>{meta.title}</span>
            </div>
          )}
          {meta.noticeDate && (
            <div className="checklist-item">
              <span>공고일</span>
              <span>{meta.noticeDate}</span>
            </div>
          )}
          {meta.contactPhones.length > 0 && (
            <div className="checklist-item">
              <span>문의처</span>
              <span>{meta.contactPhones.join(", ")}</span>
            </div>
          )}
        </div>
      )}
      <div className="card">
        <p style={{ margin: 0, fontSize: 14 }}>
          이 회차는 아직 자동 판정을 지원하지 않습니다. 순차적으로 반영하겠습니다. 신청
          가능 여부는 공고문 원문 또는 SH공사 문의처를 통해 직접 확인해주세요.
        </p>
      </div>
      <button className="btn btn-primary" onClick={onRestart}>
        다른 공고문 업로드
      </button>
    </div>
  );
}
