import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { repo } from '../data'
import { nextPath } from './gate'

/**
 * 앱을 열었을 때 어디로 보낼지 정하는 한 곳 (`/`).
 *
 * 본 MVP 는 `/` 를 곧바로 `/today` 로 보내고, 아이가 없으면 홈이 등록으로
 * 다시 보냈습니다 — 관문이 홈 안에 있었습니다. 라이트는 앞에 인트로와
 * 마무리가 붙어 갈래가 넷이 되므로, 홈이 그것까지 알아야 할 이유가 없습니다.
 * **그래서 판단을 이 컴포넌트 하나로 모았습니다.**
 *
 * | 남아 있는 것 | 보내는 곳 |
 * |---|---|
 * | 아이 있음 · 고지 했음 | 홈 |
 * | 아이 있음 · 고지 전 | 온보딩 마무리 |
 * | 아이 없음 · 인트로 지남 | 아이 등록 |
 * | 아무것도 없음 | 인트로 3장 |
 *
 * **아이가 있는지를 먼저 봅니다.** 온보딩 순서(인트로 → 등록)와 반대인데,
 * 순서를 그대로 따르면 갇히는 경우가 있습니다 — `/today/2026-09-01` 처럼
 * 주소로 곧바로 들어온 사람은 기록 화면의 갈래를 타고 등록으로 가서
 * 인트로를 지나지 않습니다. 그 다음에 앱을 다시 열면 인트로부터 시작하고,
 * 인트로를 지나면 등록으로 가서 **이미 있는 아이를 또 만듭니다.**
 * 아이가 있다는 것은 이 사람이 첫 실행이 아니라는 뜻이고, 인트로는
 * 첫 실행에만 있는 화면입니다.
 *
 * **판단 근거는 `settings` 두 값과 아이 유무뿐입니다.** "몇 번째 실행인가"
 * 같은 것을 세지 않습니다 — 지운 앱을 다시 깔거나 백업을 가져오면 그 숫자는
 * 거짓이 되고, 위 표는 그때도 그대로 맞습니다.
 *
 * 읽는 동안 빈 화면입니다. 로딩 표시를 두지 않은 이유는 IndexedDB 읽기가
 * 몇 번이라 깜빡임이 로딩 문구보다 짧기 때문입니다.
 */
export function RootGate() {
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const decide = async () => {
      const [petId, introSeenAt, ackAt] = await Promise.all([
        repo.settings.get('active_pet_id'),
        repo.settings.get('intro_seen_at'),
        repo.settings.get('medical_disclaimer_ack_at'),
      ])
      /**
       * 키가 있어도 그 아이가 실제로 있는지 봅니다. 백업을 가져오다 만
       * 상태나 손으로 지운 데이터에서 `active_pet_id` 만 남을 수 있고,
       * 그때 홈으로 보내면 홈이 빈 화면을 그립니다.
       */
      const pet = petId === undefined ? undefined : await repo.pets.get(petId)
      if (cancelled) return

      setTarget(
        nextPath({
          hasPet: pet !== undefined,
          introSeen: introSeenAt !== undefined,
          disclaimerAcked: ackAt !== undefined,
        }),
      )
    }

    void decide()
    return () => {
      cancelled = true
    }
  }, [])

  if (target === null) return null
  return <Navigate to={target} replace />
}
