import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ErrorBoundary } from './ErrorBoundary'
import { RootGate } from './RootGate'
import { DailyLogScreen } from '../features/daily-log'
import { BackupScreen } from '../features/backup'
import { PetCreate } from '../features/pet'
import { HomeScreen } from '../features/home'
import { IntroScreen } from '../features/intro'
import { WelcomeScreen } from '../features/welcome'

/**
 * 라이트 버전 라우팅.
 *
 * **탭이 없습니다.** 본 MVP 는 4탭(오늘·흐름·병원·아이) 셸에 각 탭의 화면을
 * 채워 나가는 구조였고, 그중 둘은 아직 자리표시자였습니다. 라이트는 그
 * 자리표시자를 지우고 한 방향 흐름만 남겼습니다 — 이유는 `app/routes.ts`
 * 주석에 있습니다.
 *
 * ```
 * /  →  /intro  →  /pet/new  →  /welcome  →  /today  →  /today/:date
 *                                              └─  /pet/backup
 * ```
 *
 * `/` 의 갈래는 `RootGate` 가 정합니다. 화면들은 자기 다음 칸만 알고
 * 있으면 되고, "어디서 시작하는가"를 아는 곳은 그 하나입니다.
 */

/**
 * 개발용 라우트.
 *
 * import.meta.env.DEV 는 프로덕션 빌드에서 false 로 치환되므로 이 삼항식이
 * 통째로 [] 가 되고, 죽은 가지 안의 동적 import 는 번들러가 제거합니다.
 * 정적 import 로 두면 프로덕션 청크에 카탈로그가 남습니다.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/ui',
        lazy: async () => ({ Component: (await import('./dev/UiCatalog')).UiCatalog }),
        // lazy 라우트가 있으면 라우터가 초기 렌더용 폴백을 요구합니다.
        // 개발용 라우트라 빈 화면으로 충분합니다.
        HydrateFallback: () => null,
      },
      {
        path: 'dev/seed',
        lazy: async () => ({ Component: (await import('./dev/DevSeed')).DevSeed }),
        HydrateFallback: () => null,
      },
      {
        path: 'dev/state',
        lazy: async () => ({ Component: (await import('./dev/DevState')).DevState }),
        HydrateFallback: () => null,
      },
    ]
  : []

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      /** 앱을 열었을 때. 어디로 갈지는 남아 있는 데이터가 정합니다. */
      { index: true, element: <RootGate /> },

      /** 인트로 3장 (CONTEXT 5-2). 지나면 `intro_seen_at` 이 남습니다. */
      { path: 'intro', element: <IntroScreen /> },

      /**
       * 아이 등록. 라이트 온보딩의 유일한 입력 칸입니다.
       * 저장하면 `/welcome` 으로 갑니다.
       */
      { path: 'pet/new', element: <PetCreate /> },

      /** 온보딩 마무리 + 의료 고지 1회 (PRD NFR-M M-5). */
      { path: 'welcome', element: <WelcomeScreen /> },

      /** 홈. 사진·함께한 N일·오늘 기록·이번 주 점 일곱 개 (PRD FR-5). */
      { path: 'today', element: <HomeScreen /> },

      /**
       * 그 날의 일일 기록 카드 5장 (PRD FR-2). 이 제품의 심장입니다.
       * `:date` 는 지난 날짜 채우기 진입점이고, 홈의 [10초면 돼요] 가
       * 04:00 규칙이 정한 날짜를 붙여 보냅니다 (TECH_SPEC 3-2).
       */
      { path: 'today/:date', element: <DailyLogScreen /> },

      /**
       * 내보내기·가져오기. 홈 맨 아래 링크로만 들어갑니다.
       * **기록이 이 기기에만 있으므로 이 화면이 유일한 안전장치입니다**
       * (TECH_SPEC 8-6).
       */
      { path: 'pet/backup', element: <BackupScreen /> },

      ...devRoutes,

      /**
       * 모르는 주소는 관문으로 되돌립니다 — 홈으로 바로 보내면 온보딩을
       * 안 끝낸 사람이 빈 홈을 보게 됩니다.
       */
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
