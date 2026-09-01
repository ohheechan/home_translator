"use client";

import { useEffect, useState } from "react";
import type { Step, WizardState } from "./types";
import { initialWizardState } from "./types";
import { analyzePdfBase64 } from "../../parser/analyze-pdf";
import Home from "./screens/Home";
import Upload from "./screens/Upload";
import TierB from "./screens/TierB";
import TierC from "./screens/TierC";
import AreaSelect from "./screens/AreaSelect";
import Profile1 from "./screens/Profile1";
import Profile2 from "./screens/Profile2";
import Profile3 from "./screens/Profile3";
import ScoreDetailScreen from "./screens/ScoreDetailScreen";
import Result from "./screens/Result";

const MAIN_FLOW_STEPS: Step[] = ["upload", "area-select", "profile1", "profile2", "profile3", "result"];

export default function Wizard() {
  const [state, setState] = useState<WizardState>(initialWizardState);

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function goTo(step: Step) {
    setState((prev) => ({ ...prev, step, errorMessage: null }));
  }

  function reset() {
    setState(initialWizardState);
  }

  // "공고 둘러보기"에서 "이 공고문으로 분석 시작하기"를 누르면 여기로 돌아온다 —
  // 사용자가 PDF를 다시 손으로 고를 필요 없이 자동으로 분석까지 이어간다.
  useEffect(() => {
    const pending = sessionStorage.getItem("importPdfBase64");
    if (!pending) return;
    sessionStorage.removeItem("importPdfBase64");
    sessionStorage.removeItem("importPdfName");
    setState((prev) => ({ ...prev, step: "upload", loading: true, errorMessage: null }));
    analyzePdfBase64(pending)
      .then(({ doc, nextStep }) => {
        setState((prev) => ({ ...prev, loading: false, doc, step: nextStep }));
      })
      .catch((e: unknown) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          errorMessage: e instanceof Error ? e.message : "공고문을 분석하지 못했어요.",
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressIndex = MAIN_FLOW_STEPS.indexOf(state.step);

  return (
    <>
      <div className="topbar">청약번역기</div>
      {progressIndex >= 0 && (
        <div className="progress">
          {MAIN_FLOW_STEPS.map((s, i) => (
            <div key={s} className={`seg ${i <= progressIndex ? "done" : ""}`} />
          ))}
        </div>
      )}
      <div className="screen">
        {state.step === "home" && <Home onStart={() => goTo("upload")} />}
        {state.step === "upload" && <Upload state={state} update={update} goTo={goTo} />}
        {state.step === "tier-b" && <TierB state={state} onRestart={reset} />}
        {state.step === "tier-c" && <TierC state={state} onRestart={reset} />}
        {state.step === "area-select" && <AreaSelect state={state} update={update} goTo={goTo} />}
        {state.step === "profile1" && <Profile1 state={state} update={update} goTo={goTo} />}
        {state.step === "profile2" && <Profile2 state={state} update={update} goTo={goTo} />}
        {state.step === "profile3" && <Profile3 state={state} update={update} goTo={goTo} />}
        {state.step === "score-detail" && <ScoreDetailScreen state={state} update={update} goTo={goTo} />}
        {state.step === "result" && <Result state={state} goTo={goTo} onRestart={reset} />}
      </div>
    </>
  );
}
