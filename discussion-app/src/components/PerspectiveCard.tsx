/** 3단계에서 공개되는 💡 추가 관점 카드 */
export function PerspectiveCard({
  text,
  variant = 'pinned',
}: {
  text: string
  variant?: 'pinned' | 'timeline'
}) {
  return (
    <section className={variant === 'pinned' ? 'perspective-card is-pinned' : 'perspective-card is-timeline'}>
      <div className="perspective-head">
        <span className="perspective-icon" aria-hidden="true">
          💡
        </span>
        <div>
          <strong>추가 관점</strong>
          <small>{variant === 'pinned' ? '3단계에서 새로 공개된 조건입니다' : '2차 토의 시작 지점'}</small>
        </div>
        <span className="perspective-stage">3단계</span>
      </div>
      <p>{text}</p>
      <p className="perspective-hint">이 관점을 반영하면 1차 토의의 결론이 유지되는지, 조건이 붙는지 꼭 말해 보세요.</p>
    </section>
  )
}
