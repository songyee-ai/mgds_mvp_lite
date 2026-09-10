import { useId } from 'react'
import styles from './ui.module.css'

/**
 * 시각 입력. 값은 24시간제 'HH:mm' 문자열입니다.
 *
 * 자체 시계 UI 대신 <input type="time"> 을 씁니다. 모바일에서 OS 기본
 * 시각 선택기가 뜨고, 12/24시간 표기와 접근성을 브라우저가 처리합니다.
 * 약 급여 시각(U12)이 이 형식을 그대로 받습니다.
 */
export interface TimePickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  disabled?: boolean
}

export function TimePicker({ label, value, onChange, hint, disabled = false }: TimePickerProps) {
  const inputId = useId()
  const hintId = `${inputId}-hint`

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.fieldControl}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
      />
      {hint === undefined ? null : (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
