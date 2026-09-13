/**
 * 기록 저장 화면의 백업 한 장 (TECH_SPEC 8-6 대응 2번 · U09 보완).
 *
 * ## 이제 파일이 만들어지는 유일한 자리입니다
 *
 * 예전에는 `autoBackup.ts` 가 기록 저장 직후 **사용자 조작 없이** 파일을
 * 내려받게 했고, 이 모듈은 그것이 브라우저에 막혔을 때를 위한 안전망이었습니다.
 * **2026-09-13 에 자동 쪽을 지웠습니다.**
 *
 * 한 번만 부르려던 함수가 한 번만 불리지 않았기 때문입니다 — `persist()` 는
 * 태그를 누를 때마다, 메모에서 포커스가 빠질 때마다 다시 옵니다. `auto_backup_at`
 * 한 키로 막으려 했지만 그 키가 **쓰이기 전에** 다음 호출이 읽어서, 저장 직후
 * 태그를 고르는 동안 내려받기가 여러 번 떨어졌습니다 (아이폰 실기기).
 *
 * 8-6 이 자동 백업을 요구한 이유는 7일 저장소 삭제인데, **같은 항목이 홈 화면
 * 웹앱은 그 정책에서 제외라고 적고 있습니다.** 설치 권유(`features/install`)가
 * 그쪽을 직접 막으므로, 파일은 사용자가 누를 때만 만듭니다.
 *
 * 남은 성질은 그대로입니다 — 기록을 저장한 화면에 버튼 하나를 내놓고, 누르는
 * 그 순간 파일을 건넵니다. 제스처 안에서 일어나는 내려받기는 어느 브라우저도
 * 막지 않습니다.
 *
 * ## 왜 파일을 미리 만들어 두는가
 *
 * **`await` 하나가 제스처를 끊습니다.** 버튼을 누른 뒤 `exportAll` 을
 * 기다렸다가 내려받으면 사용자 활성화 창이 이미 닫힌 뒤일 수 있고, 그러면
 * 자동 백업과 똑같은 자리에 다시 서게 됩니다. 그래서 `prepareBackup` 이
 * 화면이 뜰 때 미리 Blob 을 만들어 두고, 클릭 처리기는 **기다리는 것 없이**
 * `downloadBlob` 만 부릅니다.
 *
 * ## 던지지 않습니다
 *
 * `autoBackup.ts` 와 같은 계약입니다. 여기서 나는 예외가 기록 화면을 깨면
 * 백업을 지키려다 기록을 잃습니다. 실패는 `null` 로 돌려주고, 카드는 그냥
 * 나오지 않습니다.
 */

import type Dexie from 'dexie'
import {
  backupFileName,
  exportAll,
  repo,
  type Instant,
  type Repo,
  type Tables,
} from '../../data'

/** 누르면 곧바로 건넬 수 있게 준비된 파일. */
export type PreparedBackup = {
  blob: Blob
  name: string
}

/** 인자는 전부 테스트를 위한 것입니다. 화면은 인자 없이 부릅니다. */
export type SafetyNetDeps = {
  now?: Date
  database?: Dexie & Tables
  settings?: Pick<Repo['settings'], 'get' | 'set'>
}

/**
 * 내놓을 파일을 미리 만듭니다.
 *
 * `null` 이면 **안전망을 띄우지 않습니다.** 두 경우입니다.
 *
 * 1. 이미 직접 받아 둔 적이 있다 (`backup_saved_at`). 다시 권하지 않습니다 —
 *    한 번 받은 사람에게 매일 같은 카드를 내미는 것은 잔소리입니다.
 * 2. 내보내기가 실패했다. 내놓을 파일이 없으니 버튼도 없어야 합니다.
 *    사용자가 `/pet/backup` 에서 직접 하면 거기서는 이유가 보입니다.
 *
 * 사진을 함께 담습니다. 사진을 빼면 그 파일만으로 전체가 복원되지 않아
 * "이거 하나면 된다"고 말할 수 없습니다 (`autoBackup.ts` 와 같은 이유).
 */
export async function prepareBackup(deps: SafetyNetDeps = {}): Promise<PreparedBackup | null> {
  const settings = deps.settings ?? repo.settings
  const now = deps.now ?? new Date()

  try {
    if ((await settings.get('backup_saved_at')) !== undefined) return null
    const blob = await exportAll({ photos: true }, deps.database)
    return { blob, name: backupFileName(now) }
  } catch {
    return null
  }
}

/**
 * 파일이 사용자 손에 들어갔다고 기록합니다. 이 뒤로 안전망은 나오지 않습니다.
 *
 * **내려받기를 부른 뒤에 부릅니다.** 순서가 중요합니다 — 먼저 기록하면
 * 내려받기가 실패했을 때 다시 권할 길이 사라집니다.
 *
 * 기록에 실패해도 알릴 것이 없습니다. 사용자는 파일을 이미 가졌고, 잘못되는
 * 방향은 "다음에 한 번 더 권한다" 뿐입니다. `null` 로 돌려주고 넘어갑니다.
 */
export async function markBackupSaved(deps: SafetyNetDeps = {}): Promise<Instant | null> {
  const settings = deps.settings ?? repo.settings
  const at = (deps.now ?? new Date()).toISOString()

  try {
    await settings.set('backup_saved_at', at)
    return at
  } catch {
    return null
  }
}
