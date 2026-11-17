import { useMemo, useState } from 'react'
import { practiceTopics } from '../data/topics'
import type { DebateTopic } from '../types'
import { categories } from './SetupScreen'
import { Sheet } from './Sheet'

export function TopicSheet({
  open,
  currentId,
  onClose,
  onSelect,
  onOpenGuide,
}: {
  open: boolean
  currentId?: string
  onClose: () => void
  onSelect: (topic: DebateTopic) => void
  onOpenGuide: (topic: DebateTopic) => void
}) {
  const [category, setCategory] = useState<string>('전체')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const keyword = query.trim()
    return practiceTopics.filter(topic => {
      const inCategory = category === '전체' || topic.category === category
      const inQuery =
        !keyword ||
        topic.title.includes(keyword) ||
        (topic.context?.situation ?? '').includes(keyword) ||
        (topic.context?.keyIssue ?? '').includes(keyword) ||
        (topic.additionalPerspective ?? '').includes(keyword)
      return inCategory && inQuery
    })
  }, [category, query])

  return (
    <Sheet open={open} title="토의 주제 선택" subtitle={`합의·결과물 도출용 주제 ${practiceTopics.length}개`} onClose={onClose}>
      <div className="search-row">
        <input
          className="text-input"
          placeholder="주제·상황·추가 관점 검색"
          value={query}
          onChange={event => setQuery(event.target.value)}
          inputMode="search"
        />
      </div>
      <div className="chip-scroll" role="tablist" aria-label="카테고리">
        {['전체', ...categories].map(name => (
          <button
            key={name}
            role="tab"
            aria-selected={category === name}
            className={category === name ? 'chip is-on' : 'chip'}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="topic-list">
        {list.map(topic => (
          <li key={topic.id} className="topic-row-wrap">
            <button
              className={currentId === topic.id ? 'topic-row is-current' : 'topic-row'}
              onClick={() => onSelect(topic)}
            >
              <span className="topic-row-cat">
                {topic.category}
                {topic.additionalPerspective ? <span className="topic-row-badge">💡 추가 관점</span> : null}
              </span>
              <span className="topic-row-title">{topic.title}</span>
              {topic.context?.keyIssue ? <span className="topic-row-issue">{topic.context.keyIssue}</span> : null}
              {currentId === topic.id ? <span className="topic-row-check">선택됨</span> : null}
            </button>
            <button
              type="button"
              className="topic-guide-button"
              onClick={() => onOpenGuide(topic)}
              aria-label={`${topic.title} 모범 토의 보기`}
              title="📖 모범 토의 & 결과물 보기"
            >
              📖
            </button>
          </li>
        ))}
        {!list.length ? <li className="topic-list-empty">검색 결과가 없습니다.</li> : null}
      </ul>
    </Sheet>
  )
}
