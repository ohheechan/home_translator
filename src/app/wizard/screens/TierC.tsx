import type { WizardState } from "../types";

function MetadataCard({ state }: { state: WizardState }) {
  const meta = state.doc?.genericMetadata;
  if (!meta) return null;
  const rows: Array<[string, string]> = [];
  if (meta.title) rows.push(["공고 제목", meta.title]);
  if (meta.agencyGuess) rows.push(["발행기관(추정)", meta.agencyGuess]);
  if (meta.noticeDate) rows.push(["공고일", meta.noticeDate]);
  if (meta.contactPhones.length) rows.push(["문의처", meta.contactPhones.join(", ")]);
  if (meta.addressHints.length) rows.push(["위치 정보", meta.addressHints.join(", ")]);

  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="hint">이 문서에서는 안전하게 추출할 수 있는 기본 정보도 찾지 못했어요.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>확인된 기본 정보</h2>
      {rows.map(([label, value]) => (
        <div className="checklist-item" key={label}>
          <span>{label}</span>
          <span style={{ textAlign: "right", maxWidth: "65%" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function TierC({ state, onRestart }: { state: WizardState; onRestart: () => void }) {
  return (
    <div>
      <h1>아직 지원하지 않는 공고문이에요</h1>
      <p className="lead">
        이 공고문은 SH 장기전세주택 서식으로 인식되지 않았어요. 억지로 자격을 계산하면
        틀린 결과를 보여드릴 위험이 있어서, 지금은 안전하게 확인할 수 있는 기본 정보만
        보여드려요.
      </p>
      <MetadataCard state={state} />
      <div className="card">
        <p style={{ margin: 0, fontSize: 14 }}>
          이 유형(기관/상품)은 아직 자동 판정을 지원하지 않습니다. 순차적으로 반영하겠습니다.
        </p>
      </div>
      <button className="btn btn-primary" onClick={onRestart}>
        다른 공고문 업로드
      </button>
    </div>
  );
}
