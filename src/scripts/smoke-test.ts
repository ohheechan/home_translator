import { evaluateProgram } from "../engine/eligibility";
import { computeScore, type RubricScoreResult } from "../engine/scoring";
import { presentTrackResult } from "../engine/present";
import { shJangiJeonse51 } from "../data/sh-jangi-jeonse-51";
import { medianIncome2026 } from "../data/median-income-2026";
import { sampleProfile } from "../data/sample-profile";
import type { UserProfile } from "../types/profile";

function runScore(label: string, profile: UserProfile) {
  console.log(`\n--- 배점: ${label} ---`);
  const result = computeScore(profile, shJangiJeonse51);
  if ("status" in result) {
    console.log(`  no-rubric: ${result.note}`);
    return;
  }
  const r = result as RubricScoreResult;
  console.log(`  rubric=${r.rubricId} subtotal=${r.subtotal} penalty=${r.penaltyTotal} total=${r.total} hasUnknown=${r.hasUnknown}`);
  for (const i of [...r.items, ...r.penalties]) {
    console.log(`    [${i.status.padEnd(13)}] ${i.points >= 0 ? "+" : ""}${i.points}  ${i.criterion}${i.note ? " — " + i.note : ""}`);
  }
}

function run(label: string, profile: UserProfile, ctx: Parameters<typeof evaluateProgram>[3] = {}) {
  console.log(`\n=== ${label} ===`);
  const results = evaluateProgram(profile, shJangiJeonse51, [medianIncome2026], ctx);
  for (const r of results) {
    console.log(
      `${r.status.padEnd(13)} rank${r.rank}  ${r.label}` +
        (r.income.status !== "pass" ? `  [income:${r.income.status}${r.income.note ? " " + r.income.note : ""}]` : "") +
        (r.asset.status !== "pass" ? `  [asset:${r.asset.status}${r.asset.note ? " " + r.asset.note : ""}]` : ""),
    );
    const bad = r.conditionResults.filter((c) => c.status !== "pass");
    for (const c of bad) {
      console.log(`    - ${c.condition.type}: ${c.status}${c.note ? " — " + c.note : ""}`);
    }
  }
}

// 1) 샘플 프로필 그대로 (희망 면적 미지정 — 대부분 needs-review로 나와야 정상)
run("sample profile, no ctx", sampleProfile);

// 2) 희망 면적 55㎡(공사건설형)까지 지정 — 소득/자산이 낮으므로 60㎡이하 트랙 다수가 eligible이어야 함
run("sample profile, area 55㎡ 공사건설형", sampleProfile, {
  desiredAreaM2: 55,
  desiredSupplyMethod: "공사건설형",
});

// 3) 소득을 기준 초과로 올려서 income:fail 이 실제로 뜨는지 확인
const highIncomeProfile: UserProfile = {
  ...sampleProfile,
  base: { ...sampleProfile.base, householdMonthlyIncomeWon: 50_000_000 },
};
run("high income (should fail income)", highIncomeProfile, { desiredAreaM2: 55, desiredSupplyMethod: "공사건설형" });

// 4) 청약통장 미가입 — savings-account 조건에서 fail 떠야 함
const noAccountProfile: UserProfile = {
  ...sampleProfile,
  base: { ...sampleProfile.base, accountType: "없음", installments: undefined, joinedOn: undefined },
};
run("no savings account", noAccountProfile, { desiredAreaM2: 55, desiredSupplyMethod: "공사건설형" });

// 5) 배점 계산 — sampleProfile은 detail이 꽉 차 있으니 computed 위주로 나와야 함
runScore("sample profile (detail 있음)", sampleProfile);

// 6) detail이 아예 없으면 전 항목이 unknown이어야 함(0점으로 조용히 뭉개면 안 됨)
const noDetailProfile: UserProfile = { base: sampleProfile.base };
runScore("no detail at all", noDetailProfile);

// 7) 만30세 미만 미혼 — 무주택기간 항목이 not-applicable(0점)로 나와야 하고,
//    "3년 미만=1점" 구간과 섞이면 안 됨
const youngSingleProfile: UserProfile = {
  base: { ...sampleProfile.base, maritalStatus: "미혼" },
  detail: { ...sampleProfile.detail, birthDate: "2000-01-01" },
};
runScore("만30세 미만 미혼(무주택기간 0점이어야 함)", youngSingleProfile);

// 8) 주거약자형 대상 — sr-jugeoyakja 배점표로 자동 전환되는지, 특별자격 매칭이 되는지 확인
const accessibleProfile: UserProfile = {
  base: { ...sampleProfile.base, accessibleHousingTarget: true },
  detail: { ...sampleProfile.detail, specialCategories: ["차상위계층", "장애정도심하지않음"] },
};
runScore("주거약자형 대상(sr-jugeoyakja로 전환 + 특별자격 매칭)", accessibleProfile);

// 9) 과거 임대차계약 이력 있음 — 감점이 실제로 적용되는지
const recontractProfile: UserProfile = {
  base: sampleProfile.base,
  detail: {
    ...sampleProfile.detail,
    priorLongTermLeaseHistory: { hasHistory: true, contractedOn: "2025-01-01" },
  },
};
runScore("과거 임대차계약 이력 있음(감점 적용 확인)", recontractProfile);

// 10) Step 7 — 화면용 포맷팅. 55㎡ 공사건설형에서 eligible로 나온 트랙 하나를 골라
//     presentTrackResult에 넣어보고, 사람이 읽는 문장/만원 단위/85㎡ 배타항목 필터링이
//     실제로 잘 나오는지 확인한다.
console.log("\n=== Step 7: presentTrackResult ===");
const tracks55 = evaluateProgram(sampleProfile, shJangiJeonse51, [medianIncome2026], {
  desiredAreaM2: 55,
  desiredSupplyMethod: "공사건설형",
});
const eligibleTrack = tracks55.find((t) => t.status === "eligible")!;
const scoreForSample = computeScore(sampleProfile, shJangiJeonse51);
const presented = presentTrackResult(eligibleTrack, scoreForSample, { desiredAreaM2: 55 });
console.log(JSON.stringify(presented, null, 2));
