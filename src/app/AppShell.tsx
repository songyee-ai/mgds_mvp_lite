import { Outlet } from 'react-router-dom'
import styles from './AppShell.module.css'

/**
 * 셸. 내용 영역 하나뿐입니다.
 *
 * **본 MVP 의 하단 탭바가 라이트에는 없습니다.** 4탭 중 둘은 자리표시자였고
 * 남은 하나는 링크 한 줄이라, 탭바가 있으면 "아직 안 만든 곳"을 네 칸으로
 * 계속 가리키게 됩니다. 지금은 인트로 → 등록 → 마무리 → 홈 → 기록으로
 * 한 방향으로만 흐르고, 되돌아오는 곳은 늘 홈입니다.
 *
 * 탭바 부품(`ui/TabBar`)은 지우지 않았습니다 — 본 MVP 로 돌아갈 때 이 셸에
 * 한 줄 다시 얹으면 됩니다.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
