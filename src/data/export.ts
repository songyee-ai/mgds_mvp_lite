/**
 * 데이터 내보내기·가져오기 (TECH_SPEC 10, PRD FR-13-1).
 *
 * **로컬 전용 단계의 유일한 백업 수단입니다.** TECH_SPEC 8-6 이 밝힌 대로,
 * iOS 에서 미설치 상태로 7일간 앱을 열지 않으면 저장소가 비워질 수 있습니다.
 * 보호자가 아무것도 하지 않아도 복구 수단이 있어야 하므로, 8-7 이 로컬 전용을
 * 유지하는 대신 8-6 의 대응책 5개를 **필수 구현**으로 올렸습니다. 이 파일이
 * 그 중 2번(첫 기록 직후 자동 백업)의 재료입니다.
 *
 * 여기에는 DOM 이 없습니다. 파일을 실제로 내려받게 하는 것은
 * `features/backup/download.ts` 이고, 이 파일은 `Blob` 을 만들고 읽는 것까지만
 * 합니다. 그래야 fake-indexeddb 만으로 전부 단위 테스트할 수 있습니다.
 *
 * **Repo 를 거치지 않고 Dexie 를 직접 씁니다.** 가져오기는 `id` 와 Meta 4개를
 * 파일에 있던 값 그대로 되살려야 하는데, `Repo` 는 정확히 그 필드들을 스스로
 * 채우는 것이 계약입니다(`Managed`). 내보내기도 soft delete 된 행까지 포함해야
 * 하고(TECH_SPEC 3-3 — "지워졌다"는 사실도 백업의 일부입니다) Repo 의 조회는
 * 그것들을 걸러 냅니다. 이 파일은 `data/` 안이므로 TECH_SPEC 2-2 규칙 2
 * (`features/` 가 `data/` 를 직접 쓰지 않는다)에 걸리지 않습니다.
 */

import type Dexie from 'dexie'
import type { IndexableType, Table } from 'dexie'
import {
  db as appDb,
  type CareManualItem,
  type Clinic,
  type ClinicVisit,
  type DailyLog,
  type DailyLogTag,
  type Instant,
  type Medication,
  type MedicationLog,
  type Meta,
  type Pet,
  type Question,
  type Setting,
  type Tables,
  type WeightRecord,
} from './db'

/**
 * 파일에 담기는 스키마 버전 (TECH_SPEC 10).
 *
 * Dexie 의 `version(1)` 과 지금은 같은 숫자지만 **같은 것이 아닙니다.**
 * 이 값은 "이 JSON 의 모양"을 가리키고, 읽는 쪽이 마이그레이션을 판단하는
 * 유일한 근거입니다. 파일의 모양이 바뀌면 여기를 올리고, 낮은 버전을 읽는
 * 길을 `importAll` 에 더하세요.
 */
export const EXPORT_VERSION = 1

/**
 * 사진 1장. Blob 은 JSON 에 담기지 않아 base64 로 바꿉니다 (TECH_SPEC 10).
 *
 * 명세서가 적은 모양은 `{id, mime, data_base64}` 세 개지만, 그것만으로는
 * `photos` 행을 되살릴 수 없습니다(`pet_id`·`width`·`height` 가 빠집니다).
 * 명세서의 형식 예시가 `...` 로 줄인 것과 같은 줄에 있어 생략으로 읽었고,
 * 행을 복원할 수 있는 최소 집합으로 넓혔습니다.
 */
export type ExportedPhoto = {
  id: string
  pet_id: string
  width: number
  height: number
  mime: string
  data_base64: string
}

/**
 * 내보낸 파일의 전체 모양.
 *
 * `outbox` 는 담지 않습니다. 6단계 동기화 큐(U28)이고 그 기기가 서버에
 * 아직 못 보낸 것이 무엇인지를 적는 자리라, 다른 기기로 옮기면 남의 큐를
 * 재생하게 됩니다. `++seq` 자동 증가 기본키라 id 기준 병합의 대상도
 * 아닙니다. 1~5단계에서는 항상 비어 있습니다.
 */
export type ExportFile = {
  version: number
  exported_at: Instant
  photos_included: boolean
  pets: Pet[]
  daily_logs: DailyLog[]
  daily_log_tags: DailyLogTag[]
  weights: WeightRecord[]
  medications: Medication[]
  medication_logs: MedicationLog[]
  clinics: Clinic[]
  clinic_visits: ClinicVisit[]
  care_manual: CareManualItem[]
  questions: Question[]
  settings: Setting[]
  photos: ExportedPhoto[]
}

/** 파일에 담기는 테이블 이름. `ImportReport.tables` 의 키입니다. */
export type ExportTableName =
  | 'pets'
  | 'daily_logs'
  | 'daily_log_tags'
  | 'weights'
  | 'medications'
  | 'medication_logs'
  | 'clinics'
  | 'clinic_visits'
  | 'care_manual'
  | 'questions'
  | 'settings'
  | 'photos'

export const EXPORT_TABLES: readonly ExportTableName[] = [
  'pets',
  'daily_logs',
  'daily_log_tags',
  'weights',
  'medications',
  'medication_logs',
  'clinics',
  'clinic_visits',
  'care_manual',
  'questions',
  'settings',
  'photos',
]

export type ExportOptions = {
  /**
   * 사진을 파일에 담을지. 기본값은 담습니다.
   *
   * base64 는 원본보다 약 4/3 커지므로 사진이 많으면 파일이 수십 MB 가
   * 됩니다. 명세서가 제외 옵션을 요구하는 이유입니다 (TECH_SPEC 10).
   */
  photos?: boolean
}

/**
 * 테이블 하나의 병합 결과.
 *
 * 다섯 숫자를 더하면 `incoming` 이 됩니다. **조용히 덮어쓰지 않는다**는
 * 계약(PRD FR-13-1)이 이 보고서로 지켜집니다 — 무엇이 그대로 남았고
 * 무엇이 들어오지 못했는지 부르는 쪽이 알 수 있습니다.
 */
export type ImportTableReport = {
  /** 파일에 있던 행 수. */
  incoming: number
  /** 로컬에 없어서 새로 넣은 행. */
  added: number
  /** 파일 쪽이 더 새로워서 덮어쓴 행. */
  updated: number
  /** 로컬 쪽이 같거나 더 새로워서 그대로 둔 행. */
  kept: number
  /** 병합 규칙을 적용할 수 없어 넣지 않은 행 (`settings`·태그의 고아). */
  skipped: number
  /**
   * `id` 는 다른데 유니크 인덱스 자리가 이미 로컬 행에 차 있어 넣지 못한 행.
   *
   * 두 기기가 같은 날짜를 각자 기록한 경우에 생깁니다. `updated_at` 으로
   * 이길 쪽을 고르면 지는 쪽 행을 **실제로 삭제**해야 하는데
   * (soft delete 는 유니크 자리를 비우지 않습니다), 그것이 바로 이 기능이
   * 금지하는 조용한 덮어쓰기입니다. 로컬을 지키고 보고서에 적습니다.
   */
  conflicted: number
}

/** `importAll` 의 결과 (TECH_SPEC 10 · WORK_UNITS U09). */
export type ImportReport = {
  /** 파일에 적혀 있던 스키마 버전. */
  version: number
  /** 파일이 만들어진 시각. */
  exportedAt: Instant
  /** 파일에 사진이 담겨 있었는지. */
  photosIncluded: boolean
  tables: Record<ExportTableName, ImportTableReport>
  /** 테이블별 숫자를 항목마다 더한 값. */
  totals: ImportTableReport
}

type AnyDb = Dexie & Tables

const EMPTY = (): ImportTableReport => ({
  incoming: 0,
  added: 0,
  updated: 0,
  kept: 0,
  skipped: 0,
  conflicted: 0,
})

// ── base64 ──────────────────────────────────────────────────────────────

/**
 * 32KB 씩 끊어서 문자로 바꿉니다.
 *
 * `String.fromCharCode(...bytes)` 를 한 번에 부르면 인자가 스택에 다 올라가
 * 큰 사진에서 `RangeError` 가 납니다.
 */
const CHUNK = 0x8000

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(data: string, mime: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ── 내보내기 ────────────────────────────────────────────────────────────

/**
 * 전체 데이터를 JSON 파일 1개로 (TECH_SPEC 10).
 *
 * soft delete 된 행도 담습니다. 지웠다는 사실이 빠지면 복원할 때 지운 기록이
 * 되살아납니다 (TECH_SPEC 3-3).
 */
export async function exportAll(
  options: ExportOptions = {},
  database: AnyDb = appDb,
): Promise<Blob> {
  const withPhotos = options.photos ?? true

  // 읽기를 먼저 끝냅니다. base64 변환은 Dexie 밖의 Promise 라
  // 트랜잭션 안에서 await 하면 Dexie 의 트랜잭션 구역이 끊깁니다.
  const [
    pets,
    dailyLogs,
    dailyLogTags,
    weights,
    medications,
    medicationLogs,
    clinics,
    clinicVisits,
    careManual,
    questions,
    settings,
    photoRows,
  ] = await Promise.all([
    database.pets.toArray(),
    database.daily_logs.toArray(),
    database.daily_log_tags.toArray(),
    database.weights.toArray(),
    database.medications.toArray(),
    database.medication_logs.toArray(),
    database.clinics.toArray(),
    database.clinic_visits.toArray(),
    database.care_manual.toArray(),
    database.questions.toArray(),
    database.settings.toArray(),
    withPhotos ? database.photos.toArray() : Promise.resolve([]),
  ])

  const photos: ExportedPhoto[] = []
  for (const row of photoRows) {
    photos.push({
      id: row.id,
      pet_id: row.pet_id,
      width: row.width,
      height: row.height,
      mime: row.blob.type,
      data_base64: await toBase64(row.blob),
    })
  }

  const file: ExportFile = {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    photos_included: withPhotos,
    pets,
    daily_logs: dailyLogs,
    daily_log_tags: dailyLogTags,
    weights,
    medications,
    medication_logs: medicationLogs,
    clinics,
    clinic_visits: clinicVisits,
    care_manual: careManual,
    questions,
    settings,
    photos,
  }

  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** `mgds-backup-2026-09-09-1432.json`. 기기 로컬 시각입니다. */
export function backupFileName(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = [
    at.getFullYear(),
    pad(at.getMonth() + 1),
    pad(at.getDate()),
    `${pad(at.getHours())}${pad(at.getMinutes())}`,
  ].join('-')
  return `mgds-backup-${stamp}.json`
}

// ── 가져오기 ────────────────────────────────────────────────────────────

/** `importAll` 이 파일을 읽지 못한 이유. 화면이 문구를 고르는 근거입니다. */
export type ImportFailure =
  /** JSON 이 아닙니다. */
  | 'not_json'
  /** JSON 이지만 이 앱이 내보낸 파일의 모양이 아닙니다. */
  | 'not_backup'
  /** 더 새로운 버전의 앱이 만든 파일입니다. */
  | 'version_too_new'

/**
 * 문구를 담지 않는 예외입니다. 화면이 `failure` 로 `copy/ko.ts` 를 찾습니다
 * (TECH_SPEC 13). `message` 는 개발자용입니다.
 */
export class ImportError extends Error {
  readonly failure: ImportFailure

  constructor(failure: ImportFailure, message: string) {
    super(message)
    this.name = 'ImportError'
    this.failure = failure
  }
}

function rows<T>(source: Record<string, unknown>, key: ExportTableName): T[] {
  const value = source[key]
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new ImportError('not_backup', `${key} is not an array`)
  }
  return value as T[]
}

/** 파일을 읽고 모양을 확인합니다. 읽을 수 없으면 `ImportError` 를 던집니다. */
async function parse(blob: Blob): Promise<ExportFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await blob.text())
  } catch {
    throw new ImportError('not_json', 'not valid JSON')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ImportError('not_backup', 'root is not an object')
  }

  const source = parsed as Record<string, unknown>
  const version = source['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ImportError('not_backup', 'version is missing or not an integer')
  }
  if (version > EXPORT_VERSION) {
    throw new ImportError('version_too_new', `version ${version} > ${EXPORT_VERSION}`)
  }

  const exportedAt = source['exported_at']

  return {
    version,
    exported_at: typeof exportedAt === 'string' ? exportedAt : '',
    photos_included: source['photos_included'] === true,
    pets: rows(source, 'pets'),
    daily_logs: rows(source, 'daily_logs'),
    daily_log_tags: rows(source, 'daily_log_tags'),
    weights: rows(source, 'weights'),
    medications: rows(source, 'medications'),
    medication_logs: rows(source, 'medication_logs'),
    clinics: rows(source, 'clinics'),
    clinic_visits: rows(source, 'clinic_visits'),
    care_manual: rows(source, 'care_manual'),
    questions: rows(source, 'questions'),
    settings: rows(source, 'settings'),
    photos: rows(source, 'photos'),
  }
}

/** 유니크 복합 인덱스가 걸린 테이블에서, 파일 행이 차지하려는 자리. */
type UniqueSpec<T> = { index: string; key: (row: T) => IndexableType }

/**
 * `id` 기준 병합. 같은 `id` 는 `updated_at` 이 더 새로운 쪽을 취합니다
 * (TECH_SPEC 10 — 6단계 동기화의 충돌 해소와 같은 규칙).
 *
 * `updated_at` 은 `toISOString()` 이 만든 고정 폭 UTC 문자열이라
 * 문자열 비교가 곧 시각 비교입니다.
 *
 * `taken` 을 넘기면 파일 쪽을 취한 행의 `id` 를 모읍니다. `daily_log_tags` 가
 * 어느 기록의 태그를 갈아 끼울지 판단하는 데 씁니다.
 */
async function mergeMetaTable<T extends Meta & { id: string }>(
  table: Table<T, string>,
  incoming: T[],
  unique: UniqueSpec<T> | null,
  taken?: Set<string>,
): Promise<ImportTableReport> {
  const out = EMPTY()
  out.incoming = incoming.length

  for (const row of incoming) {
    if (unique !== null) {
      const occupant = await table.where(unique.index).equals(unique.key(row)).first()
      if (occupant !== undefined && occupant.id !== row.id) {
        out.conflicted += 1
        continue
      }
    }

    const local = await table.get(row.id)
    if (local === undefined) {
      await table.put(row)
      out.added += 1
      taken?.add(row.id)
      continue
    }
    if (row.updated_at > local.updated_at) {
      await table.put(row)
      out.updated += 1
      taken?.add(row.id)
      continue
    }
    out.kept += 1
  }

  return out
}

/**
 * 파일을 **병합**합니다. 조용히 덮어쓰지 않고 결과를 보고합니다
 * (TECH_SPEC 10 · PRD FR-13-1).
 *
 * 전체가 한 트랜잭션입니다. 중간에 실패하면 아무것도 쓰이지 않습니다 —
 * 반쯤 들어간 데이터를 사람이 손으로 정리할 방법이 없기 때문입니다.
 */
export async function importAll(blob: Blob, database: AnyDb = appDb): Promise<ImportReport> {
  const file = await parse(blob)

  // Blob 복원을 트랜잭션 앞에서 끝냅니다. `atob` 는 동기지만 사진이 많을 때
  // 트랜잭션을 오래 쥐고 있을 이유가 없습니다.
  const photos = file.photos.map((photo) => ({
    id: photo.id,
    pet_id: photo.pet_id,
    width: photo.width,
    height: photo.height,
    blob: fromBase64(photo.data_base64, photo.mime),
  }))

  const tables = {} as Record<ExportTableName, ImportTableReport>

  await database.transaction(
    'rw',
    [
      database.pets,
      database.daily_logs,
      database.daily_log_tags,
      database.weights,
      database.medications,
      database.medication_logs,
      database.clinics,
      database.clinic_visits,
      database.care_manual,
      database.questions,
      database.settings,
      database.photos,
    ],
    async () => {
      /** 파일 쪽을 취한 하루 기록. 태그를 갈아 끼울 대상입니다. */
      const takenLogs = new Set<string>()

      tables.pets = await mergeMetaTable(database.pets, file.pets, null)

      tables.daily_logs = await mergeMetaTable(
        database.daily_logs,
        file.daily_logs,
        { index: '[pet_id+date]', key: (row) => [row.pet_id, row.date] },
        takenLogs,
      )

      /**
       * 태그는 Meta 가 없어 스스로 새것인지 말할 수 없습니다. 소속
       * `DailyLog` 와 함께 살고 죽는 값이라, **기록을 파일 쪽으로 취한
       * 경우에만** 그 기록의 태그를 파일의 목록으로 갈아 끼웁니다.
       * `LocalRepo.dailyLogs.upsert` 가 하는 것과 같은 처리입니다 —
       * 부분 갱신하면 파일이 보낸 목록과 어긋납니다.
       */
      const tagsReport = EMPTY()
      tagsReport.incoming = file.daily_log_tags.length
      const tagsByLog = new Map<string, DailyLogTag[]>()
      for (const tag of file.daily_log_tags) {
        const bucket = tagsByLog.get(tag.daily_log_id)
        if (bucket === undefined) tagsByLog.set(tag.daily_log_id, [tag])
        else bucket.push(tag)
      }
      for (const logId of takenLogs) {
        await database.daily_log_tags.where('daily_log_id').equals(logId).delete()
        const incoming = tagsByLog.get(logId) ?? []
        if (incoming.length > 0) await database.daily_log_tags.bulkPut(incoming)
        tagsReport.added += incoming.length
      }
      tagsReport.skipped = tagsReport.incoming - tagsReport.added
      tables.daily_log_tags = tagsReport

      tables.weights = await mergeMetaTable(database.weights, file.weights, {
        index: '[pet_id+date]',
        key: (row) => [row.pet_id, row.date],
      })

      tables.medications = await mergeMetaTable(database.medications, file.medications, null)

      tables.medication_logs = await mergeMetaTable(
        database.medication_logs,
        file.medication_logs,
        {
          index: '[medication_id+scheduled_at]',
          key: (row) => [row.medication_id, row.scheduled_at],
        },
      )

      tables.clinics = await mergeMetaTable(database.clinics, file.clinics, null)
      tables.clinic_visits = await mergeMetaTable(database.clinic_visits, file.clinic_visits, null)

      tables.care_manual = await mergeMetaTable(database.care_manual, file.care_manual, {
        index: '[pet_id+key]',
        key: (row) => [row.pet_id, row.key],
      })

      tables.questions = await mergeMetaTable(database.questions, file.questions, null)

      /**
       * 설정에는 Meta 가 없어 어느 쪽이 새것인지 알 수 없습니다. 없는 키만
       * 넣고, 이미 있는 키는 손대지 않고 보고서에 적습니다. 새 브라우저로
       * 복원하는 경우(로컬이 비어 있음)에는 전부 들어옵니다.
       */
      const settingsReport = EMPTY()
      settingsReport.incoming = file.settings.length
      for (const setting of file.settings) {
        const local = await database.settings.get(setting.key)
        if (local === undefined) {
          await database.settings.put(setting)
          settingsReport.added += 1
        } else {
          settingsReport.skipped += 1
        }
      }
      tables.settings = settingsReport

      /** 사진 Blob 은 바뀌지 않습니다. 없는 것만 넣습니다. */
      const photosReport = EMPTY()
      photosReport.incoming = photos.length
      for (const photo of photos) {
        const local = await database.photos.get(photo.id)
        if (local === undefined) {
          await database.photos.put(photo)
          photosReport.added += 1
        } else {
          photosReport.kept += 1
        }
      }
      tables.photos = photosReport
    },
  )

  const totals = EMPTY()
  for (const name of EXPORT_TABLES) {
    const one = tables[name]
    totals.incoming += one.incoming
    totals.added += one.added
    totals.updated += one.updated
    totals.kept += one.kept
    totals.skipped += one.skipped
    totals.conflicted += one.conflicted
  }

  return {
    version: file.version,
    exportedAt: file.exported_at,
    photosIncluded: file.photos_included,
    tables,
    totals,
  }
}
