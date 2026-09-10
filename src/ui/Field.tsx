import { useId, type InputHTMLAttributes } from 'react'
import styles from './ui.module.css'

/**
 * 라벨이 붙은 한 줄 입력. 라벨·입력·도움말을 한 덩어리로 묶습니다.
 *
 * 라벨을 컴포넌트가 강제하는 이유는, 라벨 없는 입력이 스크린리더에서
 * 이름 없는 칸이 되어 주 흐름을 끊기 때문입니다 (NFR-A A-5).
 * id 는 내부에서 만들어 htmlFor 와 짝을 맞춥니다.
 */
export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  hint?: string
}

export function Field({ label, hint, ...rest }: FieldProps) {
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
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
        {...rest}
      />
      {hint === undefined ? null : (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
