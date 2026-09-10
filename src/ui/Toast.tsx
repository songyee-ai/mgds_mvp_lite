import styles from './ui.module.css'

/**
 * 짧은 알림 한 줄.
 *
 * 항상 DOM 에 두고 내용만 비웁니다. 열릴 때 노드를 새로 붙이면
 * 스크린리더가 aria-live 영역을 놓치는 경우가 있습니다.
 * role="status" 라 읽는 흐름을 끊지 않습니다.
 *
 * 자동 닫힘 타이머는 두지 않았습니다. 언제 사라지는지는 호출하는 화면이
 * 정할 문제이고, 애니메이션·타이밍은 U02 범위 밖입니다.
 */
export interface ToastProps {
  message: string
  open: boolean
}

export function Toast({ message, open }: ToastProps) {
  return (
    <div role="status" aria-live="polite">
      {open ? <div className={styles.toast}>{message}</div> : null}
    </div>
  )
}
