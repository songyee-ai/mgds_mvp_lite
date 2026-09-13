import { useEffect, useState } from 'react'
import { copy } from '../../copy'
import { repo } from '../../data'
import { Button, Card } from '../../ui'
import {
  dismissInstallPrompt,
  hasPromptEvent,
  installOffer,
  isIos,
  isStandalone,
  onPromptEventChange,
  showInstallPrompt,
  type InstallOffer,
} from './install'
import styles from './install.module.css'

/**
 * 홈 맨 아래의 설치 권유 (TECH_SPEC 8-6 대응 1번). 판정은 `install.ts` 에.
 *
 * ## 홈에 두는 이유
 *
 * 홈은 이 앱에서 사용자가 매일 지나는 유일한 화면이고, **설치는 한 번만
 * 하면 끝나는 일**이라 마주칠 기회가 여러 번 필요합니다. 등록 직후
 * (`/welcome`)에 두는 것도 생각했지만 그 화면에는 의료 고지가 있고,
 * 아직 기록이 한 줄도 없어 "기록이 안전하게 남아요"가 와닿지 않습니다.
 *
 * **백업 줄 위에 섭니다.** 둘은 같은 것을 지키는 두 방법이고 (설치는 잃지
 * 않게, 백업은 잃어도 되돌리게), 8-6 에서도 설치가 1번 백업이 2번입니다.
 *
 * ## 한 번 닫으면 끝입니다
 *
 * `install_prompt_dismissed_at` 에 시각이 남고 다시 나오지 않습니다.
 * 매일 지나는 화면에 매일 같은 권유를 두는 것은 잔소리입니다 — 백업
 * 안전망과 같은 계약입니다.
 *
 * **이미 설치한 사람에게는 닫았는지와 무관하게 보이지 않습니다.**
 * `isStandalone()` 을 가장 먼저 봅니다.
 */
export interface InstallPromptProps {
  /**
   * 닫기를 두지 않고, 닫은 적이 있어도 보여 줍니다 (`/pet/backup`).
   *
   * **홈의 카드는 한 번 닫으면 영영 사라지고 되돌릴 길이 없었습니다.**
   * 「나중에」는 "다음에"라는 뜻이지 "영영 하지 않겠다"가 아닌데 그렇게
   * 동작했습니다 (2026-09-13 사용자 지적). 홈에서 다시 조르는 대신
   * **늘 찾아갈 수 있는 자리**를 하나 두는 쪽으로 풀었습니다.
   *
   * 백업 화면인 이유는 거기가 사용자가 "내 기록을 어떻게 지키지"를
   * 생각하며 오는 화면이기 때문입니다. 설치와 백업은 같은 것을 지키는
   * 두 방법입니다 (TECH_SPEC 8-6 대응 1번과 2번).
   *
   * **이미 홈 화면에서 열었으면 여기서도 나오지 않습니다** — 설치한
   * 사람에게 설치를 말할 이유는 어디에도 없습니다.
   */
  persistent?: boolean
}

export function InstallPrompt({ persistent = false }: InstallPromptProps = {}) {
  const [offer, setOffer] = useState<InstallOffer>('hidden')
  /** 설정을 다 읽기 전에는 아무것도 그리지 않습니다. 깜빡임을 막습니다. */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    /**
     * 닫은 시각은 한 번만 읽고 기억합니다. `beforeinstallprompt` 가 늦게
     * 와서 다시 판정할 때 저장소를 또 읽지 않아도 되게 둡니다.
     */
    let dismissedAt: string | undefined

    const decide = () => {
      if (cancelled) return
      setOffer(
        installOffer({
          standalone: isStandalone(),
          hasPromptEvent: hasPromptEvent(),
          isIos: isIos(),
          // 늘 있는 자리는 닫은 기록을 보지 않습니다.
          dismissedAt: persistent ? undefined : dismissedAt,
        }),
      )
    }

    void repo.settings
      .get('install_prompt_dismissed_at')
      .catch(() => undefined)
      .then((at) => {
        if (cancelled) return
        dismissedAt = at
        setReady(true)
        decide()
      })

    // 이벤트는 화면보다 늦게 올 수 있습니다. 오면 다시 판정합니다.
    const stop = onPromptEventChange(decide)

    /**
     * 홈 화면에서 열렸는지도 **한 번만 읽지 않습니다.**
     *
     * `display-mode` 는 화면이 뜬 뒤에 바뀔 수 있습니다 — 설치를 마친 순간,
     * 그리고 iOS 가 페이지를 되살릴 때(뒤로 가기 캐시)가 그렇습니다.
     * 마운트 때 한 번만 보면 그 뒤로 틀린 답을 들고 있게 됩니다.
     */
    const standalone = window.matchMedia?.('(display-mode: standalone)')
    standalone?.addEventListener('change', decide)

    return () => {
      cancelled = true
      stop()
      standalone?.removeEventListener('change', decide)
    }
  }, [])

  if (!ready || offer === 'hidden') return null

  /**
   * 눌러서 설치했든 거절했든 이 자리는 사라집니다.
   *
   * 붙잡아 둔 이벤트는 **한 번만 쓸 수 있어서** 거절 뒤에 버튼을 남기면
   * 눌러도 아무 일이 없는 버튼이 됩니다. 거절도 대답이므로 닫은 것으로
   * 봅니다 — 다음에 생각나면 브라우저 메뉴로 할 수 있습니다.
   */
  const install = () => {
    setOffer('hidden')
    void showInstallPrompt().then((accepted) => {
      if (!accepted) void dismissInstallPrompt()
    })
  }

  const dismiss = () => {
    setOffer('hidden')
    void dismissInstallPrompt()
  }

  return (
    <Card title={copy.install.title}>
      <p className={styles.why}>{copy.install.why}</p>
      <div className={styles.row}>
        {offer === 'prompt' ? (
          <Button onClick={install}>{copy.install.cta}</Button>
        ) : (
          <p className={styles.how}>{copy.install.iosHow}</p>
        )}
        {/* 늘 있는 자리에는 닫기가 없습니다. 닫을 것이 아니라 참고할 것입니다. */}
        {persistent ? null : (
          <Button variant="secondary" onClick={dismiss}>
            {copy.install.dismiss}
          </Button>
        )}
      </div>
    </Card>
  )
}
