# AI 문제해결 PT 시뮬레이터 (보건)

SK하이닉스 Half-Day `문제해결 PT` 연습용 웹앱. React 19 + TypeScript + Vite, BYOK Gemini.
PC 실행용 패키지는 `work/ai-pt-pc/`에서 만들고 `downloads/AI문제해결PT_PC실행용.zip`으로 배포합니다.

## 명령

```bash
npm install          # 최초 1회
npm run dev          # 개발 서버
npm run typecheck    # tsc --noEmit
npm run build        # dist/ 생성
npm test             # Vitest (scripts/run-tests.mjs 래퍼)
```

> `scripts/run-tests.mjs`는 이 샌드박스에 `/etc/hosts`가 없어 jsdom이 `localhost`를 못 찾는 문제를
> `scripts/localhost-dns-shim.cjs`로 우회합니다. 일반 PC에서는 그냥 vitest를 돌려도 됩니다.

## 구조

```
src/
  types.ts                     공용 타입
  data/scenarios/{s1..s16}.ts  내장 과제 16세트 (입문 6·보통 6·심화 4, 자료 2종·표·함정·모범답안)
  data/scenarios/index.ts      난이도 정렬·집계, 자료 직렬화, 수치 토큰 추출
  data/skeleton.ts             답안 뼈대 틀
  logic/gemini.ts              listModels·pickBestModel·generateText·generateJson·오류 매핑
  logic/prompts.ts             AI Agent 성향 프롬프트, 채점 스키마, 리허설·과제생성 프롬프트
  logic/coach.ts               넓은 요청/좁은 요청 판별 (연습 코치)
  logic/demo.ts                키 없이 동작하는 데모 응답·리허설 코칭
  logic/grade.ts               채점 JSON 정규화 + 로컬(데모) 채점
  logic/customScenario.ts      커스텀 과제 JSON 파서·localStorage CRUD
  logic/storage.ts             초안·채팅·메모·타이머·기록 저장
  components/                  Header, ProblemPanel, AnswerPanel, ChatPanel, ResourceViewer,
                               SettingsSheet, HistorySheet, ScenarioPickerSheet, ModelAnswerSheet,
                               AddScenarioSheet, FeedbackScreen, Sheet
tests/                         168 tests (16세트 무결성·모범답안·카운터·프롬프트·파서·저장·HTTP·jsdom 렌더)
scripts/                       run-tests.mjs, localhost-dns-shim.cjs
```

## 저장 키 (localStorage)

| 키 | 내용 |
| --- | --- |
| `aipt_settings_v1` | API 키·모델·코치 ON/OFF |
| `aipt_draft_<id>` / `aipt_chat_<id>` / `aipt_notes_<id>` / `aipt_timer_<id>` | 과제별 작성 상태 |
| `aipt_history_v1` | 연습 기록(채점 결과 포함) |
| `pt_custom_scenarios_v1` | 사용자가 추가한 과제 |

## PC 패키지 만들기

```bash
npm run build
rm -rf ../ai-pt-pc/AI문제해결PT_PC실행용/app && cp -r dist ../ai-pt-pc/AI문제해결PT_PC실행용/app
cd /workspace && python3 work/ai-pt-pc/build_zip.py
```

기본 포트는 **4174**(인문학 토론 앱 4173과 충돌 방지). 로컬 서버 여부는 `app/index.html`의
`AI-PT-APP` 표식으로 확인합니다.
