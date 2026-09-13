/**
 * 홈 화면에 추가하도록 권하기 (TECH_SPEC 8-6 대응 1번).
 *
 * ## 왜 이것이 백업보다 근본적인가
 *
 * 8-6 이 말하는 제약은 이것입니다.
 *
 * > Safari 는 사용자 상호작용 없이 7일이 지나면 스크립트가 쓴
 * > 저장소(IndexedDB 포함)를 삭제할 수 있습니다.
 *
 * 자동 백업(`features/backup`)은 그 일이 **일어난 뒤에** 되돌릴 수단이고,
 * 설치는 그 일이 **일어나지 않게** 합니다 — 같은 항목이 "홈 화면에 추가된
 * 웹앱은 이 정책에서 제외됩니다"라고 적고 있습니다. 그래서 8-6 의 대응책
 * 다섯 개 중 1번이고, 백업(2번)보다 앞에 있습니다.
 *
 * ## 겁을 주지 않습니다
 *
 * **8-6 대응 1번의 단서입니다** — "단 문구에서 소실을 위협으로 쓰지
 * 않습니다". 확정 방향도 거기 적혀 있습니다: "홈 화면에 추가하면 알림이
 * 오고, 기록이 안전하게 남아요". 라이트에는 알림이 없어 그 절반만
 * 가져왔습니다 (`copy.install`).
 *
 * 한 번 닫으면 다시 묻지 않습니다 (`install_prompt_dismissed_at`).
 * 이 키는 TECH_SPEC 4-1 에 처음부터 있던 칸이고, 이 화면이 그 첫 사용처입니다.
 *
 * ## 기기마다 길이 다릅니다
 *
 * | | 설치 방법 | 앱이 할 수 있는 것 |
 * |---|---|---|
 * | iOS Safari | 공유 → 홈 화면에 추가 | **안내만** — API 가 없습니다 |
 * | Android Chrome | `beforeinstallprompt` | 버튼 한 번으로 띄웁니다 |
 * | 그 밖 | 브라우저마다 다름 | **아무것도 하지 않습니다** |
 *
 * 마지막 줄이 중요합니다. 브라우저마다 메뉴 이름이 달라서, 모르는 곳에
 * 엉뚱한 안내를 띄우면 사용자가 없는 메뉴를 찾게 됩니다. 확실히 아는
 * 두 경우에만 말합니다.
 *
 * > **Chrome 의 설치 조건에 서비스 워커가 들어 있습니다.** fetch 처리기가
 * > 있는 워커가 없으면 `beforeinstallprompt` 가 아예 오지 않습니다.
 * > 2026-09-13 까지 이 앱에는 그것이 없었고, 그래서 `prompt` 갈래는
 * > 안드로이드에서 한 번도 뜬 적이 없습니다. 지금은 `public/sw.js` 가
 * > 그 조건을 채웁니다.
 * >
 * > 그래도 **이 모듈은 워커의 존재를 확인하지 않습니다.** 조건은 브라우저마다
 * > 다르고 버전마다 바뀝니다. 확인할 수 있는 유일한 사실은 "이벤트가
 * > 왔는가"이고, `hasPromptEvent` 가 그것입니다. 안 오면 조용히 숨습니다.
 */

import type Dexie from 'dexie'
import { repo, type Instant, type Repo, type Tables } from '../../data'

/** 무엇을 보여 줄 것인가. 화면은 이 셋만 알면 됩니다. */
export type InstallOffer =
  /** 아무것도 그리지 않습니다. 이미 설치했거나, 닫았거나, 방법을 모릅니다. */
  | 'hidden'
  /** 버튼 한 번으로 설치 창을 띄울 수 있습니다 (Android Chrome). */
  | 'prompt'
  /** 방법을 글로 알려 줍니다 (iOS Safari). */
  | 'ios_manual'

/**
 * 화면 밖의 사실들. **순수 함수로 두려고 인자로 받습니다** — 브라우저 없이
 * 여섯 갈래를 전부 확인할 수 있어야 합니다.
 */
export type InstallFacts = {
  /** 이미 홈 화면에서 열린 상태. 그러면 권할 것이 없습니다. */
  standalone: boolean
  /** `beforeinstallprompt` 를 붙잡아 두었는가. */
  hasPromptEvent: boolean
  /** iOS 기기인가. Safari 든 Chrome 이든 공유 시트에 「홈 화면에 추가」가 있습니다. */
  isIos: boolean
  /** 한 번 닫은 시각. 있으면 다시 묻지 않습니다. */
  dismissedAt: Instant | undefined
}

/**
 * 무엇을 보여 줄지 정합니다.
 *
 * **이미 설치한 사람에게는 닫았는지와 무관하게 아무것도 보이지 않습니다.**
 * 순서가 그래서 중요합니다 — `standalone` 을 가장 먼저 봅니다.
 */
export function installOffer(facts: InstallFacts): InstallOffer {
  if (facts.standalone) return 'hidden'
  if (facts.dismissedAt !== undefined) return 'hidden'
  // 버튼이 있으면 버튼이 낫습니다. 글로 된 안내는 마지막 수단입니다.
  if (facts.hasPromptEvent) return 'prompt'
  if (facts.isIos) return 'ios_manual'
  return 'hidden'
}

// ── 브라우저에서 사실을 읽는 자리 ───────────────────────────────────────

/**
 * `beforeinstallprompt` 는 화면이 뜨기 **전에** 올 수 있습니다.
 *
 * 그래서 컴포넌트가 아니라 모듈이 붙잡습니다. 이 파일이 불러와지는 순간
 * 듣기 시작하고, 늦게 마운트된 화면도 붙잡아 둔 것을 그대로 받습니다.
 */
type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let captured: PromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // 막지 않으면 Chrome 이 자기 배너를 띄웁니다. 자리는 우리가 정합니다.
    event.preventDefault()
    captured = event as PromptEvent
    for (const notify of listeners) notify()
  })

  // 설치가 끝나면 붙잡아 둔 것은 쓸 수 없습니다. 권유도 사라져야 합니다.
  window.addEventListener('appinstalled', () => {
    captured = null
    for (const notify of listeners) notify()
  })
}

/** 붙잡아 둔 이벤트가 바뀌면 알려 줍니다. 정리 함수를 돌려줍니다. */
export function onPromptEventChange(notify: () => void): () => void {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function hasPromptEvent(): boolean {
  return captured !== null
}

/**
 * 붙잡아 둔 설치 창을 띄웁니다. 사용자가 받아들였으면 `true`.
 *
 * **이벤트는 한 번만 쓸 수 있습니다.** 띄운 뒤에는 버려야 하고, 그래서
 * 거절당해도 버튼이 사라집니다 — 같은 이벤트로 다시 띄울 수 없습니다.
 */
export async function showInstallPrompt(): Promise<boolean> {
  const event = captured
  if (event === null) return false
  captured = null
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome === 'accepted'
  } catch {
    return false
  } finally {
    for (const notify of listeners) notify()
  }
}

/**
 * 홈 화면에서 열렸는가.
 *
 * 두 가지를 모두 봅니다. `display-mode: standalone` 이 표준이고,
 * `navigator.standalone` 은 iOS 가 표준보다 먼저 만든 것입니다 —
 * 오래된 iOS 에서는 그쪽만 참입니다.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const byDisplayMode = window.matchMedia?.('(display-mode: standalone)').matches === true
  const byIosLegacy = (navigator as { standalone?: boolean }).standalone === true
  return byDisplayMode || byIosLegacy
}

/**
 * iOS 기기인가.
 *
 * iPadOS 13 부터 아이패드가 자기를 Mac 이라고 말합니다. 그래서 기기 이름만
 * 보면 놓칩니다 — **터치가 되는 Mac 은 아이패드입니다.**
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

/** 닫은 시각을 남깁니다. 실패해도 알릴 것이 없어 삼킵니다. */
export type DismissDeps = {
  now?: Date
  database?: Dexie & Tables
  settings?: Pick<Repo['settings'], 'get' | 'set'>
}

export async function dismissInstallPrompt(deps: DismissDeps = {}): Promise<Instant | null> {
  const settings = deps.settings ?? repo.settings
  const at = (deps.now ?? new Date()).toISOString()
  try {
    await settings.set('install_prompt_dismissed_at', at)
    return at
  } catch {
    return null
  }
}
