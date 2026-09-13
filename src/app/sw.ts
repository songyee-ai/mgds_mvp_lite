/**
 * 서비스 워커 등록.
 *
 * 워커 자체는 `public/sw.js` 에 있습니다 (전략과 함정은 그 파일 주석에).
 * 여기는 **언제 등록하는가**만 정합니다.
 *
 * ## 개발 서버에서는 등록하지 않습니다
 *
 * 한 번 등록된 워커는 탭을 닫아도 남습니다. 개발 중에 캐시가 끼면 고친
 * 것이 화면에 안 나오고, 그때 의심하는 것은 자기 코드지 워커가 아닙니다 —
 * 이 저장소가 가장 피하려는 종류의 시간 낭비입니다.
 *
 * 그래서 `import.meta.env.PROD` 로 갈라 둡니다. 워커를 실제로 확인하려면
 * 빌드한 것을 띄우세요.
 *
 * ```bash
 * npm run build && npm run preview
 * ```
 *
 * (`public/sw.js` 는 개발 서버에서도 `/sw.js` 로 나가지만 자리표시자가
 * 안 박혀 있어, 설령 손으로 등록해도 아무것도 가로채지 않습니다.)
 *
 * ## `load` 를 기다립니다
 *
 * 등록은 첫 화면을 그리는 일과 대역폭을 다툽니다. PRD FR-10 의 "밤중에
 * 급할 때"가 그 첫 화면이라 양보시킵니다. 등록이 몇백 밀리초 늦어도
 * 손해 보는 것은 **다음** 방문의 오프라인뿐입니다.
 */

/** 화면 밖의 사실. 순수 함수로 두려고 인자로 받습니다. */
export type RegisterFacts = {
  /** 프로덕션 빌드인가. 개발 서버에서는 등록하지 않습니다. */
  prod: boolean
  /** 이 브라우저가 서비스 워커를 아는가. */
  supported: boolean
}

export function shouldRegister(facts: RegisterFacts): boolean {
  if (!facts.supported) return false
  return facts.prod
}

export function registerServiceWorker(): void {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  if (!shouldRegister({ prod: import.meta.env.PROD, supported })) return

  window.addEventListener('load', () => {
    void start()
  })
}

async function start(): Promise<void> {
  try {
    /*
     * `updateViaCache: 'none'` — 워커 파일 자체를 HTTP 캐시에서 읽지
     * 않습니다. 이것이 없으면 브라우저가 최대 하루 동안 예전 `sw.js` 를
     * 그대로 쓰고, 새 배포가 그만큼 늦게 도착합니다.
     */
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    })

    /*
     * 홈 화면 앱은 몇 주씩 안 닫힐 수 있습니다. 그 사이 새 배포가 있어도
     * 브라우저는 화면 이동이 없으면 워커를 다시 확인하지 않습니다.
     * 앱으로 돌아올 때마다 한 번 물어봅니다 — 없으면 아무 일도 없습니다.
     */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      /*
       * **`void` 로는 안 됩니다.** 오프라인이면 `update()` 가 거절되고,
       * 잡지 않으면 앱으로 돌아올 때마다 콘솔에 처리되지 않은 거절이
       * 쌓입니다 (2026-09-13, 서버를 끄고 확인). 확인하러 나갔다가 못
       * 만난 것뿐이라 할 말이 없습니다.
       */
      registration.update().catch(() => {})
    })
  } catch {
    /*
     * 등록이 실패해도 앱은 그대로 돕니다. 기록은 IndexedDB 에 있고
     * 화면은 네트워크에서 옵니다. 빠지는 것은 오프라인과 안드로이드의
     * 설치 버튼뿐이라, 사용자에게 알릴 말이 없습니다.
     */
  }
}
