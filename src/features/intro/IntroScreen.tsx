import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo } from '../../data'
import { PET_NEW_PATH } from '../../app/routes'
import { Button } from '../../ui'
import styles from './intro.module.css'

/**
 * 인트로 3장 (CONTEXT 5-2 · PRD FR-1).
 *
 * ## 문구를 고치지 마세요
 *
 * 3장 전부 **확정 카피**입니다 (PRD NFR-C C-2). 문장도 줄바꿈도 원문
 * 그대로이고 `tests/copy-intro.test.ts` 가 문자 단위로 비교합니다.
 * 문구는 `copy/ko.ts` 의 `intro` 가 정본이고 이 파일에는 한글이 없습니다
 * (`lint-hangul` 이 막습니다).
 *
 * ## 일러스트가 없습니다
 *
 * 자리표시자입니다 — WORK_UNITS U31 의 "하지 않을 것"에 일러스트 제작이
 * 들어 있고 ⚠️ PRD U9 로 열려 있습니다. 지금은 장마다 다른 배경 도형이
 * 들어가고, 그림이 생기면 `.art` 안을 바꾸면 됩니다.
 *
 * `art` 문구는 화면에 나오지 않습니다. 어떤 그림이 들어갈 자리인지를
 * 카피 파일에 적어 둔 것이라 `aria-hidden` 인 도형의 형제로도 두지 않습니다.
 *
 * ## 지나간 뒤에는 다시 오지 않습니다
 *
 * 마지막 장의 [시작하기]와 [건너뛰기]가 **똑같이** `intro_seen_at` 을
 * 남기고 등록으로 보냅니다. 건너뛴 사람에게 다음에 또 보여 주는 것은 그
 * 선택을 되돌리는 일입니다.
 *
 * 저장이 실패해도 다음 화면으로 갑니다. 인트로를 한 번 더 보는 것이
 * 등록을 못 하게 되는 것보다 가볍습니다.
 */
export function IntroScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const pages = copy.intro.pages
  const page = pages[step]
  const isLast = step === pages.length - 1

  const leave = async () => {
    try {
      await repo.settings.set('intro_seen_at', new Date().toISOString())
    } catch {
      // 인트로를 한 번 더 보는 것이 등록을 못 하는 것보다 가볍습니다.
    }
    navigate(PET_NEW_PATH, { replace: true })
  }

  if (page === undefined) return null

  return (
    <div className={styles.page}>
      {/* 스킵은 우측 상단에 작게 (CONTEXT 5-2). */}
      <div className={styles.topBar}>
        <button type="button" className={styles.skip} onClick={() => void leave()}>
          {copy.intro.skip}
        </button>
      </div>

      {/* 일러스트 자리. 장마다 다른 도형이 들어갑니다 (⚠️ PRD U9). */}
      <div className={[styles.art, styles[`art${step + 1}`]].filter(Boolean).join(' ')} aria-hidden />

      <div className={styles.body}>
        <h1 className={styles.title}>{page.title}</h1>
        {page.lines.map((line) => (
          <p key={line} className={styles.line}>
            {line}
          </p>
        ))}
        {/* 3장에서 앱 이름이 처음 등장합니다. 영문이라 카피 파일에서 옵니다. */}
        {'wordmark' in page ? <p className={styles.wordmark}>{page.wordmark}</p> : null}
      </div>

      <div className={styles.footer}>
        {/*
          진행 점. `ui/Dots` 는 기록 상태(4종)를 그리는 부품이라 여기 쓰지
          않습니다 — 같은 모양이어도 뜻이 다르고, 그쪽에 다섯 번째 상태를
          더하게 되는 문이 됩니다.
        */}
        <p className={styles.dots} role="status">
          <span className={styles.dotsLabel}>{copy.intro.progress(step + 1, pages.length)}</span>
          <span aria-hidden>
            {pages.map((item, index) => (
              <span
                key={item.title}
                className={[styles.dot, index === step ? styles.dotCurrent : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </span>
        </p>

        <Button block onClick={isLast ? () => void leave() : () => setStep(step + 1)}>
          {isLast ? copy.intro.start : copy.intro.next}
        </Button>
      </div>
    </div>
  )
}
