import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../ui'
import { DB_NAME, db } from '../../data'
import styles from './UiCatalog.module.css'

/**
 * /dev/state — 현재 IndexedDB 덤프 (WORK_UNITS 1-5).
 *
 * 화면이 없는 데이터를 눈으로 보는 유일한 통로입니다. U05 시점에는 UI 가
 * 하나도 없으므로 시드가 실제로 들어갔는지 여기서 확인합니다.
 *
 * 개발 중에만 존재합니다 (App.tsx 의 import.meta.env.DEV 가드).
 */

type TableRow = { name: string; count: number; sample: unknown }

export function DevState() {
  const [rows, setRows] = useState<TableRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await Promise.all(
        db.tables.map(async (table) => ({
          name: table.name,
          count: await table.count(),
          sample: await table.limit(1).first(),
        })),
      )
      setRows(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>IndexedDB 덤프</h1>

      <section className={styles.section}>
        <p>
          데이터베이스 {DB_NAME} · 스키마 버전 {db.verno}
        </p>
        <div className={styles.row}>
          <Button onClick={() => void load()}>다시 읽기</Button>
        </div>
      </section>

      {error !== null && (
        <section className={styles.section}>
          <h2 className={styles.heading}>실패</h2>
          <pre>{error}</pre>
        </section>
      )}

      {rows !== null && (
        <section className={styles.section}>
          <h2 className={styles.heading}>건수</h2>
          <table>
            <thead>
              <tr>
                <th>테이블</th>
                <th>건수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rows !== null && (
        <section className={styles.section}>
          <h2 className={styles.heading}>표본 1건씩</h2>
          {rows
            .filter((row) => row.count > 0)
            .map((row) => (
              <div key={row.name}>
                <h3 className={styles.heading}>{row.name}</h3>
                {/* Blob 은 JSON 으로 직렬화되지 않아 자리표시자로 바뀝니다. */}
                <pre>{JSON.stringify(row.sample, replaceBlob, 2)}</pre>
              </div>
            ))}
        </section>
      )}
    </div>
  )
}

function replaceBlob(_key: string, value: unknown): unknown {
  return value instanceof Blob ? `Blob(${value.size} bytes, ${value.type})` : value
}
