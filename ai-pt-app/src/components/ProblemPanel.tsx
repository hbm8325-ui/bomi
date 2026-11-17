import type { Scenario } from '../types'

type Props = {
  scenario: Scenario
  onOpenResource: (index: number) => void
}

export function ProblemPanel({ scenario, onOpenResource }: Props) {
  return (
    <section className="panel panel-problem" aria-label="문제 지문">
      <header className="panel-head">
        <h2>문제 지문</h2>
        <span className="badge badge-field">{scenario.field}</span>
      </header>

      <div className="panel-scroll">
        <p className="problem-code">
          {scenario.code}
          {scenario.source === 'custom' ? <span className="badge badge-custom">내가 추가</span> : null}
        </p>
        <h3 className="problem-title">{scenario.title}</h3>

        <div className="problem-block">
          <h4>[과제 배경]</h4>
          <p>{scenario.background}</p>
        </div>

        <div className="problem-block problem-mission">
          <h4>[미션]</h4>
          <p>{scenario.mission}</p>
          <p className="mission-limit">※ 답안은 3,000자 이내 — 내용 위주로 평가하며 서식은 채점 비중이 낮습니다.</p>
        </div>

        <div className="problem-block">
          <h4>[핵심 조건]</h4>
          <ul className="condition-list">
            {scenario.constraints.map((constraint, index) => (
              <li key={index}>{constraint}</li>
            ))}
          </ul>
        </div>

        <div className="problem-block">
          <h4>참고자료 <span className="muted">({scenario.resources.length}종 · 클릭해서 열람)</span></h4>
          <div className="resource-list">
            {scenario.resources.map((resource, index) => (
              <button
                key={resource.id}
                type="button"
                className="resource-btn"
                onClick={() => onOpenResource(index)}
              >
                <span className="resource-index">{resource.label}</span>
                <span className="resource-body">
                  <strong>{resource.title}</strong>
                  <span className="resource-summary">{resource.summary}</span>
                </span>
                <span className="resource-open">보기 ›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
