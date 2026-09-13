/**
 * Dexie 스키마와 로컬 엔티티 타입 (TECH_SPEC 3·4).
 *
 * 이 파일 하나가 "디스크에 무엇이 어떤 모양으로 있는가"를 정의합니다.
 * `version(1).stores(...)` 의 문자열은 TECH_SPEC 4 를 그대로 옮긴 것이고,
 * 인덱스 하나를 바꾸면 마이그레이션이 필요하므로 손대지 마세요.
 *
 * 열거형의 문자열 값은 DB 에 그대로 저장됩니다. **절대 바꾸지 않습니다**
 * (TECH_SPEC 3-4). 화면 표기는 `copy/ko.ts` 가 담당합니다.
 */

import Dexie, { type Table } from 'dexie'

/** `YYYY-MM-DD`. 기기 로컬 날짜 (TECH_SPEC 3-2). */
export type DateStr = string

/** ISO 8601 UTC. 예: `2026-09-08T11:00:00.000Z` (TECH_SPEC 3-2). */
export type Instant = string

/** `HH:mm` 24시간. 기기 로컬 시각 (TECH_SPEC 3-2). */
export type TimeStr = string

/**
 * 모든 레코드의 공통 필드 (TECH_SPEC 3-3).
 *
 * `deleted_at` 은 soft delete 입니다. 행을 지우지 않고 시각을 채웁니다.
 * `recorded_by` 가 null 이면 "이 기기에서 계정 없이 기록됨"이고,
 * 6단계 마이그레이션이 본인 account_id 로 채웁니다.
 */
export type Meta = {
  created_at: Instant
  updated_at: Instant
  deleted_at: Instant | null
  recorded_by: string | null
}

// ── 열거형 (TECH_SPEC 3-4, 전 계층 공통, 값 변경 금지) ──────────────────

export type Species = 'dog' | 'cat' | 'other'
export type Sex = 'female' | 'male' | 'unknown'
export type Meal = 'ate_all' | 'left_some' | 'barely_ate' | 'refused'
export type Water = 'normal' | 'low' | 'excessive'
export type Energy = 'normal' | 'sluggish' | 'barely_moving'
export type Toilet = 'normal' | 'loose' | 'constipated' | 'accident'
export type Overall = 'good' | 'okay' | 'hard'
export type WithFood = 'before' | 'after' | 'none' | 'unknown'
export type MedStatus = 'given' | 'skipped' | 'spat_out' | 'regiven'

/**
 * 컨텍스트 문서의 고정 목록입니다. 값과 표기가 같아야 요약서 출력이
 * 단순해지므로 열거형 중 유일하게 한글을 값으로 씁니다 (TECH_SPEC 3-4).
 */
export type Tag =
  | '기침'
  | '구토'
  | '절뚝임'
  | '밤중 서성임'
  | '떨림'
  | '헐떡임'
  | '긁음'
  | '유독 붙어있음'
  | '숨어있음'

/**
 * 태그 9종의 표시 순서 (PRD FR-2-1 목록 그대로).
 *
 * 값 자체는 `Tag` 가 정하고, 여기서 정하는 것은 **순서**뿐입니다.
 * 화면과 시드가 각자 목록을 들고 있으면 한쪽에 태그를 더했을 때 조용히
 * 어긋나므로 한 곳에 둡니다.
 */
export const ALL_TAGS: readonly Tag[] = [
  '기침',
  '구토',
  '절뚝임',
  '밤중 서성임',
  '떨림',
  '헐떡임',
  '긁음',
  '유독 붙어있음',
  '숨어있음',
]

export type ManualKey =
  | 'med_method'
  | 'fears'
  | 'favorites'
  | 'cannot_eat'
  | 'history'
  | 'allergies'
  | 'routine'
  | 'grooming'
  | 'other'

// ── 엔티티 (TECH_SPEC 4-1) ──────────────────────────────────────────────

export type Pet = Meta & {
  id: string
  owner_account_id: string | null
  name: string
  photo_id: string | null
  species: Species
  species_other_label: string | null
  breed: string | null
  sex: Sex
  neutered: boolean | null
  birth_date: DateStr | null
  birth_is_approximate: boolean
  /**
   * 입양일. 명세서(TECH_SPEC 4-1)에 없는 필드입니다.
   *
   * "함께한 N일"의 기준일 우선순위를 `입양일 → 정확한 생일 → 등록일` 로
   * 정한 U04 의 ⚠️ T3 결정에서 넘어왔습니다. 값을 고르는 것은 화면(U11)의
   * 몫이고, 입력은 건너뛸 수 있습니다(U10). 자세한 것은 handoff/U04.md.
   */
  adopted_at: DateStr | null
}

export type DailyLog = Meta & {
  id: string
  pet_id: string
  date: DateStr
  meal: Meal
  water: Water
  energy: Energy
  toilet: Toilet
  overall: Overall
  memo: string | null
}

/** 태그는 Meta 를 갖지 않습니다. 소속 DailyLog 와 함께 살고 죽습니다. */
export type DailyLogTag = { daily_log_id: string; tag: Tag }

export type WeightRecord = Meta & {
  id: string
  pet_id: string
  date: DateStr
  /** 그램. 정수 (TECH_SPEC 4-1). */
  weight_g: number
}

export type Medication = Meta & {
  id: string
  pet_id: string
  name: string
  dose_text: string | null
  /** `["08:00","20:00"]`. 길이가 곧 하루 횟수입니다 (TECH_SPEC 4-2). */
  schedule_times: TimeStr[]
  with_food: WithFood
  started_at: DateStr
  ended_at: DateStr | null
  is_active: boolean
}

export type MedicationLog = Meta & {
  id: string
  medication_id: string
  /** 비정규화. 기간 조회를 단일 인덱스로 처리하기 위함 (TECH_SPEC 4-2). */
  pet_id: string
  scheduled_at: Instant
  given_at: Instant | null
  status: MedStatus
  note: string | null
}

export type Clinic = Meta & {
  id: string
  pet_id: string
  name: string
  phone: string
  address: string | null
  lat: number | null
  lng: number | null
  is_primary: boolean
}

export type ClinicVisit = Meta & {
  id: string
  pet_id: string
  clinic_id: string | null
  visited_on: DateStr
  next_scheduled_on: DateStr | null
  summary_text: string | null
}

export type CareManualItem = Meta & {
  id: string
  pet_id: string
  key: ManualKey
  value_text: string
}

/** 보호자가 직접 추가한 "통화 전에 물어볼 것". */
export type Question = Meta & {
  id: string
  pet_id: string
  text: string
  resolved_at: Instant | null
}

/** 사진은 Blob 으로 IndexedDB 에 보관합니다 (TECH_SPEC 4-2). Meta 없음. */
export type Photo = {
  id: string
  pet_id: string
  blob: Blob
  width: number
  height: number
}

/** 아이에 종속되지 않는 key-value (TECH_SPEC 4-1). */
export type Setting =
  | { key: 'condition_reminder_time'; value: TimeStr }
  | { key: 'guardian_name'; value: string }
  | { key: 'guardian_phone'; value: string }
  | { key: 'onboarding_reasons'; value: string[] }
  | { key: 'install_prompt_dismissed_at'; value: Instant }
  | { key: 'trigger_state'; value: Record<string, string> }
  | { key: 'medical_disclaimer_ack_at'; value: Instant }
  | { key: 'active_pet_id'; value: string }
  /**
   * 사용자가 **직접 눌러** 백업 파일을 받은 시각 (라이트 버전).
   *
   * 값이 없으면 기록을 저장한 화면이 안전망 한 장을 내놓습니다
   * (`features/backup/safetyNet.ts`). `/pet/backup` 의 수동 내보내기도 이
   * 값을 남깁니다 — 이미 파일을 가진 사람에게 다시 권할 이유가 없습니다.
   *
   * **백업 파일이 만들어지는 경로는 이제 그 둘뿐이고, 둘 다 사용자가
   * 누릅니다.** 2026-09-13 이전에는 `auto_backup_at` 이라는 키가 하나 더
   * 있었고 기록 저장 직후 조작 없이 파일을 내려받게 했습니다(TECH_SPEC 8-6
   * 대응 2번). 지웠습니다 — 한 번만 부르려던 함수가 태그를 누를 때마다
   * 다시 불려 팝업이 여러 번 떴고, 같은 날 들어간 설치 권유가 그보다 나은
   * 대응이기 때문입니다 (`features/install`).
   *
   * ⚠️ **예전 백업 파일에는 `auto_backup_at` 행이 들어 있습니다.**
   * 가져오기는 설정 테이블을 그대로 옮기므로 그 행이 남을 수 있습니다.
   * 읽는 코드가 없어 해가 없지만, 이 유니온에 도로 넣지는 마세요.
   */
  | { key: 'backup_saved_at'; value: Instant }
  /**
   * 인트로 3장을 지난 시각 (라이트 버전).
   *
   * TECH_SPEC 4-1 의 목록에 없는 키입니다. 본 MVP 는 인트로 뒤에 온보딩
   * ②~⑥ 이 이어져서 "온보딩을 어디까지 했나"를 그 칸들이 답했습니다.
   * 라이트는 인트로 다음이 곧바로 등록이라 인트로를 봤는지만 남기면 됩니다.
   *
   * **끝까지 봤는지와 건너뛰었는지를 구분하지 않습니다.** 건너뛴 사람에게
   * 다시 보여 주는 것은 그 선택을 되돌리는 것이고, 두 경우에 앱이 달라질
   * 일도 없습니다.
   */
  | { key: 'intro_seen_at'; value: Instant }

/**
 * 키에서 값 타입으로 가는 표. `settings.get`·`set` 의 계약입니다.
 *
 * `Extract<Setting, { key: K }>['value']` 로 쓰면 안 됩니다. 분배 조건부라
 * 제네릭 K 앞에서 펼쳐져 `Promise<SettingValue<K> | undefined>` 에 대입되지
 * 않습니다. 매핑 타입의 인덱스 접근은 그런 문제가 없습니다.
 */
export type SettingMap = { [S in Setting as S['key']]: S['value'] }

export type SettingKey = keyof SettingMap

export type SettingValue<K extends SettingKey> = SettingMap[K]

/** 6단계 동기화 큐 (TECH_SPEC 4). U28 이 채웁니다. */
export type OutboxEntry = {
  seq?: number
  table: string
  row_id: string
}

// ── Dexie ───────────────────────────────────────────────────────────────

/**
 * 테이블 이름은 스키마 문자열과 같은 snake_case 입니다. Repo 의 camelCase
 * 네임스페이스(`repo.dailyLogs`)와 다른 것은 의도한 것으로, 저장소 이름과
 * 화면이 부르는 이름을 분리해 둡니다.
 */
export type Tables = {
  pets: Table<Pet, string>
  daily_logs: Table<DailyLog, string>
  daily_log_tags: Table<DailyLogTag, [string, Tag]>
  weights: Table<WeightRecord, string>
  medications: Table<Medication, string>
  medication_logs: Table<MedicationLog, string>
  clinics: Table<Clinic, string>
  clinic_visits: Table<ClinicVisit, string>
  care_manual: Table<CareManualItem, string>
  questions: Table<Question, string>
  photos: Table<Photo, string>
  settings: Table<Setting, SettingKey>
  outbox: Table<OutboxEntry, number>
}

export const DB_NAME = 'mgds'

/**
 * 스키마 문자열은 TECH_SPEC 4 그대로입니다.
 *
 * 유니크 복합 인덱스 3개가 이 스키마의 핵심입니다. 애플리케이션 로직이
 * 어디서 실수하든 DB 가 거부합니다.
 *
 * - `&[pet_id+date]`            하루 1건 (DailyLog·WeightRecord)
 * - `&[medication_id+scheduled_at]`  중복 급여 방지
 * - `&[daily_log_id+tag]`       같은 태그를 두 번 달 수 없음 (복합 기본키)
 * - `&[pet_id+key]`             케어 매뉴얼 항목 1건
 *
 * `name` 은 테스트가 서로의 데이터를 보지 않도록 갈라 쓰기 위한 인자입니다.
 * 앱은 기본값 하나만 씁니다.
 */
export function createDb(name: string = DB_NAME): Dexie & Tables {
  const instance = new Dexie(name) as Dexie & Tables

  instance.version(1).stores({
    pets: 'id, deleted_at',
    daily_logs: 'id, &[pet_id+date], pet_id, date, updated_at',
    daily_log_tags: '&[daily_log_id+tag], daily_log_id, tag',
    weights: 'id, &[pet_id+date], pet_id',
    medications: 'id, pet_id, is_active',
    medication_logs: 'id, &[medication_id+scheduled_at], pet_id, scheduled_at',
    clinics: 'id, pet_id',
    clinic_visits: 'id, pet_id, visited_on',
    care_manual: 'id, &[pet_id+key], pet_id',
    questions: 'id, pet_id',
    photos: 'id, pet_id',
    settings: 'key',
    outbox: '++seq, table, row_id',
  })

  return instance
}

/** 앱이 쓰는 단일 인스턴스. 테스트는 `createDb()` 로 각자 만듭니다. */
export const db = createDb()
