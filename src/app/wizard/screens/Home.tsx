export default function Home({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <h1>내가 이 청약, 신청할 수 있을까?</h1>
      <p className="lead">
        SH 장기전세주택 입주자모집공고문(PDF)을 업로드하면 소득·자산·청약통장 정보로
        신청 가능 여부와 예상 점수를 미리 확인할 수 있어요.
      </p>
      <div className="card">
        <h2>이렇게 진행돼요</h2>
        <ol style={{ paddingLeft: 18, fontSize: 14, color: "#3a423e", lineHeight: 1.9 }}>
          <li>공고문 PDF 업로드</li>
          <li>소득·자산 / 청약통장 / 거주·가구 정보 입력</li>
          <li>신청 가능 여부 및 예상 점수 확인</li>
        </ol>
      </div>
      <button className="btn btn-primary" onClick={onStart}>
        시작하기
      </button>
      <p className="disclaimer">
        이 서비스는 참고용 예비 추정 도구입니다. 법적 효력이 없으며, 실제 자격은 서류심사
        시 공적자료로 최종 확인됩니다.
      </p>
    </div>
  );
}
