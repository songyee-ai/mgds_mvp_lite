import { useState } from 'react'
import { Button } from '../../ui'
import { db } from '../../data'
import { EXPECTED, SEED_DAYS, clearAll, seed, seedPetOnly, type SeedCounts } from './seed'
import styles from './UiCatalog.module.css'

/**
 * /dev/seed — 3년치 시드 생성·초기화 (WORK_UNITS 1-5).
 *
 * 개발 중에만 존재합니다. App.tsx 가 import.meta.env.DEV 안에서만 동적으로
 * 불러오므로 프로덕션 빌드에는 청크 자체가 만들어지지 않습니다.
 *
 * 걸린 시간을 함께 보여 줍니다. TECH_SPEC 18 의 "3년치 규모로 매번
 * 테스트한다"가 지켜지는지 여기서 눈으로 확인합니다.
 */
export function DevSeed() {
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<SeedCounts | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (job: () => Promise<SeedCounts | null>) => {
    setBusy(true)
    setError(null)
    const started = performance.now()
    try {
      setCounts(await job())
      setElapsedMs(Math.round(performance.now() - started))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>시드</h1>

      <section className={styles.section}>
        <p>
          {SEED_DAYS}일치를 만듭니다. 타임존 {tz} 기준으로 마지막 날이 오늘입니다.
          기존 데이터는 지워집니다.
        </p>
        <div className={styles.row}>
          <Button disabled={busy} onClick={() => void run(() => seed(db, new Date(), tz))}>
            3년치 생성
          </Button>
          {/* U08 의 E2E 가 "기록이 없는 날"을 필요로 합니다. 아이 등록 화면은 U10. */}
          <Button
            variant="secondary"
            disabled={busy}
            data-testid="seed-pet-only"
            onClick={() =>
              void run(async () => {
                await seedPetOnly(db, new Date())
                return null
              })
            }
          >
            아이만 만들기
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await clearAll(db)
                return null
              })
            }
          >
            전부 지우기
          </Button>
        </div>
      </section>

      {error !== null && (
        <section className={styles.section}>
          <h2 className={styles.heading}>실패</h2>
          <pre>{error}</pre>
        </section>
      )}

      {elapsedMs !== null && (
        <section className={styles.section}>
          <h2 className={styles.heading}>결과</h2>
          <p>걸린 시간 {elapsedMs}ms</p>
          {counts === null ? (
            <p>비웠습니다.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>테이블</th>
                  <th>건수</th>
                  <th>기대</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>pets</td>
                  <td>{counts.pets}</td>
                  <td>{EXPECTED.pets}</td>
                </tr>
                <tr>
                  <td>daily_logs</td>
                  <td>{counts.dailyLogs}</td>
                  <td>{EXPECTED.dailyLogs}</td>
                </tr>
                <tr>
                  <td>daily_log_tags</td>
                  <td>{counts.dailyLogTags}</td>
                  <td>산포</td>
                </tr>
                <tr>
                  <td>weights</td>
                  <td>{counts.weights}</td>
                  <td>{EXPECTED.weights}</td>
                </tr>
                <tr>
                  <td>medications</td>
                  <td>{counts.medications}</td>
                  <td>{EXPECTED.medications}</td>
                </tr>
                <tr>
                  <td>medication_logs</td>
                  <td>{counts.medicationLogs}</td>
                  <td>{EXPECTED.medicationLogs}</td>
                </tr>
                <tr>
                  <td>clinics</td>
                  <td>{counts.clinics}</td>
                  <td>{EXPECTED.clinics}</td>
                </tr>
                <tr>
                  <td>care_manual</td>
                  <td>{counts.careManual}</td>
                  <td>{EXPECTED.careManual}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
