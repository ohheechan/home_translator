"use client";

import { useState } from "react";
import type { Step, WizardState } from "../types";
import type { PdfExtraction } from "../../../parser/types";
import { parseShJangiJeonse } from "../../../parser/sh-jangi-jeonse";
import { classifyShJangiJeonseParse } from "../../../parser/classify";
import { extractGenericMetadata } from "../../../parser/generic-metadata";

interface Props {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  goTo: (s: Step) => void;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — /api/extract의 4.5MB 요청 본문 한도를
// 넘는 파일은 어차피 서버에서 명확히 실패하지만, 그 전에 사용자에게 더 빨리 안내한다.

function fileToBase64(file: File): Promise<string> {
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

export default function Upload({ state, update, goTo }: Props) {
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      update({ errorMessage: "파일이 너무 큽니다(15MB 이하 PDF만 업로드할 수 있어요)." });
      return;
    }
    update({ loading: true, errorMessage: null });
    try {
      const pdfBase64 = await fileToBase64(file);
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
        update({
          loading: false,
          doc: {
            tier,
            program,
            medianIncomeTable: medianIncomeTable ?? null,
            parseWarnings: warnings,
            tierReasons: reasons,
            genericMetadata: null,
          },
        });
        goTo("area-select");
        return;
      }

      if (tier === "B") {
        update({
          loading: false,
          doc: {
            tier,
            program,
            medianIncomeTable: medianIncomeTable ?? null,
            parseWarnings: warnings,
            tierReasons: reasons,
            genericMetadata: extractGenericMetadata(pdf),
          },
        });
        goTo("tier-b");
        return;
      }

      // tier === "C"
      update({
        loading: false,
        doc: {
          tier,
          program: null,
          medianIncomeTable: null,
          parseWarnings: warnings,
          tierReasons: reasons,
          genericMetadata: extractGenericMetadata(pdf),
        },
      });
      goTo("tier-c");
    } catch (e) {
      update({ loading: false, errorMessage: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다." });
    }
  }

  return (
    <div>
      <h1>공고문 업로드</h1>
      <p className="lead">
        지금은 <strong>SH 장기전세주택</strong> 입주자모집공고문 PDF를 가장 정확하게
        처리해요. 다른 기관·상품의 공고문도 업로드해볼 수 있지만, 지원하지 않는 서식이면
        신청 가능 여부는 계산하지 않고 기본 정보만 보여드려요.
      </p>
      <div className="card">
        {state.errorMessage && <div className="error-box">{state.errorMessage}</div>}
        <label>공고문 PDF</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="hint">청약홈 또는 SH공사 홈페이지에서 받은 원본 PDF를 그대로 올려주세요.</p>
      </div>
      {state.loading ? (
        <div className="spinner-text">공고문을 분석하고 있어요… (페이지가 많으면 시간이 조금 걸려요)</div>
      ) : (
        <button className="btn btn-primary" disabled={!file} onClick={handleUpload}>
          분석 시작
        </button>
      )}
    </div>
  );
}
