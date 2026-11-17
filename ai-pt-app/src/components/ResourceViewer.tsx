import { useEffect, useState } from 'react'
import type { Resource, ResourceBlock, Scenario } from '../types'
import { resourceToText } from '../data/scenarios'
import { Sheet } from './Sheet'

type Props = {
  scenario: Scenario
  initialIndex: number
  onClose: () => void
  onInsertSummary?: (text: string) => void
}

function TableView({ block }: { block: Extract<ResourceBlock, { kind: 'table' }> }) {
  const { table } = block
  return (
    <figure className="res-table-wrap">
      {table.caption ? <figcaption>{table.caption}</figcaption> : null}
      <div className="res-table-scroll">
        <table className="res-table">
          <thead>
            <tr>
              {table.head.map((cell, index) => (
                <th key={index}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? <p className="res-note">{table.note}</p> : null}
    </figure>
  )
}

function BlockView({ block }: { block: ResourceBlock }) {
  if (block.kind === 'text') return <p className="res-text">{block.text}</p>
  if (block.kind === 'bullets') {
    return (
      <ul className="res-list">
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    )
  }
  return <TableView block={block} />
}

function CopyButton({ resource }: { resource: Resource }) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 1800)
    return () => clearTimeout(timer)
  }, [state])

  const copy = async () => {
    const text = resourceToText(resource)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const area = document.createElement('textarea')
        area.value = text
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setState('done')
    } catch {
      setState('fail')
    }
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
      {state === 'done' ? '✓ 복사됨' : state === 'fail' ? '복사 실패 — 직접 선택' : '📋 자료 텍스트 복사'}
    </button>
  )
}

export function ResourceViewer({ scenario, initialIndex, onClose, onInsertSummary }: Props) {
  const [active, setActive] = useState(() => Math.min(Math.max(initialIndex, 0), scenario.resources.length - 1))
  const resource = scenario.resources[active]

  useEffect(() => {
    setActive(Math.min(Math.max(initialIndex, 0), scenario.resources.length - 1))
  }, [initialIndex, scenario.id, scenario.resources.length])

  const insert = () => {
    if (!resource || !onInsertSummary) return
    onInsertSummary(`${resource.label}(${resource.title}) 요약: ${resource.summary}`)
    onClose()
  }

  return (
    <Sheet
      title={`${scenario.code} 참고자료`}
      subtitle="창을 닫지 않고 자료 1·2를 전환하며 표를 대조할 수 있습니다."
      onClose={onClose}
      size="lg"
    >
      <div className="tabs" role="tablist">
        {scenario.resources.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={`tab ${index === active ? 'is-active' : ''}`}
            onClick={() => setActive(index)}
          >
            {item.label}
            <span className="tab-file">{item.title.replace(/\.pdf$/i, '')}</span>
          </button>
        ))}
      </div>

      {resource ? (
        <article className="res-doc">
          <div className="res-doc-head">
            <div>
              <p className="res-doc-label">{resource.label}</p>
              <h3>{resource.title}</h3>
              <p className="res-doc-meta">{resource.meta ?? ''}</p>
            </div>
            <div className="res-doc-actions">
              <CopyButton resource={resource} />
              {onInsertSummary ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={insert}>
                  ➕ 채팅에 요약 붙여넣기
                </button>
              ) : null}
            </div>
          </div>
          {resource.summary ? <p className="res-doc-summary">{resource.summary}</p> : null}
          <div className="res-doc-body">
            {resource.blocks.map((block, index) => (
              <BlockView key={index} block={block} />
            ))}
          </div>
          {resource.footnote ? <p className="res-footnote">{resource.footnote}</p> : null}
        </article>
      ) : null}
    </Sheet>
  )
}
