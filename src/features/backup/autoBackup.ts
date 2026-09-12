/**
 * 첫 기록 직후 자동 백업 (TECH_SPEC 8-6 대응 2번 · PRD FR-13-1 · U09).
 *
 * 이 함수의 존재 이유는 TECH_SPEC 8-7 의 결정 기록입니다. iOS 에서 미설치
 * 상태로 7일간 앱을 열지 않으면 저장소가 비워질 수 있는데(8-6), 그래도
 * 로컬 전용을 유지하기로 했습니다. 그 대신 8-6 의 대응책 5개가 선택이 아니라
 * **필수 구현**이 되었고, 그 중 2번이 "사용자가 아무 조작 없이도 복구 수단을
 * 갖게 한다"입니다. 보호자가 백업을 배우기 전에 백업이 이미 있어야 합니다.
 *
 * **절대 던지지 않습니다.** 기록 저장 흐름 안에서 불리는 함수이고, 백업이
 * 안 되는 것보다 기록이 안 되는 것이 훨씬 나쁩니다 (U09 완료 판정 3).
 * 실패는 결과 값으로 돌려주고 다음 기록에서 다시 시도합니다.
 *
 * ⚠️ **이 함수만으로는 부족합니다.** `done: true` 는 "파일을 만들어 내려받기를
 * 시작시켰다"이지 "사용자가 파일을 가졌다"가 아닙니다. 사용자 조작 없이
 * 시작된 내려받기는 브라우저가 조용히 막을 수 있고 `a.click()` 은 그때도
 * 예외를 던지지 않습니다. 그 구멍은 `safetyNet.ts` 가 사용자의 손가락으로
 * 메웁니다 — 이 함수를 고칠 때 그쪽도 함께 보세요.
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
import { downloadBlob } from './download'

export type AutoBackupResult =
  /**
   * 파일을 만들어 저장을 시도했습니다. **브라우저가 실제로 받았는지는 알 수
   * 없습니다** — 그래서 이것은 성공이 아니라 시도입니다 (`safetyNet.ts`).
   */
  | { done: true; at: Instant; name: string }
  /** 이미 한 번 성공했습니다. 다시 시도하지 않습니다. */
  | { done: false; reason: 'already_backed_up' }
  /** 내보내기나 저장이 실패했습니다. 기록 흐름은 그대로 진행됩니다. */
  | { done: false; reason: 'failed'; cause: unknown }

/**
 * 인자는 전부 테스트를 위한 것입니다. 앱은 `autoBackupOnce()` 로 부릅니다.
 *
 * `save` 를 갈아 끼울 수 있게 둔 덕분에 "저장이 실패해도 던지지 않는다"를
 * 브라우저 없이 확인할 수 있습니다.
 */
export type AutoBackupDeps = {
  save?: (blob: Blob, name: string) => void
  now?: Date
  database?: Dexie & Tables
  settings?: Pick<Repo['settings'], 'get' | 'set'>
}

export async function autoBackupOnce(deps: AutoBackupDeps = {}): Promise<AutoBackupResult> {
  const save = deps.save ?? downloadBlob
  const now = deps.now ?? new Date()
  const settings = deps.settings ?? repo.settings

  try {
    /**
     * 한 번만 합니다. "하루 기록이 1건인가"로 대신할 수 없습니다 — 같은 날
     * 기록을 고칠 때마다 `upsert` 는 건수를 1 로 유지하므로 백업이 매번 다시
     * 떨어집니다. 그래서 `auto_backup_at` 키를 둡니다 (data/db.ts).
     */
    if ((await settings.get('auto_backup_at')) !== undefined) {
      return { done: false, reason: 'already_backed_up' }
    }

    // 사진까지 담습니다. 첫 기록 시점의 데이터는 아이 1명과 기록 1건이라
    // 파일이 작고, 사진을 빼면 그 백업만으로는 전체 복원이 안 됩니다.
    const blob = await exportAll({ photos: true }, deps.database)
    const name = backupFileName(now)
    save(blob, name)

    const at = now.toISOString()
    await settings.set('auto_backup_at', at)
    return { done: true, at, name }
  } catch (cause) {
    // 삼키는 것이 이 함수의 계약입니다. 다음 기록에서 다시 시도합니다.
    return { done: false, reason: 'failed', cause }
  }
}
