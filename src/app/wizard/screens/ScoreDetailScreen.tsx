"use client";

import { useState } from "react";
import type { Step, WizardState } from "../types";
import type { SpecialCategory } from "../../../types/profile";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

const SPECIAL_CATEGORIES: SpecialCategory[] = [
  "생계급여수급자",
  "의료급여수급자",
  "차상위계층",
  "장애정도심함",
  "장애정도심하지않음",
  "고령자",
  "노부모부양자",
  "2자녀이상가구",
  "국가유공자등",
];

export default function ScoreDetailScreen({ state, update, goTo }: Props) {
  const d = state.detail;
  const [birthDate, setBirthDate] = useState(d.birthDate ?? "");
  const [seoulLastMoveInDate, setSeoulLastMoveInDate] = useState(d.seoulLastMoveInDate ?? "");
  const [marriedBeforeAge30, setMarriedBeforeAge30] = useState<boolean | undefined>(d.homelessPeriodBasis?.marriedBeforeAge30);
  const [marriageRegisteredOn, setMarriageRegisteredOn] = useState(d.homelessPeriodBasis?.marriageRegisteredOn ?? "");
  const [previouslyOwnedHome, setPreviouslyOwnedHome] = useState<boolean | undefined>(d.homelessPeriodBasis?.previouslyOwnedHome);
  const [homeDisposedOn, setHomeDisposedOn] = useState(d.homelessPeriodBasis?.homeDisposedOn ?? "");
  const [dependentsCount, setDependentsCount] = useState(d.dependentsCount?.toString() ?? "");
  const [minorChildrenCount, setMinorChildrenCount] = useState(d.minorChildrenCount?.toString() ?? "");
  const [childrenBornAfter20230328, setChildrenBornAfter20230328] = useState(
    d.newbornChildAdjustment?.childrenBornAfter20230328?.toString() ?? "",
  );
  const [hasMinorPre, setHasMinorPre] = useState<boolean | undefined>(d.newbornChildAdjustment?.hasMinorChildBornOnOrBefore20230327);
  const [specialCategories, setSpecialCategories] = useState<SpecialCategory[]>(d.specialCategories ?? []);
  const [hasPriorHistory, setHasPriorHistory] = useState<boolean | undefined>(d.priorLongTermLeaseHistory?.hasHistory);
  const [contractedOn, setContractedOn] = useState(d.priorLongTermLeaseHistory?.contractedOn ?? "");

  function toggleCategory(c: SpecialCategory) {
    setSpecialCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function handleSave() {
    update({
      detail: {
        birthDate: birthDate || undefined,
        seoulLastMoveInDate: seoulLastMoveInDate || undefined,
        homelessPeriodBasis:
          marriedBeforeAge30 != null || previouslyOwnedHome != null
            ? {
                marriedBeforeAge30: marriedBeforeAge30 ?? false,
                marriageRegisteredOn: marriedBeforeAge30 ? marriageRegisteredOn || undefined : undefined,
                previouslyOwnedHome: previouslyOwnedHome ?? false,
                homeDisposedOn: previouslyOwnedHome ? homeDisposedOn || undefined : undefined,
              }
            : undefined,
        dependentsCount: dependentsCount !== "" ? Number(dependentsCount) : undefined,
        minorChildrenCount: minorChildrenCount !== "" ? Number(minorChildrenCount) : undefined,
        newbornChildAdjustment:
          childrenBornAfter20230328 !== "" || hasMinorPre != null
            ? {
                childrenBornAfter20230328: childrenBornAfter20230328 !== "" ? Number(childrenBornAfter20230328) : 0,
                hasMinorChildBornOnOrBefore20230327: hasMinorPre ?? false,
              }
            : undefined,
        specialCategories,
        priorLongTermLeaseHistory:
          hasPriorHistory != null ? { hasHistory: hasPriorHistory, contractedOn: hasPriorHistory ? contractedOn || undefined : undefined } : undefined,
      },
    });
    goTo("result");
  }

  return (
    <div>
      <h1>배점 세부정보</h1>
      <p className="lead">전부 선택 입력이에요. 입력한 만큼 더 정확한 예상 점수를 볼 수 있어요.</p>

      <div className="card">
        <h2>기본 정보</h2>
        <label>생년월일</label>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <label>서울특별시 최종 전입일</label>
        <input type="date" value={seoulLastMoveInDate} onChange={(e) => setSeoulLastMoveInDate(e.target.value)} />
        <div className="row">
          <div>
            <label>부양가족 수</label>
            <input type="number" inputMode="numeric" value={dependentsCount} onChange={(e) => setDependentsCount(e.target.value)} />
          </div>
          <div>
            <label>미성년자녀 수</label>
            <input type="number" inputMode="numeric" value={minorChildrenCount} onChange={(e) => setMinorChildrenCount(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>무주택기간 산정</h2>
        <label>만30세 이전 혼인했나요?</label>
        <div className="chips">
          <button type="button" className={`chip ${marriedBeforeAge30 === true ? "selected" : ""}`} onClick={() => setMarriedBeforeAge30(true)}>예</button>
          <button type="button" className={`chip ${marriedBeforeAge30 === false ? "selected" : ""}`} onClick={() => setMarriedBeforeAge30(false)}>아니오</button>
        </div>
        {marriedBeforeAge30 && (
          <>
            <label>혼인신고일</label>
            <input type="date" value={marriageRegisteredOn} onChange={(e) => setMarriageRegisteredOn(e.target.value)} />
          </>
        )}
        <label>과거 주택을 소유했다가 처분한 적 있나요?</label>
        <div className="chips">
          <button type="button" className={`chip ${previouslyOwnedHome === true ? "selected" : ""}`} onClick={() => setPreviouslyOwnedHome(true)}>예</button>
          <button type="button" className={`chip ${previouslyOwnedHome === false ? "selected" : ""}`} onClick={() => setPreviouslyOwnedHome(false)}>아니오</button>
        </div>
        {previouslyOwnedHome && (
          <>
            <label>처분일</label>
            <input type="date" value={homeDisposedOn} onChange={(e) => setHomeDisposedOn(e.target.value)} />
          </>
        )}
      </div>

      <div className="card">
        <h2>출생자녀 가산</h2>
        <label>2023.3.28. 이후 출생(태아 포함) 자녀 수</label>
        <input type="number" inputMode="numeric" value={childrenBornAfter20230328} onChange={(e) => setChildrenBornAfter20230328(e.target.value)} />
        <label>2023.3.27. 이전 출생한 미성년자녀가 세대에 함께 있나요?</label>
        <div className="chips">
          <button type="button" className={`chip ${hasMinorPre === true ? "selected" : ""}`} onClick={() => setHasMinorPre(true)}>예</button>
          <button type="button" className={`chip ${hasMinorPre === false ? "selected" : ""}`} onClick={() => setHasMinorPre(false)}>아니오</button>
        </div>
      </div>

      <div className="card">
        <h2>특별자격</h2>
        <div className="chips">
          {SPECIAL_CATEGORIES.map((c) => (
            <button key={c} type="button" className={`chip ${specialCategories.includes(c) ? "selected" : ""}`} onClick={() => toggleCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>과거 장기전세주택 재계약 이력</h2>
        <div className="chips">
          <button type="button" className={`chip ${hasPriorHistory === true ? "selected" : ""}`} onClick={() => setHasPriorHistory(true)}>있음</button>
          <button type="button" className={`chip ${hasPriorHistory === false ? "selected" : ""}`} onClick={() => setHasPriorHistory(false)}>없음</button>
        </div>
        {hasPriorHistory && (
          <>
            <label>계약 시점</label>
            <input type="date" value={contractedOn} onChange={(e) => setContractedOn(e.target.value)} />
          </>
        )}
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        저장하고 결과 보기
      </button>
      <button className="btn btn-ghost" onClick={() => goTo("result")}>
        건너뛰기
      </button>
    </div>
  );
}
