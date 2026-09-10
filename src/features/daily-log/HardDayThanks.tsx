import { copy } from '../../copy'
import styles from './dailyLog.module.css'

/**
 * "힘든 날" 감사 반응 — **PRD FR-2-2. P0, 생략 금지.**
 *
 * `overall === 'hard'` 로 저장한 직후 100% 표시됩니다. 조건은 이 컴포넌트를
 * 부르는 쪽(`DailyLogScreen`)에 있고, 그 조건이 실제로 지켜지는지는
 * Playwright 가 고정합니다 (U08 완료 판정 2).
 *
 * **이 화면에 판정·조언을 넣지 마세요.** 문구 두 줄이 전부입니다.
 * 다음 단계를 권하거나 상태를 해석하는 순간 이 장치는 위로가 아니라
 * 평가가 되고, 힘든 날을 누르는 일이 다시 어려워집니다.
 *
 * `role="status"` 로 두어 저장 직후 스크린리더에도 읽힙니다 (NFR-A A-5).
 */
export function HardDayThanks() {
  return (
    <div className={styles.thanks} role="status">
      <p className={styles.thanksLine}>{copy.hardDayThanks.line1}</p>
      <p className={styles.thanksLine}>{copy.hardDayThanks.line2}</p>
    </div>
  )
}
