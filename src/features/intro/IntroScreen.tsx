import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo } from '../../data'
import { PET_NEW_PATH } from '../../app/routes'
import { SHELL_HEADER_RIGHT_ID } from '../../app/AppShell'
import { Button } from '../../ui'
import { IntroMedia } from './IntroMedia'
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
 * ## 일러스트
 *
 * `IntroMedia.tsx` 의 움직이는 그림 세 장입니다 (960×960 · 5초 루프 ·
 * 무음). 이 화면은 장 번호만 넘기고, 재생·미리 받기·움직임 줄이기 설정은
 * 전부 그쪽이 맡습니다.
 *
 * 세 그림 다 장식이라 `aria-hidden` 입니다 — 문장이 이미 같은 말을 하고
 * 있어서 대체 텍스트를 붙이면 스크린리더가 같은 내용을 두 번 읽습니다.
 *
 * `copy.intro.pages[].art` 문구는 **화면에 나오지 않습니다.** 어떤 그림이
 * 들어갈 자리인지를 카피 파일에 남긴 메모이고, 감수하는 사람이 그림과
 * 문장을 함께 보게 하려고 둔 것입니다.
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

  /**
   * 건너뛰기가 들어갈 셸 머리줄의 오른쪽 칸.
   *
   * **로고와 같은 줄에 놓기 위해 포털을 씁니다.** 머리줄은 셸이 소유하고
   * (`app/AppShell`), 이 화면은 그 오른쪽 칸만 빌립니다. 인트로 안에 따로
   * 줄을 만들면 로고 아래에 또 한 줄이 생겨 44px 과 간격 16px 을 더 먹고,
   * 그만큼 그림이 작아집니다.
   *
   * `useLayoutEffect` 인 이유는 그려지기 전에 자리를 잡기 위해서입니다 —
   * `useEffect` 면 한 프레임 동안 건너뛰기가 없는 화면이 보입니다.
   */
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setHeaderSlot(document.getElementById(SHELL_HEADER_RIGHT_ID))
  }, [])

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
      {/*
        건너뛰기는 "우측 상단에 작게" 입니다 (CONTEXT 5-2). 그 우측 상단이
        이제 셸의 머리줄이라 그리로 보냅니다.
      */}
      {headerSlot === null
        ? null
        : createPortal(
            <button type="button" className={styles.skip} onClick={() => void leave()}>
              {copy.intro.skip}
            </button>,
            headerSlot,
          )}

      {/*
        일러스트. 장식이라 접근성 트리에서 뺍니다 — 문장이 같은 말을 합니다.

        `.artFrame` 이 칸을 꽉 채우고 둥근 모서리로 잘립니다. 정사각 영상이
        정사각이 아닌 칸에 들어가므로 넘치는 쪽이 잘립니다 (`.artFrame`
        주석의 표 참고).
      */}
      <div className={styles.art} aria-hidden>
        <div className={styles.artFrame}>
          <IntroMedia step={step} />
        </div>
      </div>

      <div className={styles.body}>
        <h1 className={styles.title}>{page.title}</h1>
        {/*
          문단 사이의 빈 줄이 카피의 일부입니다 (`copy.intro.pages[].stanzas`).
          문단을 `<div>` 로 묶고 그 사이에만 간격을 줍니다 — 줄 사이가
          아니라 문단 사이가 벌어져야 합니다.
        */}
        {page.stanzas.map((stanza) => (
          <div key={stanza[0]} className={styles.stanza}>
            {stanza.map((line) => (
              <p key={line} className={styles.line}>
                {line}
              </p>
            ))}
          </div>
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
