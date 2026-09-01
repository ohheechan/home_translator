"""
Vercel Python 서버리스 함수: 업로드된 PDF -> 페이지별 텍스트+표 JSON.

scripts-py/pdf_to_text.py와 같은 추출 로직(pdfplumber)을 HTTP 엔드포인트로 감쌌다 —
"원자료 추출"만 여기서 하고, "이해"(구조화)는 브라우저에서 실행되는 TS 파서
(src/parser/sh-jangi-jeonse.ts)가 한다. 이 분리를 유지하는 이유:
- pdfplumber 같은 PDF 표 추출은 브라우저에서 돌릴 수 없어 서버리스 함수가 필요하지만,
- 그 다음 "섹션/표 헤더를 앵커로 구조화"하는 로직은 순수 TS라 굳이 서버 왕복 없이
  클라이언트에서 바로 실행할 수 있고, 엔진(eligibility/scoring)과 같은 코드베이스를
  공유할 수 있다.

요청: POST, JSON body { "pdfBase64": "<base64 인코딩된 PDF>" }
응답: { "pageCount": N, "pages": [{ "pageNumber", "text", "tables" }, ...] }
      실패 시 { "error": "..." } (4xx/5xx)

주의(알려진 제약): Vercel 서버리스 함수의 기본 요청 본문 크기 제한(약 4.5MB)에 걸릴 수
있다. base64 인코딩은 원본 대비 약 33% 커지므로, 실질적으로 3MB대 PDF부터 위험하다.
스캔 이미지가 많은 공고문은 이 한도를 넘을 수 있음 — 넘으면 명확한 에러 메시지로
안내한다(조용히 실패하지 않음).
"""

import json
import base64
from http.server import BaseHTTPRequestHandler

import pdfplumber
import io


def extract(pdf_bytes: bytes) -> dict:
    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            try:
                tables = page.extract_tables()
            except Exception:
                tables = []
            pages.append({"pageNumber": i + 1, "text": text, "tables": tables})
    return {"pageCount": len(pages), "pages": pages}


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                self._send_json(400, {"error": "요청 본문이 비어 있습니다."})
                return
            raw = self.rfile.read(length)
            data = json.loads(raw)
            pdf_b64 = data.get("pdfBase64")
            if not pdf_b64:
                self._send_json(400, {"error": "pdfBase64 필드가 없습니다."})
                return
            pdf_bytes = base64.b64decode(pdf_b64)
            result = extract(pdf_bytes)
            self._send_json(200, result)
        except Exception as e:  # noqa: BLE001 — 사용자에게 원인을 그대로 보여줘야 디버깅 가능
            self._send_json(500, {"error": f"PDF 추출 중 오류가 발생했습니다: {e}"})
