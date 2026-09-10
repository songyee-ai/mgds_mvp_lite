/**
 * Repository 인터페이스 (TECH_SPEC 6).
 *
 * `features/` 가 보는 유일한 데이터 접근 지점입니다. 화면은 Dexie 를 직접
 * 부르지 않습니다 (TECH_SPEC 2-2 규칙 2). 1~5단계는 `LocalRepo` 하나뿐이고,
 * 6단계에서 `SyncedRepo` 가 같은 인터페이스를 구현합니다. **그때 화면 코드는
 * 한 줄도 바뀌지 않습니다.** 그것이 이 파일이 존재하는 이유입니다.
 *
 * TECH_SPEC 6 은 `medications: { … }` 처럼 일부 네임스페이스를 줄임표로
 * 남겨 두었습니다. U05 산출물이 "Repo 인터페이스 전체"라 여기서 채웠고,
 * 명세서에 적힌 네임스페이스(pets·dailyLogs·medicationLogs·photos·settings)의
 * 모양을 그대로 따랐습니다. 채운 쪽을 구현하는 U07 이 부족하면 넓히세요.
 */

import type {
  CareManualItem,
  Clinic,
  ClinicVisit,
  DailyLog,
  DateStr,
  Energy,
  ManualKey,
  Meal,
  MedStatus,
  Medication,
  MedicationLog,
  Overall,
  Pet,
  Question,
  SettingKey,
  SettingValue,
  Tag,
  TimeStr,
  Toilet,
  Water,
  WeightRecord,
  WithFood,
} from '../db'

/** 저장소가 스스로 채우는 필드. 부르는 쪽은 넘기지 않습니다. */
type Managed = 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'recorded_by'

/** 아이 등록 입력 (U10). `owner_account_id` 는 6단계에 계정이 채웁니다. */
export type NewPet = Omit<Pet, Managed | 'owner_account_id'>

/**
 * 하루 기록과 그날의 태그를 함께 본 모양.
 *
 * 태그는 별도 테이블(`daily_log_tags`)에 있지만 화면은 항상 같이 씁니다.
 * 두 번 조회하게 두면 부르는 쪽마다 조인을 다시 쓰게 됩니다.
 */
export type DailyLogWithTags = DailyLog & { tags: Tag[] }

/** 기록 카드 5장이 만들어 내는 값 (PRD FR-2). */
export type DailyLogInput = {
  meal: Meal
  water: Water
  energy: Energy
  toilet: Toilet
  overall: Overall
  memo: string | null
  tags: Tag[]
}

export type NewWeight = { date: DateStr; weight_g: number }

/**
 * 약 등록 입력 (U12).
 *
 * `schedule_times`·`started_at` 을 바꾸는 것은 수정이 아니라 새 행입니다
 * (TECH_SPEC 4-3 append-only). 그래서 `update` 가 아니라 `replaceSchedule` 이
 * 따로 있습니다.
 */
export type NewMedication = Omit<Medication, Managed | 'is_active'>

/** 스케줄과 무관한 제자리 수정만 허용합니다 (TECH_SPEC 4-3). */
export type MedicationEdit = { name?: string; dose_text?: string | null }

/**
 * 예정 급여 1회. **정본은 `domain/medSchedule.ts` 입니다** (TECH_SPEC 7-3).
 *
 * U05 가 여기에 임시로 둔 `{ medication_id, pet_id, scheduled_at }` 는 U07 에서
 * 지웠습니다. 명세서의 모양(`{ medicationId, scheduledAt, localTime }`)과
 * 표기가 달라 화면이 도메인에서 받은 값을 그대로 넘길 수 없었습니다.
 *
 * `pet_id` 가 없는 것은 문제가 되지 않습니다 — `record()` 가 `medicationId`
 * 로 약을 조회해서 채웁니다. 화면이 들고 다닐 값이 아닙니다.
 *
 * `data/` → `domain/` 방향의 import 는 허용됩니다. 막힌 것은 반대쪽,
 * `domain/` 이 무언가를 import 하는 것입니다 (TECH_SPEC 2-2 규칙 1).
 */
import type { Occurrence } from '../../domain/medSchedule'

export type { Occurrence }

/**
 * 중복 급여 방지의 UI 계약입니다 (TECH_SPEC 6).
 *
 * 유니크 제약 위반을 **예외로 던지지 않고** 결과 타입으로 돌려줍니다.
 * 화면이 "이미 8:10에 먹였어요"를 보여줄 수 있어야 하기 때문입니다.
 * 던지면 화면은 실패했다는 것밖에 모릅니다.
 */
export type RecordResult =
  | { ok: true; log: MedicationLog }
  | { ok: false; reason: 'already_recorded'; existing: MedicationLog }

export interface Repo {
  pets: {
    list(): Promise<Pet[]>
    get(id: string): Promise<Pet | undefined>
    create(input: NewPet): Promise<Pet>
    update(id: string, patch: Partial<Pet>): Promise<void>
    softDelete(id: string): Promise<void>
  }
  dailyLogs: {
    getByDate(petId: string, date: DateStr): Promise<DailyLogWithTags | undefined>
    range(petId: string, from: DateStr, to: DateStr): Promise<DailyLogWithTags[]>
    upsert(petId: string, date: DateStr, input: DailyLogInput): Promise<DailyLog>
  }
  medications: {
    list(petId: string): Promise<Medication[]>
    listActive(petId: string): Promise<Medication[]>
    get(id: string): Promise<Medication | undefined>
    create(input: NewMedication): Promise<Medication>
    /** 오타 수정 등 스케줄과 무관한 변경만 (TECH_SPEC 4-3). */
    edit(id: string, patch: MedicationEdit): Promise<void>
    /** 스케줄 변경. 기존 행을 `endedOn` 으로 닫고 새 행을 만듭니다. */
    replaceSchedule(
      id: string,
      next: { schedule_times: TimeStr[]; with_food: WithFood; started_at: DateStr },
      endedOn: DateStr,
    ): Promise<Medication>
    stop(id: string, endedOn: DateStr): Promise<void>
  }
  medicationLogs: {
    record(occurrence: Occurrence, status: MedStatus, at: Date): Promise<RecordResult>
    range(petId: string, from: Date, to: Date): Promise<MedicationLog[]>
  }
  weights: {
    range(petId: string, from: DateStr, to: DateStr): Promise<WeightRecord[]>
    latest(petId: string): Promise<WeightRecord | undefined>
    upsert(petId: string, input: NewWeight): Promise<WeightRecord>
    softDelete(id: string): Promise<void>
  }
  clinics: {
    list(petId: string): Promise<Clinic[]>
    primary(petId: string): Promise<Clinic | undefined>
    create(input: Omit<Clinic, Managed>): Promise<Clinic>
    update(id: string, patch: Partial<Clinic>): Promise<void>
    softDelete(id: string): Promise<void>
  }
  clinicVisits: {
    list(petId: string): Promise<ClinicVisit[]>
    create(input: Omit<ClinicVisit, Managed>): Promise<ClinicVisit>
    update(id: string, patch: Partial<ClinicVisit>): Promise<void>
    softDelete(id: string): Promise<void>
  }
  careManual: {
    list(petId: string): Promise<CareManualItem[]>
    /** 항목 1개는 `&[pet_id+key]` 로 하나뿐입니다. 있으면 갱신합니다. */
    put(petId: string, key: ManualKey, valueText: string): Promise<CareManualItem>
    softDelete(id: string): Promise<void>
  }
  questions: {
    list(petId: string): Promise<Question[]>
    /** 아직 해소되지 않은 것만. 통화 직전 화면이 씁니다. */
    listOpen(petId: string): Promise<Question[]>
    create(petId: string, text: string): Promise<Question>
    resolve(id: string, at: Date): Promise<void>
    softDelete(id: string): Promise<void>
  }
  photos: {
    put(petId: string, file: File): Promise<string>
    url(id: string): Promise<string>
  }
  settings: {
    get<K extends SettingKey>(key: K): Promise<SettingValue<K> | undefined>
    set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>
  }
}
