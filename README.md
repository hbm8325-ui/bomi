# Half-Day 면접 연습실 (비공식)

혼자서 실전처럼 돌려보는 두 개의 연습 웹앱입니다. 특정 회사·기관과 무관한 **개인 연습용 비공식 프로젝트**이며, 실제 전형과는 관계가 없습니다.

- 🌐 배포 사이트: <https://hbm8325-ui.github.io/bomi/>
  - 🗣️ 4단계 인문학 토의 연습실 → <https://hbm8325-ui.github.io/bomi/discussion/>
  - 🛠️ AI 문제해결 PT 연습실 → <https://hbm8325-ui.github.io/bomi/ai-pt/>

## 무엇을 연습하나

### 🗣️ 4단계 인문학 토의 연습실 — `discussion-app/`

- 5분 준비 → 10분 1차 토의 → 15분 추가 관점·2차 토의 → 10분 공동 결과물
- 28개 인문학 주제, 단계별 모범 가이드, 실제 발언에 근거한 피드백과 꼬리질문
- 세 명의 AI 팀원과 함께 진행하며, 내 타이핑/음성 발언을 기준으로 평가합니다.

### 🛠️ AI 문제해결 PT 연습실 — `ai-pt-app/`

- 입문 6 · 보통 6 · 심화 4, 총 16세트의 문제 상황
- 35분 답안 작성, 자료 기반 질문 설계, 제출 후 채점과 압박 꼬리질문 리허설
- 세트별 모범답안과 외부 AI형 응답 예시 포함

## 동작 방식

- 두 앱 모두 **정적 사이트**입니다. 빌드 결과물만으로 동작하며 서버가 없습니다.
- Gemini API 키를 직접 넣으면 AI가 답하고, 키가 없으면 데모(모의) 모드로 동작합니다.
- 연습 기록과 API 키는 **사용 중인 기기 브라우저의 localStorage에만** 저장되며, 어디로도 전송·수집되지 않습니다. (키는 Google Gemini API 호출에만 쓰입니다.)

## 로컬에서 실행

```bash
cd discussion-app && npm ci && npm run dev     # 토의 연습실
cd ai-pt-app      && npm ci && npm run dev     # PT 연습실
```

빌드:

```bash
npm run build   # 산출물 → dist/
```

각 앱의 `vite.config.ts`는 `base: './'`이라 어떤 하위 경로에 올려도 그대로 동작합니다.

## 배포 구조

- `main` 브랜치: 앱 소스
- `gh-pages` 브랜치: 정적 배포본 (GitHub Pages → Deploy from a branch → `gh-pages` / root)
  - `/` 랜딩, `/discussion/`, `/ai-pt/`
  - `.nojekyll`로 Jekyll 처리를 끕니다.

## 개인정보

이 저장소에는 개인 식별 정보(이름·연락처·소속·계정)가 포함되지 않습니다. `discussion-app/tests/privacy.test.ts`가 소스 전체를 검사해 위반 시 테스트가 실패합니다.
