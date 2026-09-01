"use client";

import { useState } from "react";
import type { Step, WizardState } from "../types";
import type { SavingsAccountProfile } from "../../../types/profile";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

const ACCOUNT_TYPES: SavingsAccountProfile["accountType"][] = ["청약저축", "청약예금", "청약종합저축", "없음"];

export default function Profile2({ state, update, goTo }: Props) {
  const b = state.base;
  const [accountType, setAccountType] = useState<SavingsAccountProfile["accountType"] | undefined>(b.accountType);
  const [joinedOn, setJoinedOn] = useState(b.joinedOn ?? "");
  const [installments, setInstallments] = useState(b.installments?.toString() ?? "");

  const needsDetail = accountType && accountType !== "없음";
  const valid = accountType != null && (!needsDetail || (joinedOn !== "" && installments !== ""));

  function handleNext() {
    if (!valid) return;
    update({
      base: {
        ...state.base,
        accountType: accountType!,
        joinedOn: needsDetail ? joinedOn : undefined,
        installments: needsDetail ? Number(installments) : undefined,
      },
    });
    goTo("profile3");
  }

  return (
    <div>
      <h1>청약통장 정보</h1>
      <p className="lead">가입 여부와 종류에 따라 신청 가능한 순위가 달라져요.</p>
      <div className="card">
        <label>보유 통장 종류</label>
        <div className="chips">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t} type="button" className={`chip ${accountType === t ? "selected" : ""}`} onClick={() => setAccountType(t)}>
              {t}
            </button>
          ))}
        </div>

        {needsDetail && (
          <>
            <label>가입일</label>
            <input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />

            <label>약정 납입횟수</label>
            <input
              type="number"
              inputMode="numeric"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              placeholder="예: 48"
            />
            <p className="hint">정확한 납입횟수는 청약홈에서 확인할 수 있어요(중도 해지·연체 시 다를 수 있어요).</p>
          </>
        )}
      </div>
      <button className="btn btn-primary" disabled={!valid} onClick={handleNext}>
        다음
      </button>
    </div>
  );
}
