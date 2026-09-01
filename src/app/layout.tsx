import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "청약번역기",
  description: "SH 장기전세주택 공고문을 업로드하면 내 신청 자격과 예상 점수를 확인할 수 있어요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
