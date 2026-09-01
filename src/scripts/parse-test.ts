import fs from "node:fs";
import { parseShJangiJeonse } from "../parser/sh-jangi-jeonse";
import type { PdfExtraction } from "../parser/types";

function run(label: string, jsonPath: string) {
  console.log(`\n=== ${label} (${jsonPath}) ===`);
  const pdf: PdfExtraction = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const { program, medianIncomeTable, warnings } = parseShJangiJeonse(pdf);

  console.log(`id=${program.id} title="${program.title}" noticeDate=${program.noticeDate}`);
  console.log(`\neligibilityTracks (${program.eligibilityTracks.length}개):`);
  for (const t of program.eligibilityTracks) {
    const condStr = t.conditions.map((c) => (c.type === "custom" ? `custom("${c.description}")` : JSON.stringify(c))).join(" | ");
    console.log(`  [${t.id}] ${t.label} income=${t.incomeThresholdIds?.join(",")} :: ${condStr}`);
  }
  console.log(`\nincomeThresholds (${program.incomeThresholds.length}개):`);
  for (const it of program.incomeThresholds) {
    console.log(`  [${it.id}] ${it.percentOfMedianIncome}% appliesWhen=${JSON.stringify(it.appliesWhen)}`);
  }
  console.log(`assetThresholds:`, JSON.stringify(program.assetThresholds, null, 2));
  console.log(`scoreRubrics 요약:`);
  for (const r of program.scoreRubrics) {
    console.log(`  [${r.id}] items=${r.items.length} penalties=${r.penalties?.length ?? 0}`);
    for (const item of r.items) {
      console.log(`    - ${item.criterion} (${item.metric.type}): ${item.tiers.map((t) => `${t.points}=${t.label}`).join(" / ")}`);
    }
    for (const p of r.penalties ?? []) {
      console.log(`    [penalty] ${p.criterion}: ${p.tiers.map((t) => `${t.points}=${t.label}`).join(" / ")}`);
    }
  }

  if (medianIncomeTable) {
    const byPercent = medianIncomeTable.byPercent;
    console.log(`medianIncomeTable: %구간 ${Object.keys(byPercent).length}개 —`, Object.keys(byPercent).sort((a, b) => +a - +b).join(","));
    console.log(`  70% 행:`, byPercent[70]);
    console.log(`  200% 행:`, byPercent[200]);
  }

  console.log(`\nwarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

run("49차", "api-explore/parsed/49.json");
run("50차", "api-explore/parsed/50.json");
