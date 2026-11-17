import { useState } from 'react'
import type { Difficulty, Scenario } from '../types'
import { Sheet } from './Sheet'
import { DIFFICULTIES, difficultyOf, difficultyRank, difficultySlug } from '../data/scenarios'

type Props = {
  scenarios: Scenario[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
  onAdd: () => void
  onEdit: (scenario: Scenario) => void
  onDelete: (id: string) => void
  onExportCustom: () => void
  onOpenModelAnswer: (scenario: Scenario) => void
  customCount: number
}

type Filter = '전체' | Difficulty

const FILTERS: Filter[] = ['전체', ...DIFFICULTIES]

export function ScenarioPickerSheet({
  scenarios,
  activeId,
  onSelect,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onExportCustom,
  onOpenModelAnswer,
  customCount,
}: Props) {
  const [filter, setFilter] = useState<Filter>('전체')
  const match = (scenario: Scenario) => filter === '전체' || difficultyOf(scenario) === filter
  const builtin = scenarios.filter(item => item.source === 'builtin').sort((a, b) => difficultyRank(a) - difficultyRank(b))
  const custom = scenarios.filter(item => item.source === 'custom')
  const builtinShown = builtin.filter(match)
  const customShown = custom.filter(match)

  const renderItem = (scenario: Scenario) => (
    <div key={scenario.id} className={`scenario-row ${scenario.id === activeId ? 'is-active' : ''}`}>
      <button type="button" className="scenario-row-main" onClick={() => onSelect(scenario.id)}>
        <span className="badge badge-code">{scenario.code}</span>
        <span className="scenario-row-text">
          <strong>{scenario.title}</strong>
          <span className="muted">
            <span className={`badge badge-difficulty is-${difficultySlug(difficultyOf(scenario))}`}>{difficultyOf(scenario)}</span> {scenario.field} ·
            참고자료 {scenario.resources.length}개 · 함정 {scenario.traps.length}개
          </span>
        </span>
        {scenario.id === activeId ? <span className="badge badge-live">선택됨</span> : null}
      </button>
      <div className="scenario-row-tools">
        {scenario.modelAnswer ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onOpenModelAnswer(scenario)}
            aria-label={`${scenario.title} 모범답안 보기`}
          >
            📖 모범답안
          </button>
        ) : null}
        {scenario.source === 'custom' ? (
          <>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onEdit(scenario)}>
              수정
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs is-danger"
              onClick={() => onDelete(scenario.id)}
              aria-label={`${scenario.title} 삭제`}
            >
              삭제
            </button>
          </>
        ) : null}
      </div>
    </div>
  )

  return (
    <Sheet
      title="과제 선택"
      subtitle="총 16세트(입문·보통·심화) · 모범답안 포함"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onExportCustom} disabled={!customCount}>
            ⬇ 내 과제 {customCount}개 내보내기
          </button>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + 새 과제 추가
          </button>
        </>
      }
    >
      <div className="filter-chips" role="group" aria-label="난이도 필터">
        {FILTERS.map(item => (
          <button
            key={item}
            type="button"
            className={`chip ${filter === item ? 'is-active' : ''}`}
            onClick={() => setFilter(item)}
            aria-pressed={filter === item}
          >
            {item}
            <span className="chip-count">
              {item === '전체' ? scenarios.length : scenarios.filter(s => difficultyOf(s) === item).length}
            </span>
          </button>
        ))}
      </div>

      <h3 className="sheet-section-title">기본 과제</h3>
      {builtinShown.length ? (
        <div className="scenario-list">{builtinShown.map(renderItem)}</div>
      ) : (
        <p className="empty-note">이 난이도의 기본 과제가 없습니다.</p>
      )}

      <h3 className="sheet-section-title">
        내가 추가한 과제 <span className="muted">({custom.length})</span>
      </h3>
      {customShown.length ? (
        <div className="scenario-list">{customShown.map(renderItem)}</div>
      ) : (
        <p className="empty-note">
          {custom.length
            ? '이 난이도에 해당하는 내 과제가 없습니다.'
            : '아직 추가한 과제가 없습니다. [+ 새 과제 추가]에서 직접 입력하거나, AI가 만든 문제 JSON을 붙여 넣어 보세요.'}
        </p>
      )}
    </Sheet>
  )
}
