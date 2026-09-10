import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo, type Pet } from '../../data'
import { HOME_PATH, PET_NEW_PATH } from '../../app/routes'
import { Button, Card } from '../../ui'
import styles from './welcome.module.css'

/**
 * 온보딩 마무리 1장 (라이트 버전에서 새로 만든 화면).
 *
 * 본 MVP 의 온보딩은 ①~⑥ 여섯 칸이고 라이트는 ①(아이 등록)만 남겼습니다.
 * 그러면 등록 [시작하기] 를 누른 순간 홈이 떠서, 앱이 시작됐다는 감각 없이
 * 화면이 바뀝니다. 이 한 장이 그 자리를 메우고 **여기서 의료 고지를 합니다**
 * (PRD NFR-M M-5).
 *
 * ## 고지를 인트로가 아니라 여기서 하는 이유
 *
 * 인트로에는 건너뛰기가 있습니다 (CONTEXT 5-2). 건너뛰면 고지를 못 보고
 * 넘어가는데 M-5 는 "최초 실행 시 1회"를 요구합니다. 이 화면은 온보딩에서
 * 건너뛸 수 없는 유일한 칸이라 반드시 한 번 지나갑니다.
 *
 * ## 칭찬하지 않습니다
 *
 * "잘하셨어요"·"완료!"를 쓰지 않았습니다. 등록을 과제로 만들면 다음 칸도
 * 과제가 되고, 이 제품은 사용자를 평가하지 않습니다 (PRD 4-1).
 *
 * ## 지나간 뒤에는 다시 오지 않습니다
 *
 * `medical_disclaimer_ack_at` 이 있으면 진입 관문(`app/RootGate`)이 홈으로
 * 보냅니다. 그래서 이 화면은 자기가 그 값을 남기는 것만 책임지고, 다시
 * 보여 줄지 말지는 판단하지 않습니다.
 */
export function WelcomeScreen() {
  const navigate = useNavigate()
  const [pet, setPet] = useState<Pet | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const petId = await repo.settings.get('active_pet_id')
      const found = petId === undefined ? undefined : await repo.pets.get(petId)
      if (cancelled) return
      setPet(found ?? null)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const start = async () => {
    try {
      await repo.settings.set('medical_disclaimer_ack_at', new Date().toISOString())
    } catch {
      /*
       * 고지를 한 번 더 보는 것이 홈에 못 가는 것보다 가볍습니다.
       * M-5 는 "1회 고지"를 요구하고, 실패해서 두 번 보이는 것은 그
       * 요구를 어기지 않습니다.
       */
    }
    navigate(HOME_PATH, { replace: true })
  }

  if (pet === undefined) return null
  /** 아이가 없으면 마무리할 것도 없습니다. 등록으로 돌려보냅니다. */
  if (pet === null) return <Navigate to={PET_NEW_PATH} replace />

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <h1 className={styles.title}>{copy.welcome.title}</h1>
        <p className={styles.line}>{copy.welcome.line(pet.name)}</p>
        <p className={styles.hint}>{copy.welcome.hint}</p>
      </div>

      {/* 의료 고지 (PRD NFR-M M-5). 겁주지 않고 이 도구의 자리만 말합니다. */}
      <Card title={copy.welcome.notice.title}>
        <p className={styles.notice}>{copy.welcome.notice.body}</p>
      </Card>

      <Button block onClick={() => void start()}>
        {copy.welcome.cta}
      </Button>
    </div>
  )
}
