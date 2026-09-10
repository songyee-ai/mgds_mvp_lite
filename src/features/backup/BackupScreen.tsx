import { useEffect, useState, type ChangeEvent } from 'react'
import { copy } from '../../copy'
import {
  EXPORT_TABLES,
  ImportError,
  backupFileName,
  exportAll,
  importAll,
  repo,
  type ExportTableName,
  type ImportReport,
  type ImportTableReport,
  type Instant,
} from '../../data'
import { Button, Card } from '../../ui'
import { downloadBlob } from './download'
import styles from './backup.module.css'

/**
 * 데이터 백업 최소 화면 — `/pet/backup` (U09).
 *
 * **정식 화면은 U30 입니다** (WORK_UNITS U09 "하지 않을 것"). 여기 있는 것은
 * PRD FR-13-1 의 수용 기준을 사용자가 실제로 밟을 수 있게 하는 최소한입니다 —
 * 내보내기 1번, 사진 포함 여부 1개, 가져오기 1번, 그리고 결과 보고서.
 *
 * 보고서를 화면에 그대로 펼치는 것이 이 화면의 핵심입니다. FR-13-1 이
 * "조용히 덮어쓰지 않고 결과를 보고한다"를 수용 기준으로 둔 이유는, 백업
 * 복원이 보호자가 **가장 불안한 순간에** 하는 조작이기 때문입니다. 무엇이
 * 그대로 남았고 무엇이 들어오지 못했는지 그 자리에서 보여야 합니다.
 *
 * `data/` 의 `exportAll`·`importAll` 을 직접 부릅니다. TECH_SPEC 2-2 규칙 2 는
 * 화면이 `Repo` 만 쓰라고 하지만, TECH_SPEC 10 이 이 둘을 Repo 메서드가 아닌
 * 독립 함수로 정의하고 U09 산출물이 파일 이름까지 지정합니다. 6단계의
 * `SyncedRepo` 가 다시 구현할 대상이 아니라(기기 로컬 백업 도구) 규칙이
 * 지키려는 것 — "화면 코드가 한 줄도 바뀌지 않는다" — 이 걸리지 않습니다.
 * 자세한 것은 handoff/U09.md.
 */
export function BackupScreen() {
  const [withPhotos, setWithPhotos] = useState(true)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [exportedName, setExportedName] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoAt, setAutoAt] = useState<Instant | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void repo.settings.get('auto_backup_at').then((at) => {
      if (!cancelled) setAutoAt(at)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onExport = async () => {
    setBusy('export')
    setError(null)
    setExportedName(null)
    try {
      const blob = await exportAll({ photos: withPhotos })
      const name = backupFileName(new Date())
      downloadBlob(blob, name)
      setExportedName(name)
    } catch {
      setError(copy.backup.errors.exportFailed)
    } finally {
      setBusy(null)
    }
  }

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 같은 파일을 두 번 고를 수 있게 비웁니다. 비우지 않으면 change 가 안 옵니다.
    event.target.value = ''
    if (file === undefined) return

    setBusy('import')
    setError(null)
    setReport(null)
    try {
      setReport(await importAll(file))
      // 가져온 파일에 자동 백업 시각이 들어 있을 수 있습니다.
      setAutoAt(await repo.settings.get('auto_backup_at'))
    } catch (cause) {
      setError(
        cause instanceof ImportError
          ? copy.backup.errors[cause.failure]
          : copy.backup.errors.unknown,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{copy.backup.title}</h1>
      <p className={styles.note}>{copy.backup.intro}</p>
      {autoAt === undefined ? null : (
        <p className={styles.note}>{copy.backup.autoDone(autoAt)}</p>
      )}

      <Card title={copy.backup.exportSection.title}>
        <label className={styles.check}>
          <input
            className={styles.checkBox}
            type="checkbox"
            checked={withPhotos}
            onChange={(event) => setWithPhotos(event.target.checked)}
          />
          {copy.backup.exportSection.withPhotos}
        </label>
        <p className={styles.note}>{copy.backup.exportSection.photosHint}</p>
        <div className={styles.row}>
          <Button disabled={busy !== null} onClick={() => void onExport()}>
            {busy === 'export' ? copy.backup.exportSection.working : copy.backup.exportSection.cta}
          </Button>
        </div>
        {exportedName === null ? null : (
          <p className={styles.note} role="status">
            {copy.backup.exportSection.done(exportedName)}
          </p>
        )}
      </Card>

      <Card title={copy.backup.importSection.title}>
        <p className={styles.note}>{copy.backup.importSection.hint}</p>
        <div className={styles.row}>
          <label className={styles.pick}>
            {busy === 'import' ? copy.backup.importSection.working : copy.backup.importSection.pick}
            <input
              className={styles.pickInput}
              type="file"
              accept="application/json,.json"
              disabled={busy !== null}
              onChange={(event) => void onPick(event)}
            />
          </label>
        </div>
      </Card>

      {error === null ? null : (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}

      {report === null ? null : <Report report={report} />}
    </div>
  )
}

const COLUMNS: readonly (keyof ImportTableReport)[] = [
  'incoming',
  'added',
  'updated',
  'kept',
  'skipped',
  'conflicted',
]

function Report({ report }: { report: ImportReport }) {
  // 파일에 아무것도 없던 항목은 줄을 만들지 않습니다.
  const shown: ExportTableName[] = EXPORT_TABLES.filter(
    (name) => report.tables[name].incoming > 0,
  )

  return (
    <Card title={copy.backup.report.title}>
      <p className={styles.note}>{copy.backup.report.meta(report.version, report.exportedAt)}</p>
      <p className={styles.note}>
        {report.photosIncluded ? copy.backup.report.withPhotos : copy.backup.report.withoutPhotos}
      </p>

      <div className={styles.reportScroll}>
        <table className={styles.report}>
          <thead>
            <tr>
              <th scope="col">{copy.backup.report.table}</th>
              {COLUMNS.map((column) => (
                <th key={column} scope="col">
                  {copy.backup.report[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((name) => (
              <tr key={name}>
                <th scope="row">{copy.backup.report.tables[name]}</th>
                {COLUMNS.map((column) => (
                  <td key={column}>{report.tables[name][column]}</td>
                ))}
              </tr>
            ))}
            <tr className={styles.reportTotal}>
              <th scope="row">{copy.backup.report.total}</th>
              {COLUMNS.map((column) => (
                <td key={column}>{report.totals[column]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {report.totals.conflicted > 0 ? (
        <p className={styles.note}>{copy.backup.report.conflictedHint}</p>
      ) : null}
    </Card>
  )
}
