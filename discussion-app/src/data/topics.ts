import type { DebateTopic } from '../types'
import { techAndAiTopics } from './topicSets/tech-ai'
import { societyFairnessTopics } from './topicSets/society-fairness'
import { environmentFreedomTopics } from './topicSets/environment-freedom'
import { workSafetyTopics } from './topicSets/work-safety'

// 그룹 토의(합의·공동 결과물)에 맞는 연습용 주제만 모았습니다. 실제 기출 주제가 아닙니다.
export const practiceTopics: readonly DebateTopic[] = [
  ...techAndAiTopics,
  ...societyFairnessTopics,
  ...environmentFreedomTopics,
  ...workSafetyTopics,
]

/** 4단계 그룹 토의 기본 주제(데모·첫 실행용) */
export const defaultTopic = practiceTopics[0]
