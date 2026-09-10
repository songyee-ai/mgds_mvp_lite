import { useEffect, useRef, type ReactNode } from 'react'
import { copy } from '../copy'
import styles from './ui.module.css'

/**
 * 바텀시트. 네이티브 <dialog> 위에 올립니다.
 *
 * 직접 만든 오버레이 대신 <dialog>.showModal() 을 쓰는 이유는 포커스 가둠,
 * Esc 닫기, 바깥 내용의 접근성 트리 차단을 브라우저가 처리해 주기 때문입니다.
 * 주 흐름이 스크린리더로 완주 가능해야 한다는 NFR-A A-5 가 여기 걸립니다.
 *
 * 애니메이션은 U02 범위 밖이라 열고 닫을 때 전환 효과가 없습니다.
 */
export interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-label={title}
      // Esc 키와 배경 클릭으로 닫혀도 부모의 open 상태와 어긋나지 않게 합니다.
      onClose={onClose}
      onCancel={onClose}
    >
      <div className={styles.sheetHeader}>
        <h2 className={styles.sheetTitle}>{title}</h2>
        <button
          type="button"
          className={styles.sheetClose}
          onClick={onClose}
          aria-label={copy.common.close}
        >
          {copy.common.close}
        </button>
      </div>
      <div className={styles.sheetBody}>{children}</div>
    </dialog>
  )
}
