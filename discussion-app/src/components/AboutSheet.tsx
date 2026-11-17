import { Sheet } from './Sheet'

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="이 앱에 대하여" subtitle="출처와 한계" onClose={onClose}>
      <div className="about-body">
        <h3>SK하이닉스 비공식 그룹 토의 연습 웹앱</h3>
        <p>
          인문학 주제 그룹 토의(Half-Day Step 4 Group Discussion)를 혼자 연습하려고 만든 개인용 도구입니다. 5·10·15·10분
          네 단계로 개인 의견 준비 → 1차 토의 → 추가 관점 확인·2차 토의 → 공동 결과물 작성까지 진행합니다. SK하이닉스와
          아무런 제휴가 없고, 실제 면접 문제·평가 기준·채용 결과와도 무관합니다. 주제와 모범 예시는 연습용으로 새로
          만든 것이며, AI 발언과 100점 피드백은 오류가 있을 수 있는 연습 결과입니다.
        </p>

        <h3>작동 방식</h3>
        <p>
          서버 없이 브라우저에서만 동작합니다. 내 Gemini API 키는 localStorage에 저장되고, 주제·대화·공동 결과물은 키와
          함께 구글 Gemini API로 직접 전송됩니다. 대화 기록과 결과물은 이 브라우저에만 남습니다. 음성 인식과 AI 목소리
          재생은 브라우저(Chrome·Safari)가 제공하는 기능이라 음성이 기기 밖에서 처리될 수 있습니다.
        </p>

        <h3>오픈소스 출처</h3>
        <p>
          이 앱은 MIT 라이선스로 공개된 오픈소스 프로젝트{' '}
          <a href="https://github.com/humanities-debate/humanities-debate" target="_blank" rel="noreferrer">
            humanities-debate
          </a>
          에서 영감을 받아, 그 공개 코드의 참가자 대화 규칙·사용자 지목 추적·평가 루브릭 구조를 참고해 브라우저용으로
          다시 만들었습니다. 28개 주제·추가 관점·모범 토의 예시·4단계 진행과 공동 결과물 기능은 그룹 토의 연습을 위해
          새로 작성했습니다.
        </p>
        <pre className="license-box">
{`MIT License
Copyright (c) 2026 Humanities Debate contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`}
        </pre>
        <p>
          원본 저장소의 비공개 코드나 별도 라이선스 파일은 가져오지 않았고, 공개된 MIT 부분만 참고해 새로 작성했습니다.
          이 앱의 코드는 개인 연습용입니다.
        </p>

        <h3>알려진 한계</h3>
        <ul>
          <li>음성 인식은 브라우저·네트워크 상태에 따라 끊길 수 있어 텍스트 입력을 항상 함께 제공합니다.</li>
          <li>무료 Gemini 키는 분당·일일 요청 한도가 있어 429 오류가 날 수 있습니다.</li>
          <li>실전 모드의 가림은 화면 표시일 뿐, 발언 자체를 지우지는 않습니다. 종료 후 전체가 공개됩니다.</li>
          <li>AI 목소리 재생은 브라우저 음성 합성 기능이라 기기·브라우저에 따라 목소리가 다르고 지원되지 않을 수 있습니다.</li>
          <li>4단계 초안·피드백은 토의 내용을 요약해 제안하는 것으로, 합의의 최종 판단은 사용자에게 있습니다.</li>
        </ul>
      </div>
    </Sheet>
  )
}
