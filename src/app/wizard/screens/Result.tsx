"use client";

import { useMemo } from "react";
import type { Step, WizardState } from "../types";
import type { BaseProfile, UserProfile } from "../../../types/profile";
import { evaluateProgram, type TrackEvaluation } from "../../../engine/eligibility";
import { computeScore } from "../../../engine/scoring";
import { presentTrackResult, type PresentedResult } from "../../../engine/present";

interface Props {
  state: WizardState;
  goTo: (s: Step) => void;
  onRestart: () => void;
}

function isCompleteBaseProfile(b: Partial<BaseProfile>): b is BaseProfile {
  return (
    b.householdMonthlyIncomeWon != null &&
    b.householdSize != null &&
    b.dualIncome != null &&
    b.totalAssetWon != null &&
    b.vehicleValueWon != null &&
    b.accountType != null &&
    !!b.residenceDistrict &&
    b.housingOwnership != null &&
    b.accessibleHousingTarget != null &&
    b.maritalStatus != null
  );
}

function headlineClass(headline: PresentedResult["headline"]): string {
  if (headline === "신청 가능") return "pass";
  if (headline === "신청 불가") return "fail";
  return "warn";
}

function badgeClass(status: string): string {
  if (status === "pass") return "badge-pass";
  if (status === "fail") return "badge-fail";
  return "badge-warn";
}

function ResultCard({ result, rank }: { result: PresentedResult; rank: number }) {
  return (
    <div className="card">
      <div className="badge badge-warn" style={{ marginBottom: 6 }}>
        {rank}순위 트랙
      </div>
      <div className={`headline ${headlineClass(result.headline)}`}>{result.headline}</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7570" }}>{result.trackLabel}</p>

      {result.checklist.map((c, i) => (
        <div className="checklist-item" key={i}>
          <div>
            <div>{c.label}</div>
            {c.detail && <div className="detail">{c.detail}</div>}
          </div>
          <span className={`badge ${badgeClass(c.status)}`}>
            {c.status === "pass" ? "충족" : c.status === "fail" ? "미충족" : c.status === "unknown" ? "정보 부족" : "확인 필요"}
          </span>
        </div>
      ))}

      {result.score && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <div className="row" style={{ alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "#6b7570" }}>예상 배점</span>
            <span className="total-score" style={{ textAlign: "right" }}>
              {result.score.total}점
            </span>
          </div>
          {result.score.hasUnknown && (
            <p className="hint">일부 항목이 미입력 상태라 실제보다 낮게 계산됐을 수 있어요.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Result({ state, goTo, onRestart }: Props) {
  const program = state.doc?.program;
  const medianIncomeTable = state.doc?.medianIncomeTable;

  const evaluation = useMemo(() => {
    if (!program || !isCompleteBaseProfile(state.base)) return null;
    const profile: UserProfile = { base: state.base, detail: state.detail };
    const tracks = evaluateProgram(profile, program, medianIncomeTable ? [medianIncomeTable] : [], {
      desiredAreaM2: state.desiredAreaM2,
      desiredSupplyMethod: state.desiredSupplyMethod,
    });
    const score = computeScore(profile, program, { asOfDate: program.noticeDate });

    // area-range/supply-method 조건이 fail이면(=희망하지 않은 트랙) 화면에서 제외 —
    // 사용자가 고른 유형과 무관한 트랙까지 보여주면 오히려 헷갈린다.
    const matching = tracks
      .filter((t: TrackEvaluation) =>
        t.conditionResults.every((c) => !(c.status === "fail" && (c.condition.type === "area-range" || c.condition.type === "supply-method"))),
      )
      .sort((a, b) => a.rank - b.rank);

    const presented = matching.map((t) => ({
      rank: t.rank,
      result: presentTrackResult(t, score, { desiredAreaM2: state.desiredAreaM2 }),
    }));

    return { presented, hasScoreInput: !!state.detail.birthDate };
  }, [program, medianIncomeTable, state.base, state.detail, state.desiredAreaM2, state.desiredSupplyMethod]);

  if (!program || !evaluation) {
    return (
      <div>
        <h1>결과를 계산할 수 없어요</h1>
        <p className="lead">입력이 완료되지 않았어요. 처음부터 다시 시도해주세요.</p>
        <button className="btn btn-primary" onClick={onRestart}>
          처음으로
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>{program.title}</h1>
      <p className="lead">
        희망하신 유형({state.desiredSupplyMethod} · {state.desiredAreaM2}㎡ 기준)의 순위별 신청 가능 여부예요.
      </p>

      {evaluation.presented.length === 0 && (
        <div className="card">
          <p className="hint">해당 유형에 맞는 트랙을 찾지 못했어요.</p>
        </div>
      )}

      {evaluation.presented.map(({ rank, result }, i) => (
        <ResultCard key={i} result={result} rank={rank} />
      ))}

      {!evaluation.hasScoreInput && (
        <button className="btn btn-secondary" onClick={() => goTo("score-detail")}>
          배점 세부정보 입력하고 더 정확한 점수 보기
        </button>
      )}
      {evaluation.hasScoreInput && (
        <button className="btn btn-secondary" onClick={() => goTo("score-detail")}>
          배점 세부정보 수정하기
        </button>
      )}

      <p className="disclaimer">
        이 결과는 입력하신 정보 기준의 예비 추정치이며 법적 효력이 없습니다. 소득·자산 등
        실제 자격은 서류심사 시 공적자료로 최종 확인되며, 신청 전 반드시 공고문 원문과
        청약홈에서 다시 확인하세요.
      </p>
      <button className="btn btn-ghost" onClick={onRestart}>
        처음부터 다시하기
      </button>
    </div>
  );
}
