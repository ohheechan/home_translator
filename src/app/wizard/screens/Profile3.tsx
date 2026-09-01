"use client";

import { useState } from "react";
import type { Step, WizardState } from "../types";
import type { ResidenceHouseholdProfile } from "../../../types/profile";
import { SEOUL_DISTRICTS } from "../seoul-districts";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

const OWNERSHIP: ResidenceHouseholdProfile["housingOwnership"][] = ["무주택세대구성원", "1주택자", "2주택 이상"];
const MARITAL: ResidenceHouseholdProfile["maritalStatus"][] = ["미혼", "예비신혼", "기혼"];

export default function Profile3({ state, update, goTo }: Props) {
  const b = state.base;
  const [district, setDistrict] = useState(b.residenceDistrict ?? "");
  const [ownership, setOwnership] = useState<ResidenceHouseholdProfile["housingOwnership"] | undefined>(b.housingOwnership);
  const [accessibleTarget, setAccessibleTarget] = useState<boolean | undefined>(b.accessibleHousingTarget);
  const [maritalStatus, setMaritalStatus] = useState<ResidenceHouseholdProfile["maritalStatus"] | undefined>(b.maritalStatus);

  const valid = district !== "" && ownership != null && accessibleTarget != null && maritalStatus != null;

  function handleNext() {
    if (!valid) return;
    update({
      base: {
        ...state.base,
        residenceDistrict: district,
        housingOwnership: ownership!,
        accessibleHousingTarget: accessibleTarget!,
        maritalStatus: maritalStatus!,
      },
    });
    goTo("result");
  }

  return (
    <div>
      <h1>거주·가구 정보</h1>
      <div className="card">
        <label>현재 거주 자치구</label>
        <select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">선택해주세요</option>
          {SEOUL_DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label>주택 소유 현황</label>
        <div className="chips">
          {OWNERSHIP.map((o) => (
            <button key={o} type="button" className={`chip ${ownership === o ? "selected" : ""}`} onClick={() => setOwnership(o)}>
              {o}
            </button>
          ))}
        </div>

        <label>주거약자형 대상 여부</label>
        <div className="chips">
          <button type="button" className={`chip ${accessibleTarget === true ? "selected" : ""}`} onClick={() => setAccessibleTarget(true)}>
            대상
          </button>
          <button type="button" className={`chip ${accessibleTarget === false ? "selected" : ""}`} onClick={() => setAccessibleTarget(false)}>
            대상 아님
          </button>
        </div>

        <label>혼인 상태</label>
        <div className="chips">
          {MARITAL.map((m) => (
            <button key={m} type="button" className={`chip ${maritalStatus === m ? "selected" : ""}`} onClick={() => setMaritalStatus(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" disabled={!valid} onClick={handleNext}>
        결과 보기
      </button>
    </div>
  );
}
