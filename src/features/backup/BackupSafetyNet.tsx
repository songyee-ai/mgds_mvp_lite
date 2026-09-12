import { useEffect, useState } from 'react'
import { copy } from '../../copy'
import { Button, Card } from '../../ui'
import { downloadBlob } from './download'
import { markBackupSaved, prepareBackup, type PreparedBackup } from './safetyNet'
import styles from './backup.module.css'

/**
 * 자동 백업이 막혔을 때를 위한 안전망 카드 (`safetyNet.ts` 참고).
 *
 * 기록을 저장한 화면에 섭니다. 아직 **직접 받은 파일이 하나도 없는 동안만**
 * 나오고, 한 번 받으면 다시 나오지 않습니다.
 *
 * ## 여기에 두는 이유
 *
 * 자동 백업이 떨어지는 자리가 바로 여기입니다. 자동이 막혔다면 그 사실을
 * 알 수 있는 유일한 순간이고, 방금 기록을 남긴 직후라 "이 기록을 지키는
 * 방법"이 가장 자연스럽게 들립니다. 홈에는 두지 않았습니다 — 홈에는
 * `BackupEntry` 한 줄이 상시로 있고, 아이가 먼저 보여야 하는 화면입니다.
 *
 * ## 매번 나오는 것에 대해
 *
 * 받기 전까지는 기록할 때마다 나옵니다. 잔소리에 가깝지만, 이 카드가 없는
 * 쪽의 결과는 **기록 전부가 조용히 사라지는 것**입니다. 대신 문구가 사용자를
 * 탓하지 않고(원칙 P4), 한 번 누르면 영영 사라집니다.
 *
 * ## 클릭 처리기 안에서 기다리지 않습니다
 *
 * `downloadBlob` 앞에 `await` 가 하나라도 있으면 사용자 활성화 창이 닫힌
 * 뒤에 내려받기가 불릴 수 있고, 그러면 자동 백업과 똑같이 막힙니다. 파일은
 * 이미 `prepareBackup` 이 만들어 두었습니다. 시각을 남기는 것만 뒤로 보냅니다.
 */
export function BackupSafetyNet() {
  const [file, setFile] = useState<PreparedBackup | null>(null)
  const [handed, setHanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void prepareBackup().then((ready) => {
      if (!cancelled) setFile(ready)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 아직 만드는 중이거나, 이미 받아 둔 사람이거나, 만들지 못했습니다.
  if (file === null) return null

  if (handed) {
    return (
      <Card title={copy.backup.safetyNet.title}>
        <p className={styles.note} role="status">
          {copy.backup.safetyNet.done}
        </p>
      </Card>
    )
  }

  const hand = () => {
    downloadBlob(file.blob, file.name)
    setHanded(true)
    void markBackupSaved()
  }

  return (
    <Card title={copy.backup.safetyNet.title}>
      <p className={styles.note}>{copy.backup.safetyNet.why}</p>
      <div className={styles.row}>
        <Button onClick={hand}>{copy.backup.safetyNet.cta}</Button>
      </div>
    </Card>
  )
}
