/**
 * 내보내기 · 가져오기 (U09, TECH_SPEC 10, PRD FR-13-1).
 *
 * 여기가 확인하는 것은 U09 의 테스트 목록 두 줄입니다.
 *
 * 1. 내보내기 → DB 초기화 → 가져오기 → **전체 일치** (사진 포함·제외 각각)
 * 2. 충돌 데이터 병합 시 **최신 우선**, `ImportReport` 에 건수 기록
 *
 * "전체 일치"를 사람이 눈으로 세지 않도록, 12개 테이블 전부를 한 번에
 * 비교하는 `snapshot()` 을 두었습니다. **테이블이 늘면 여기서 자동으로
 * 걸립니다** — 새 테이블을 export 에 넣지 않으면 왕복 후 비어 있습니다.
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import {
  EXPORT_TABLES,
  EXPORT_VERSION,
  ImportError,
  backupFileName,
  createDb,
  createLocalRepo,
  exportAll,
  importAll,
  type CareManualItem,
  type Clinic,
  type ClinicVisit,
  type DailyLog,
  type DailyLogTag,
  type ExportFile,
  type Medication,
  type MedicationLog,
  type Meta,
  type Pet,
  type Photo,
  type Question,
  type Setting,
  type Tables,
  type WeightRecord,
} from '../src/data'
import { autoBackupOnce } from '../src/features/backup/autoBackup'
import {
  markBackupSaved,
  prepareBackup,
  type PreparedBackup,
} from '../src/features/backup/safetyNet'
import { clearAll, seed } from '../src/app/dev/seed'

const AT = '2026-09-09T00:00:00.000Z'
const NEWER = '2026-09-10T00:00:00.000Z'

const meta = (updatedAt: string = AT, deletedAt: string | null = null): Meta => ({
  created_at: AT,
  updated_at: updatedAt,
  deleted_at: deletedAt,
  recorded_by: null,
})

/** 한 테스트가 DB 를 두 개 열 수도 있어(두 기기 상황) 목록으로 들고 있습니다. */
const opened: (Dexie & Tables)[] = []
let counter = 0

async function fresh(): Promise<Dexie & Tables> {
  counter += 1
  const db = createDb(`mgds-export-${counter}`)
  await db.open()
  opened.push(db)
  return db
}

afterEach(async () => {
  while (opened.length > 0) {
    const db = opened.pop()
    if (db !== undefined) await db.delete()
  }
})

/** 읽지 못한 파일의 `failure`. 못 읽는 것이 아니라 읽히면 실패입니다. */
async function failureOf(blob: Blob, db: Dexie & Tables): Promise<string> {
  try {
    await importAll(blob, db)
  } catch (cause) {
    if (cause instanceof ImportError) return cause.failure
    throw cause
  }
  throw new Error('importAll should have thrown')
}

// ── 픽스처 ──────────────────────────────────────────────────────────────

const pet: Pet = {
  ...meta(),
  id: 'pet-1',
  owner_account_id: null,
  name: 'kongi',
  photo_id: 'photo-1',
  species: 'dog',
  species_other_label: null,
  breed: null,
  sex: 'female',
  neutered: true,
  birth_date: '2013-05-01',
  birth_is_approximate: false,
  adopted_at: null,
}

const log = (id: string, date: string, updatedAt: string = AT): DailyLog => ({
  ...meta(updatedAt),
  id,
  pet_id: 'pet-1',
  date,
  meal: 'ate_all',
  water: 'normal',
  energy: 'normal',
  toilet: 'normal',
  overall: 'good',
  memo: null,
})

/**
 * 12개 테이블 전부에 행을 넣습니다. soft delete 된 행 1개도 함께 넣습니다 —
 * "지웠다"는 사실이 파일에 담기지 않으면 복원할 때 지운 기록이 되살아납니다
 * (TECH_SPEC 3-3).
 */
async function fixture(db: Dexie & Tables): Promise<void> {
  const medication: Medication = {
    ...meta(),
    id: 'med-1',
    pet_id: 'pet-1',
    name: 'vetmedin',
    dose_text: '1.25mg',
    schedule_times: ['08:00', '20:00'],
    with_food: 'after',
    started_at: '2026-01-01',
    ended_at: null,
    is_active: true,
  }
  const medicationLog: MedicationLog = {
    ...meta(),
    id: 'medlog-1',
    medication_id: 'med-1',
    pet_id: 'pet-1',
    scheduled_at: '2026-09-08T23:00:00.000Z',
    given_at: '2026-09-08T23:05:00.000Z',
    status: 'given',
    note: null,
  }
  const clinic: Clinic = {
    ...meta(),
    id: 'clinic-1',
    pet_id: 'pet-1',
    name: 'happy',
    phone: '02-000-0000',
    address: null,
    lat: null,
    lng: null,
    is_primary: true,
  }
  const visit: ClinicVisit = {
    ...meta(),
    id: 'visit-1',
    pet_id: 'pet-1',
    clinic_id: 'clinic-1',
    visited_on: '2026-08-01',
    next_scheduled_on: '2026-10-01',
    summary_text: null,
  }
  const manual: CareManualItem = {
    ...meta(),
    id: 'manual-1',
    pet_id: 'pet-1',
    key: 'med_method',
    value_text: 'cheese',
  }
  const question: Question = {
    ...meta(),
    id: 'question-1',
    pet_id: 'pet-1',
    text: 'ask about dose',
    resolved_at: null,
  }
  const weight: WeightRecord = {
    ...meta(),
    id: 'weight-1',
    pet_id: 'pet-1',
    date: '2026-09-01',
    weight_g: 4200,
  }
  const photo: Photo = {
    id: 'photo-1',
    pet_id: 'pet-1',
    blob: new Blob([new Uint8Array([1, 2, 3, 250, 251, 252])], { type: 'image/png' }),
    width: 2,
    height: 3,
  }
  const tags: DailyLogTag[] = [
    { daily_log_id: 'log-1', tag: '기침' },
    { daily_log_id: 'log-1', tag: '떨림' },
  ]
  const settings: Setting[] = [
    { key: 'active_pet_id', value: 'pet-1' },
    { key: 'guardian_name', value: 'songyee' },
  ]

  await db.pets.put(pet)
  // 지워진 기록도 파일에 담겨야 합니다.
  await db.daily_logs.bulkPut([log('log-1', '2026-09-08'), { ...log('log-2', '2026-09-07'), deleted_at: AT }])
  await db.daily_log_tags.bulkPut(tags)
  await db.weights.put(weight)
  await db.medications.put(medication)
  await db.medication_logs.put(medicationLog)
  await db.clinics.put(clinic)
  await db.clinic_visits.put(visit)
  await db.care_manual.put(manual)
  await db.questions.put(question)
  await db.settings.bulkPut(settings)
  await db.photos.put(photo)
}

type Snapshot = Record<string, unknown[]>

/** 12개 테이블 전부를 결정적인 순서로. Blob 은 바이트 배열로 펼칩니다. */
async function snapshot(db: Dexie & Tables): Promise<Snapshot> {
  const out: Snapshot = {}
  for (const table of db.tables) {
    if (table.name === 'outbox') continue
    const rows: unknown[] = await table.toArray()
    const plain = await Promise.all(
      rows.map(async (row) => {
        const record = row as Record<string, unknown>
        if (!(record['blob'] instanceof Blob)) return record
        const blob = record['blob']
        return {
          ...record,
          blob: { type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] },
        }
      }),
    )
    out[table.name] = plain
      .map((row) => JSON.stringify(row))
      .sort()
      .map((text) => JSON.parse(text) as unknown)
  }
  return out
}

async function read(blob: Blob): Promise<ExportFile> {
  return JSON.parse(await blob.text()) as ExportFile
}

// ── 왕복 ────────────────────────────────────────────────────────────────

describe('내보내기 → 초기화 → 가져오기 (U09 테스트 1)', () => {
  it('사진을 포함하면 12개 테이블이 전부 그대로 돌아온다', async () => {
    const db = await fresh()
    await fixture(db)
    const before = await snapshot(db)

    const file = await exportAll({ photos: true }, db)

    // 새 브라우저와 같은 상태를 만듭니다 — 테이블을 전부 비웁니다.
    await clearAll(db)
    for (const table of db.tables) expect(await table.count()).toBe(0)

    const report = await importAll(file, db)

    expect(await snapshot(db)).toEqual(before)
    expect(report.version).toBe(EXPORT_VERSION)
    expect(report.photosIncluded).toBe(true)
    // 로컬이 비어 있었으므로 전부 새로 들어옵니다.
    expect(report.totals.added).toBe(report.totals.incoming)
    expect(report.totals.updated).toBe(0)
    expect(report.totals.kept).toBe(0)
    expect(report.totals.conflicted).toBe(0)
  })

  it('사진을 제외하면 사진만 빠지고 나머지는 그대로 돌아온다', async () => {
    const db = await fresh()
    await fixture(db)
    const before = await snapshot(db)

    const file = await exportAll({ photos: false }, db)
    expect((await read(file)).photos).toEqual([])
    expect((await read(file)).photos_included).toBe(false)

    await clearAll(db)
    const report = await importAll(file, db)

    expect(report.photosIncluded).toBe(false)
    expect(report.tables.photos.incoming).toBe(0)
    expect(await db.photos.count()).toBe(0)

    const after = await snapshot(db)
    expect(after['photos']).toEqual([])
    for (const name of Object.keys(before)) {
      if (name === 'photos') continue
      expect(after[name]).toEqual(before[name])
    }
  })

  it('사진 Blob 이 바이트 단위로 같다', async () => {
    const db = await fresh()
    await fixture(db)
    const file = await exportAll({}, db)
    await clearAll(db)
    await importAll(file, db)

    const restored = await db.photos.get('photo-1')
    expect(restored).toBeDefined()
    expect(restored?.blob.type).toBe('image/png')
    expect([...new Uint8Array(await (restored as Photo).blob.arrayBuffer())]).toEqual([
      1, 2, 3, 250, 251, 252,
    ])
    expect(restored?.width).toBe(2)
    expect(restored?.height).toBe(3)
  })

  it('지워진 기록은 지워진 채로 돌아온다', async () => {
    const db = await fresh()
    await fixture(db)
    const file = await exportAll({}, db)
    await clearAll(db)
    await importAll(file, db)

    expect((await db.daily_logs.get('log-2'))?.deleted_at).toBe(AT)
  })

  it('사진 제외가 기본값이 아니다 — 옵션 없이 부르면 사진이 담긴다', async () => {
    const db = await fresh()
    await fixture(db)
    expect((await read(await exportAll({}, db))).photos).toHaveLength(1)
  })

  it('파일에 스키마 버전과 내보낸 시각이 담긴다', async () => {
    const db = await fresh()
    const file = await read(await exportAll({}, db))
    expect(file.version).toBe(EXPORT_VERSION)
    expect(Number.isNaN(Date.parse(file.exported_at))).toBe(false)
  })

  it('outbox 는 파일에 담지 않는다', async () => {
    const db = await fresh()
    await db.outbox.add({ table: 'daily_logs', row_id: 'log-1' })
    const file = await read(await exportAll({}, db))
    expect(Object.keys(file)).not.toContain('outbox')
  })

  it('3년치 시드도 왕복한다', async () => {
    const db = await fresh()
    const counts = await seed(db, new Date('2026-09-09T12:00:00.000Z'), 'Asia/Seoul')
    const before = await snapshot(db)

    const file = await exportAll({}, db)
    await clearAll(db)
    const report = await importAll(file, db)

    expect(await snapshot(db)).toEqual(before)
    expect(report.tables.daily_logs.added).toBe(counts.dailyLogs)
    expect(report.tables.medication_logs.added).toBe(counts.medicationLogs)
    expect(report.totals.conflicted).toBe(0)
  }, 30_000)
})

// ── 병합 ────────────────────────────────────────────────────────────────

describe('병합 규칙 (U09 테스트 2 · 완료 판정 2)', () => {
  it('같은 id 는 updated_at 이 새로운 쪽을 취하고 건수를 보고한다', async () => {
    const db = await fresh()
    await db.pets.put(pet)

    // 파일 쪽이 새것: 하나는 파일이 이기고, 하나는 로컬이 이깁니다.
    await db.daily_logs.bulkPut([log('log-1', '2026-09-08', AT), log('log-2', '2026-09-07', NEWER)])
    const incoming = await exportAll({}, db)
    const file = await read(incoming)
    const fileRows = file.daily_logs.map((row) =>
      row.id === 'log-1'
        ? { ...row, updated_at: NEWER, memo: 'from file' }
        : { ...row, updated_at: AT, memo: 'from file' },
    )
    const patched = new Blob([JSON.stringify({ ...file, daily_logs: fileRows })], {
      type: 'application/json',
    })

    const report = await importAll(patched, db)

    // log-1: 파일이 새것 → 파일 내용. log-2: 로컬이 새것 → 그대로.
    expect((await db.daily_logs.get('log-1'))?.memo).toBe('from file')
    expect((await db.daily_logs.get('log-2'))?.memo).toBe(null)
    expect(report.tables.daily_logs).toEqual({
      incoming: 2,
      added: 0,
      updated: 1,
      kept: 1,
      skipped: 0,
      conflicted: 0,
    })
  })

  it('같은 updated_at 이면 로컬을 지킨다', async () => {
    const db = await fresh()
    await db.daily_logs.put(log('log-1', '2026-09-08', AT))
    const file = await read(await exportAll({}, db))
    const patched = new Blob([
      JSON.stringify({
        ...file,
        daily_logs: file.daily_logs.map((row) => ({ ...row, memo: 'from file' })),
      }),
    ])

    const report = await importAll(patched, db)
    expect((await db.daily_logs.get('log-1'))?.memo).toBe(null)
    expect(report.tables.daily_logs.kept).toBe(1)
    expect(report.tables.daily_logs.updated).toBe(0)
  })

  it('id 가 다른데 유니크 자리가 겹치면 로컬을 지키고 conflicted 로 보고한다', async () => {
    const db = await fresh()
    // 두 기기가 같은 날짜를 각자 기록한 모양입니다.
    await db.daily_logs.put(log('local-1', '2026-09-08', AT))
    const other = await fresh()
    await other.daily_logs.put(log('remote-1', '2026-09-08', NEWER))
    const file = await exportAll({}, other)
    // 두 기기 상황. afterEach 가 둘 다 지웁니다.

    const report = await importAll(file, db)

    // 파일 쪽이 더 새롭지만 로컬 행을 지웠어야만 넣을 수 있습니다.
    // 조용한 덮어쓰기를 금지하는 계약(PRD FR-13-1)이라 넣지 않습니다.
    expect(await db.daily_logs.get('remote-1')).toBeUndefined()
    expect(await db.daily_logs.get('local-1')).toBeDefined()
    expect(report.tables.daily_logs.conflicted).toBe(1)
    expect(report.totals.conflicted).toBe(1)

  })

  it('태그는 기록을 파일 쪽으로 취한 경우에만 갈아 끼운다', async () => {
    const db = await fresh()
    await db.pets.put(pet)
    await db.daily_logs.put(log('log-1', '2026-09-08', AT))
    await db.daily_log_tags.bulkPut([
      { daily_log_id: 'log-1', tag: '긁음' },
      { daily_log_id: 'log-1', tag: '숨어있음' },
    ])

    const file = await read(await exportAll({}, db))
    const patched = new Blob([
      JSON.stringify({
        ...file,
        daily_logs: file.daily_logs.map((row) => ({ ...row, updated_at: NEWER })),
        daily_log_tags: [{ daily_log_id: 'log-1', tag: '구토' }],
      }),
    ])

    const report = await importAll(patched, db)

    // 부분 갱신하지 않습니다. 파일이 보낸 목록으로 대체합니다.
    expect((await db.daily_log_tags.where('daily_log_id').equals('log-1').toArray()).map((row) => row.tag)).toEqual([
      '구토',
    ])
    expect(report.tables.daily_log_tags.added).toBe(1)
  })

  it('로컬을 지킨 기록의 태그는 손대지 않는다', async () => {
    const db = await fresh()
    await db.daily_logs.put(log('log-1', '2026-09-08', NEWER))
    await db.daily_log_tags.put({ daily_log_id: 'log-1', tag: '긁음' })

    const file = await read(await exportAll({}, db))
    const patched = new Blob([
      JSON.stringify({
        ...file,
        daily_logs: file.daily_logs.map((row) => ({ ...row, updated_at: AT })),
        daily_log_tags: [{ daily_log_id: 'log-1', tag: '구토' }],
      }),
    ])

    const report = await importAll(patched, db)
    expect((await db.daily_log_tags.toArray()).map((row) => row.tag)).toEqual(['긁음'])
    expect(report.tables.daily_log_tags.added).toBe(0)
    expect(report.tables.daily_log_tags.skipped).toBe(1)
  })

  it('이미 있는 설정 키는 덮어쓰지 않고 skipped 로 보고한다', async () => {
    const db = await fresh()
    await db.settings.put({ key: 'guardian_name', value: 'local' })
    const other = await fresh()
    await other.settings.bulkPut([
      { key: 'guardian_name', value: 'from file' },
      { key: 'guardian_phone', value: '010-0000-0000' },
    ])
    const file = await exportAll({}, other)
    // 두 기기 상황. afterEach 가 둘 다 지웁니다.

    const report = await importAll(file, db)

    expect((await db.settings.get('guardian_name'))?.value).toBe('local')
    expect((await db.settings.get('guardian_phone'))?.value).toBe('010-0000-0000')
    expect(report.tables.settings).toEqual({
      incoming: 2,
      added: 1,
      updated: 0,
      kept: 0,
      skipped: 1,
      conflicted: 0,
    })

  })

  it('이미 있는 사진은 그대로 두고 kept 로 보고한다', async () => {
    const db = await fresh()
    await fixture(db)
    const file = await exportAll({ photos: true }, db)

    const report = await importAll(file, db)
    expect(report.tables.photos).toEqual({
      incoming: 1,
      added: 0,
      updated: 0,
      kept: 1,
      skipped: 0,
      conflicted: 0,
    })
  })

  it('보고서의 다섯 숫자를 더하면 incoming 이 된다', async () => {
    const db = await fresh()
    await fixture(db)
    const file = await exportAll({}, db)
    const report = await importAll(file, db)

    for (const name of EXPORT_TABLES) {
      const one = report.tables[name]
      expect(one.added + one.updated + one.kept + one.skipped + one.conflicted).toBe(one.incoming)
    }
    const totals = report.totals
    expect(
      totals.added + totals.updated + totals.kept + totals.skipped + totals.conflicted,
    ).toBe(totals.incoming)
  })
})

// ── 파일을 읽지 못하는 경우 ────────────────────────────────────────────

describe('읽을 수 없는 파일', () => {
  it('JSON 이 아니면 not_json', async () => {
    const db = await fresh()
    expect(await failureOf(new Blob(['not json at all']), db)).toBe('not_json')
  })

  it('객체가 아니면 not_backup', async () => {
    const db = await fresh()
    expect(await failureOf(new Blob([JSON.stringify([1, 2, 3])]), db)).toBe('not_backup')
  })

  it('version 이 없으면 not_backup', async () => {
    const db = await fresh()
    expect(await failureOf(new Blob([JSON.stringify({ pets: [] })]), db)).toBe('not_backup')
  })

  it('테이블이 배열이 아니면 not_backup', async () => {
    const db = await fresh()
    expect(await failureOf(new Blob([JSON.stringify({ version: 1, pets: 'nope' })]), db)).toBe(
      'not_backup',
    )
  })

  it('더 새로운 버전이면 version_too_new', async () => {
    const db = await fresh()
    expect(
      await failureOf(new Blob([JSON.stringify({ version: EXPORT_VERSION + 1 })]), db),
    ).toBe('version_too_new')
  })

  it('읽지 못한 파일은 아무것도 쓰지 않는다', async () => {
    const db = await fresh()
    await fixture(db)
    const before = await snapshot(db)
    expect(await failureOf(new Blob(['{']), db)).toBe('not_json')
    expect(await snapshot(db)).toEqual(before)
  })
})

// ── 자동 백업 ───────────────────────────────────────────────────────────

describe('첫 기록 직후 자동 백업 (완료 판정 3)', () => {
  it('한 번만 떨어지고 auto_backup_at 에 시각을 남긴다', async () => {
    const db = await fresh()
    await fixture(db)
    const settings = createLocalRepo(db).settings
    const saved: string[] = []
    const now = new Date('2026-09-09T05:32:00.000Z')

    const first = await autoBackupOnce({
      save: (_blob, name) => saved.push(name),
      now,
      database: db,
      settings,
    })
    expect(first.done).toBe(true)
    expect(saved).toHaveLength(1)
    expect(await settings.get('auto_backup_at')).toBe(now.toISOString())

    const second = await autoBackupOnce({
      save: (_blob, name) => saved.push(name),
      now,
      database: db,
      settings,
    })
    expect(second).toEqual({ done: false, reason: 'already_backed_up' })
    expect(saved).toHaveLength(1)
  })

  it('저장이 실패해도 던지지 않고, 다음 기록에서 다시 시도한다', async () => {
    const db = await fresh()
    await fixture(db)
    const settings = createLocalRepo(db).settings

    const blocked = await autoBackupOnce({
      save: () => {
        throw new Error('download blocked')
      },
      database: db,
      settings,
    })

    expect(blocked.done).toBe(false)
    expect(blocked).toMatchObject({ reason: 'failed' })
    // 성공하지 않았으므로 시각을 남기지 않습니다 — 다음 기록에서 재시도합니다.
    expect(await settings.get('auto_backup_at')).toBeUndefined()

    let calls = 0
    const retried = await autoBackupOnce({
      save: () => {
        calls += 1
      },
      database: db,
      settings,
    })
    expect(retried.done).toBe(true)
    expect(calls).toBe(1)
  })

  it('만든 파일이 그대로 가져올 수 있는 백업이다', async () => {
    const db = await fresh()
    await fixture(db)
    const before = await snapshot(db)
    let captured: Blob | null = null

    await autoBackupOnce({
      save: (blob) => {
        captured = blob
      },
      database: db,
      settings: createLocalRepo(db).settings,
    })

    expect(captured).not.toBeNull()
    await clearAll(db)
    await importAll(captured as unknown as Blob, db)

    // auto_backup_at 은 백업 파일을 만든 뒤에 쓰이므로 파일에 없습니다.
    const after = await snapshot(db)
    expect(after['settings']).toEqual(before['settings'])
    expect(after['daily_logs']).toEqual(before['daily_logs'])
    expect(after['photos']).toEqual(before['photos'])
  })
})

// ── 자동 백업이 막혔을 때의 안전망 ──────────────────────────────────────

/**
 * `features/backup/safetyNet.ts`.
 *
 * 여기가 지키는 계약은 셋입니다.
 *
 * 1. 직접 받은 적이 없으면 **누르기 전에** 파일이 준비된다 (제스처 안에서
 *    기다리지 않고 건네려면 미리 만들어져 있어야 합니다)
 * 2. 한 번 받으면 다시 권하지 않는다
 * 3. 무슨 일이 있어도 던지지 않는다 (기록 화면 안에서 불립니다)
 */
describe('자동 백업이 막혔을 때의 안전망', () => {
  it('직접 받은 적이 없으면 누르기 전에 파일을 준비해 둔다', async () => {
    const db = await fresh()
    await fixture(db)
    const settings = createLocalRepo(db).settings
    const now = new Date(2026, 8, 9, 14, 3)

    const ready = await prepareBackup({ now, database: db, settings })

    expect(ready).not.toBeNull()
    expect(ready?.name).toBe('mgds-backup-2026-09-09-1403.json')
    expect(ready?.blob.size).toBeGreaterThan(0)
  })

  it('준비한 파일은 그대로 가져올 수 있는 백업이다', async () => {
    const db = await fresh()
    await fixture(db)
    const before = await snapshot(db)

    const ready = await prepareBackup({ database: db, settings: createLocalRepo(db).settings })
    expect(ready).not.toBeNull()

    await clearAll(db)
    await importAll((ready as PreparedBackup).blob, db)

    const after = await snapshot(db)
    expect(after['daily_logs']).toEqual(before['daily_logs'])
    // 사진까지 담습니다 — 사진을 빼면 이 파일 하나로 전체가 복원되지 않습니다.
    expect(after['photos']).toEqual(before['photos'])
  })

  it('한 번 받고 나면 다시 권하지 않는다', async () => {
    const db = await fresh()
    await fixture(db)
    const settings = createLocalRepo(db).settings
    const now = new Date('2026-09-09T05:32:00.000Z')

    expect(await prepareBackup({ database: db, settings })).not.toBeNull()

    expect(await markBackupSaved({ now, settings })).toBe(now.toISOString())
    expect(await settings.get('backup_saved_at')).toBe(now.toISOString())

    expect(await prepareBackup({ database: db, settings })).toBeNull()
  })

  /**
   * 자동 백업이 시각을 남겼다는 것은 **시도했다**는 뜻일 뿐입니다. 그것으로
   * 안전망을 끄면 브라우저가 막은 경우에 백업이 하나도 없게 됩니다 —
   * 두 키를 나눈 이유가 이 테스트입니다.
   */
  it('자동 백업이 시각을 남겼어도 안전망은 그대로 나온다', async () => {
    const db = await fresh()
    await fixture(db)
    const settings = createLocalRepo(db).settings

    const auto = await autoBackupOnce({ save: () => {}, database: db, settings })
    expect(auto.done).toBe(true)
    expect(await settings.get('auto_backup_at')).toBeDefined()

    expect(await prepareBackup({ database: db, settings })).not.toBeNull()
  })

  it('읽지 못해도 던지지 않고 아무것도 내놓지 않는다', async () => {
    const db = await fresh()
    await fixture(db)
    const broken = {
      get: () => Promise.reject(new Error('storage gone')),
      set: () => Promise.reject(new Error('storage gone')),
    }

    expect(await prepareBackup({ database: db, settings: broken })).toBeNull()
    // 파일은 이미 건넨 뒤라 알릴 것이 없습니다. null 로 조용히 넘어갑니다.
    expect(await markBackupSaved({ settings: broken })).toBeNull()
  })
})

describe('파일 이름', () => {
  it('기기 로컬 시각으로 분까지 적는다', () => {
    expect(backupFileName(new Date(2026, 8, 9, 14, 3))).toBe('mgds-backup-2026-09-09-1403.json')
  })
})
