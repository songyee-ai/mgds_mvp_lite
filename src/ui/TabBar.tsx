import { NavLink } from 'react-router-dom'
import styles from './ui.module.css'

/**
 * 하단 탭바. 각 탭이 44px 하한을 넘는 터치 타깃입니다 (NFR-A A-2).
 *
 * 활성 탭을 색만으로 구분하지 않습니다. 굵기도 함께 바뀌고,
 * NavLink 가 aria-current="page" 를 붙입니다 (NFR-A A-4·A-5).
 */
export interface TabBarItem {
  readonly id: string
  readonly path: string
  readonly label: string
}

export interface TabBarProps {
  items: readonly TabBarItem[]
  /** 탭바 자체의 이름. 랜드마크 목록에 그대로 읽힙니다. */
  label: string
}

export function TabBar({ items, label }: TabBarProps) {
  return (
    <nav className={styles.tabBar} aria-label={label}>
      {items.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
