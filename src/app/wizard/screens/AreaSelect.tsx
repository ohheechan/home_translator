"use client";

import { useMemo, useState } from "react";
import type { Step, WizardState } from "../types";
import type { RuleCondition } from "../../../types/program";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

type AreaCondition = Extract<RuleCondition, { type: "area-range" }>;

function formatAreaRange(c: AreaCondition): string {
  if (c.minM2 != null && c.maxM2 != null) {
    return `${c.minM2}㎡${c.minExclusive ? "초과" : "이상"} ${c.maxM2}㎡${c.maxExclusive ? "미만" : "이하"}`;
  }
  if (c.maxM2 != null) return `${c.maxM2}㎡${c.maxExclusive ? "미만" : "이하"}`;
  if (c.minM2 != null) return `${c.minM2}㎡${c.minExclusive ? "초과" : "이상"}`;
  return "면적 미상";
}

/** 사용자에게는 라벨(예: "60㎡초과 85㎡이하")만 보여주고, 판정 엔진에는 그 구간 안에
 *  들어가는 대표 숫자 하나를 넘긴다 — RuleCondition.area-range는 범위 비교라 특정 값이
 *  필요하다(engine/eligibility.ts evaluateCondition 참고). */
function representativeArea(c: AreaCondition): number {
  const minB = c.minM2 != null ? c.minM2 + (c.minExclusive ? 0.5 : 0) : undefined;
  const maxB = c.maxM2 != null ? c.maxM2 - (c.maxExclusive ? 0.5 : 0) : undefined;
  if (minB != null && maxB != null) return Math.round(((minB + maxB) / 2) * 10) / 10;
  if (minB != null) return minB + 1;
  if (maxB != null) return maxB;
  return 60;
}

export default function AreaSelect({ state, update, goTo }: Props) {
  const program = state.doc?.program;
  const [supplyMethod, setSupplyMethod] = useState<string | undefined>(state.desiredSupplyMethod);
  const [areaKey, setAreaKey] = useState<string | undefined>(undefined);

  const supplyMethods = useMemo(() => {
    if (!program) return [];
    const set = new Set<string>();
    for (const t of program.eligibilityTracks) {
      const c = t.conditions.find((c): c is Extract<RuleCondition, { type: "supply-method" }> => c.type === "supply-method");
      if (c) set.add(c.value);
    }
    return [...set];
  }, [program]);

  const areaOptions = useMemo(() => {
    if (!program || !supplyMethod) return [];
    const seen = new Map<string, AreaCondition>();
    for (const t of program.eligibilityTracks) {
      const sm = t.conditions.find((c): c is Extract<RuleCondition, { type: "supply-method" }> => c.type === "supply-method");
      if (sm?.value !== supplyMethod) continue;
      const area = t.conditions.find((c): c is AreaCondition => c.type === "area-range");
      if (!area) continue;
      const key = JSON.stringify(area);
      if (!seen.has(key)) seen.set(key, area);
    }
    return [...seen.entries()];
  }, [program, supplyMethod]);

  function handleNext() {
    const selected = areaOptions.find(([key]) => key === areaKey);
    if (!supplyMethod || !selected) return;
    update({ desiredSupplyMethod: supplyMethod, desiredAreaM2: representativeArea(selected[1]) });
    goTo("profile1");
  }

  return (
    <div>
      <h1>어떤 유형을 희망하세요?</h1>
      <p className="lead">공급방식과 희망 면적에 따라 신청 가능한 순위와 기준이 달라져요.</p>
      <div className="card">
        <label>공급방식</label>
        <div className="chips">
          {supplyMethods.map((sm) => (
            <button
              key={sm}
              type="button"
              className={`chip ${supplyMethod === sm ? "selected" : ""}`}
              onClick={() => {
                setSupplyMethod(sm);
                setAreaKey(undefined);
              }}
            >
              {sm}
            </button>
          ))}
        </div>

        {supplyMethod && (
          <>
            <label>희망 면적</label>
            <div className="chips">
              {areaOptions.map(([key, area]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip ${areaKey === key ? "selected" : ""}`}
                  onClick={() => setAreaKey(key)}
                >
                  {formatAreaRange(area)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button className="btn btn-primary" disabled={!supplyMethod || !areaKey} onClick={handleNext}>
        다음
      </button>
    </div>
  );
}
