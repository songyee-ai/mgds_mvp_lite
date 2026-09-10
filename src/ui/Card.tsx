import type { ReactNode } from 'react'
import styles from './ui.module.css'

/**
 * 내용 한 덩어리를 담는 상자. 일일 기록 카드 5장(U08)의 바깥 틀이 됩니다.
 *
 * title 을 주면 제목을 렌더하고 그 제목이 카드의 접근성 이름이 됩니다.
 * 제목이 없는 카드는 section 이 아니라 div 로 두어 랜드마크를 늘리지 않습니다.
 */
export interface CardProps {
  title?: string
  children: ReactNode
}

export function Card({ title, children }: CardProps) {
  if (title === undefined) {
    return <div className={styles.card}>{children}</div>
  }

  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  )
}
