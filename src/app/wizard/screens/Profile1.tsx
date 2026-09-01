"use client";

import { useState } from "react";
import type { Step, WizardState } from "../types";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

function wonToMan(won: number | undefined): string {
  if (won == null) return "";
  return String(Math.round(won / 10_000));
}

export default function Profile1({ state, update, goTo }: Props) {
  const b = state.base;
  const [incomeMan, setIncomeMan] = useState(wonToMan(b.householdMonthlyIncomeWon));
  const [householdSize, setHouseholdSize] = useState(b.householdSize?.toString() ?? "");
  const [dualIncome, setDualIncome] = useState<boolean | undefined>(b.dualIncome);
  const [assetMan, setAssetMan] = useState(wonToMan(b.totalAssetWon));
  const [vehicleMan, setVehicleMan] = useState(wonToMan(b.vehicleValueWon));

  const valid =
    incomeMan !== "" && householdSize !== "" && dualIncome != null && assetMan !== "" && vehicleMan !== "";

  function handleNext() {
    if (!valid) return;
    update({
      base: {
        ...state.base,
        householdMonthlyIncomeWon: Number(incomeMan) * 10_000,
        householdSize: Number(householdSize),
        dualIncome: dualIncome!,
        totalAssetWon: Number(assetMan) * 10_000,
        vehicleValueWon: Number(vehicleMan) * 10_000,
      },
    });
    goTo("profile2");
  }

  return (
    <div>
      <h1>소득·자산 정보</h1>
      <p className="lead">가구원 전체를 합산한 금액을 입력해주세요(본인 소득만이 아니에요).</p>
      <div className="card">
        <label>가구 월 소득 (세전, 만원)</label>
        <input type="number" inputMode="numeric" value={incomeMan} onChange={(e) => setIncomeMan(e.target.value)} placeholder="예: 612" />

        <label>가구원 수</label>
        <input type="number" inputMode="numeric" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} placeholder="예: 3" />

        <label>맞벌이 여부</label>
        <div className="chips">
          <button type="button" className={`chip ${dualIncome === true ? "selected" : ""}`} onClick={() => setDualIncome(true)}>
            맞벌이
          </button>
          <button type="button" className={`chip ${dualIncome === false ? "selected" : ""}`} onClick={() => setDualIncome(false)}>
            외벌이/단독가구
          </button>
        </div>

        <div className="row">
          <div>
            <label>총자산 (만원)</label>
            <input type="number" inputMode="numeric" value={assetMan} onChange={(e) => setAssetMan(e.target.value)} placeholder="예: 15000" />
          </div>
          <div>
            <label>자동차가액 (만원)</label>
            <input type="number" inputMode="numeric" value={vehicleMan} onChange={(e) => setVehicleMan(e.target.value)} placeholder="예: 0" />
          </div>
        </div>
        <p className="hint">정확한 총자산·자동차가액은 청약홈 자산 조회 서비스에서 확인할 수 있어요.</p>
      </div>
      <button className="btn btn-primary" disabled={!valid} onClick={handleNext}>
        다음
      </button>
    </div>
  );
}
