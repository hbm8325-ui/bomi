export type SegmentOption<T extends string> = { value: T; label: string }

export function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
  hint,
}: {
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  hint?: string
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      <div className="segment" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? 'segment-item is-on' : 'segment-item'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
