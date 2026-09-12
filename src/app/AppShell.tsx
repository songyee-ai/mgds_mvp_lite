import { Outlet } from 'react-router-dom'
import { Logo } from '../ui'
import styles from './AppShell.module.css'

/**
 * 머리줄의 오른쪽 자리. 인트로의 [건너뛰기]가 이 자리로 들어옵니다.
 *
 * **셸이 머리줄을 소유하고, 화면은 오른쪽 칸만 빌립니다.** 이 id 를 바꾸면
 * 인트로의 건너뛰기가 화면에서 사라집니다 (`features/intro/IntroScreen`).
 */
export const SHELL_HEADER_RIGHT_ID = 'shell-header-right'

/**
 * 셸. 로고 머리줄 하나와 내용 영역 하나입니다.
 *
 * **본 MVP 의 하단 탭바가 라이트에는 없습니다.** 4탭 중 둘은 자리표시자였고
 * 남은 하나는 링크 한 줄이라, 탭바가 있으면 "아직 안 만든 곳"을 네 칸으로
 * 계속 가리키게 됩니다. 지금은 인트로 → 등록 → 마무리 → 홈 → 기록으로
 * 한 방향으로만 흐르고, 되돌아오는 곳은 늘 홈입니다.
 *
 * 탭바 부품(`ui/TabBar`)은 지우지 않았습니다 — 본 MVP 로 돌아갈 때 이 셸에
 * 한 줄 다시 얹으면 됩니다.
 *
 * ## 로고를 화면이 아니라 셸이 그리는 이유
 *
 * 화면마다 로고를 그리게 하면 **세로 위치가 어긋납니다.** 인트로는 `.page`
 * 에 여백이 없고 나머지 화면은 `padding: 1rem` 이 더 있어서, 같은 코드를
 * 넣어도 로고가 16px 씩 다른 높이에 앉습니다. 장을 넘길 때 로고가 튑니다.
 *
 * 셸이 그리면 모든 화면에서 같은 자리이고, 새 화면을 더할 때 빠뜨릴 수도
 * 없습니다.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        {/*
          로고는 가운데, 오른쪽 칸은 화면이 빌려 씁니다.
          `1fr auto 1fr` 이라 오른쪽에 무엇이 들어와도 로고는 줄의 정중앙입니다.
        */}
        <header className={styles.header}>
          {/*
            로고를 감싸는 칸이 있는 이유는 **가운데 열을 여기서 지정하기**
            위해서입니다. `ui/Logo` 는 어디에 쓰일지 모르는 공용 부품이라
            격자 위치를 스스로 알면 안 됩니다.
          */}
          <div className={styles.headerLogo}>
            <Logo />
          </div>
          <div className={styles.headerRight} id={SHELL_HEADER_RIGHT_ID} />
        </header>

        <Outlet />
      </main>
    </div>
  )
}
