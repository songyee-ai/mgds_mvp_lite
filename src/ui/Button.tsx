import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './ui.module.css'

/**
 * 기본 버튼. 터치 타깃 44px 하한을 컴포넌트가 보장합니다 (NFR-A A-2).
 *
 * variant 는 primary·secondary 둘뿐입니다. 파괴적 동작용 색(--danger-text)은
 * 토큰에 있지만 사용처를 화이트리스트로 제한해야 해서(TECH_SPEC 14),
 * 실제로 파괴적 동작이 생기는 단위에서 변형을 추가합니다.
 */
export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** 가로를 꽉 채웁니다. 시트 하단의 확인 버튼 같은 자리에 씁니다. */
  block?: boolean
  children: ReactNode
}

// CSS 모듈의 클래스 이름은 타입상 string | undefined 입니다
// (tsconfig 의 noUncheckedIndexedAccess). join 앞에서 걸러 냅니다.
const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
}

export function Button({ variant = 'primary', block = false, children, ...rest }: ButtonProps) {
  const className = [styles.button, VARIANT_CLASS[variant], block ? styles.buttonBlock : '']
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" {...rest} className={className}>
      {children}
    </button>
  )
}
