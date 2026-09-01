/**
 * Upload.tsx의 handleUpload와 "공고 둘러보기"에서 가져온 PDF를 분석하는 흐름이
 * 완전히 같아서(base64 → /api/extract → parseShJangiJeonse → classify) 공유
 * 함수로 뽑았다. 호출부(화면)는 결과를 어떻게 WizardState에 반영할지만 결정한다.
 */
import type { Step, WizardState } from "../app/wizard/types";
import type { PdfExtraction } from "./types";
import { parseShJangiJeonse } from "./sh-jangi-jeonse";
import { classifyShJangiJeonseParse } from "./classify";
import { extractGenericMetadata } from "./generic-metadata";

export interface AnalyzePdfResult {
  doc: WizardState["doc"];
  nextStep: Step;
}

export async function analyzePdfBase64(pdfBase64: string): Promise<AnalyzePdfResult> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64 }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "PDF 추출에 실패했습니다.");
  }
  const pdf = json as PdfExtraction;

  const { program, medianIncomeTable, warnings } = parseShJangiJeonse(pdf);
  const { tier, reasons } = classifyShJangiJeonseParse(program, warnings);

  if (tier === "A") {
    return {
      nextStep: "area-select",
      doc: {
        tier,
        program,
        medianIncomeTable: medianIncomeTable ?? null,
        parseWarnings: warnings,
        tierReasons: reasons,
        genericMetadata: null,
      },
    };
  }

  if (tier === "B") {
    return {
      nextStep: "tier-b",
      doc: {
        tier,
        program,
        medianIncomeTable: medianIncomeTable ?? null,
        parseWarnings: warnings,
        tierReasons: reasons,
        genericMetadata: extractGenericMetadata(pdf),
      },
    };
  }

  return {
    nextStep: "tier-c",
    doc: {
      tier,
      program: null,
      medianIncomeTable: null,
      parseWarnings: warnings,
      tierReasons: reasons,
      genericMetadata: extractGenericMetadata(pdf),
    },
  };
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
