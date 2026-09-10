/**
 * `Repo` 의 로컬 구현 (1~5단계). Dexie 하나만 씁니다.
 *
 * U07 에서 12개 네임스페이스 34개 메서드가 전부 채워졌습니다. 미구현으로
 * 던지는 자리는 남아 있지 않습니다.
 *
 * **규칙은 화면이 아니라 여기서 강제합니다.** append-only(TECH_SPEC 4-3)와
 * 중복 급여 거부(TECH_SPEC 6)가 그렇습니다. 화면의 조건문에 두면 화면이
 * 늘어날 때마다 다시 지켜야 하고, 한 곳에서 빠지면 조용히 어긋납니다.
 */

import type Dexie from 'dexie'
import type {
  CareManualItem,
  Clinic,
  ClinicVisit,
  DailyLog,
  DailyLogTag,
  DateStr,
  ManualKey,
  MedStatus,
  Medication,
  MedicationLog,
  Meta,
  Pet,
  Question,
  Setting,
  SettingKey,
  SettingValue,
  Tables,
  Tag,
  WeightRecord,
} from '../db'
import type {
  DailyLogInput,
  DailyLogWithTags,
  MedicationEdit,
  NewMedication,
  NewPet,
  NewWeight,
  Occurrence,
  RecordResult,
  Repo,
} from './types'

/** 현재 시각을 얻는 통로. 테스트가 시간을 고정할 수 있도록 주입받습니다. */
export type Clock = () => Date

const alive = <T extends { deleted_at: string | null }>(row: T): boolean => row.deleted_at === null

/**
 * Dexie 가 유니크 제약 위반에 붙이는 이름.
 *
 * 다른 실패(디스크 부족, 스키마 불일치)를 "이미 기록됨"으로 삼키면 안 되므로
 * 이름을 확인합니다.
 */
const isConstraintError = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === 'ConstraintError'

/**
 * 사진의 크기. 리사이즈·EXIF 회전은 U10 의 몫입니다.
 *
 * `createImageBitmap` 이 없는 환경(테스트 러너 등)에서는 0 을 넣습니다.
 * 사진을 잃는 것보다 크기를 모르는 편이 낫습니다.
 */
async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== 'function') return { width: 0, height: 0 }
  const bitmap = await createImageBitmap(blob)
  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export function createLocalRepo(db: Dexie & Tables, clock: Clock = () => new Date()): Repo {
  const stamp = (): string => clock().toISOString()

  /** 여러 기록에 붙은 태그를 한 번에 읽어 기록별로 나눕니다. */
  async function tagsOf(logIds: string[]): Promise<Map<string, Tag[]>> {
    const grouped = new Map<string, Tag[]>()
    if (logIds.length === 0) return grouped
    const rows: DailyLogTag[] = await db.daily_log_tags.where('daily_log_id').anyOf(logIds).toArray()
    for (const row of rows) {
      const bucket = grouped.get(row.daily_log_id)
      if (bucket === undefined) grouped.set(row.daily_log_id, [row.tag])
      else bucket.push(row.tag)
    }
    return grouped
  }

  async function withTags(logs: DailyLog[]): Promise<DailyLogWithTags[]> {
    const grouped = await tagsOf(logs.map((log) => log.id))
    return logs.map((log) => ({ ...log, tags: grouped.get(log.id) ?? [] }))
  }

  /** 새 행에 붙일 Meta. 만든 시각과 고친 시각이 같습니다. */
  const freshMeta = (): Meta => {
    const at = stamp()
    return { created_at: at, updated_at: at, deleted_at: null, recorded_by: null }
  }

  /**
   * soft delete 를 한 곳에서 처리합니다.
   *
   * 행을 지우지 않고 `deleted_at` 을 채웁니다. 6단계 동기화가 "지워졌다"는
   * 사실도 전파해야 하기 때문입니다 (TECH_SPEC 3-3).
   */
  async function softDeleteIn<T extends Meta & { id: string }>(
    table: Dexie.Table<T, string>,
    id: string,
    label: string,
  ): Promise<void> {
    const existing = await table.get(id)
    if (existing === undefined) throw new Error(`${label} 을(를) 찾지 못했습니다: ${id}`)
    const at = stamp()
    await table.put({ ...existing, deleted_at: at, updated_at: at })
  }

  /** 제자리 수정. `id`·`created_at` 은 patch 가 무엇을 담고 있든 지킵니다. */
  async function patchIn<T extends Meta & { id: string }>(
    table: Dexie.Table<T, string>,
    id: string,
    patch: Partial<T>,
    label: string,
  ): Promise<void> {
    const existing = await table.get(id)
    if (existing === undefined) throw new Error(`${label} 을(를) 찾지 못했습니다: ${id}`)
    await table.put({
      ...existing,
      ...patch,
      id: existing.id,
      created_at: existing.created_at,
      deleted_at: existing.deleted_at,
      updated_at: stamp(),
    })
  }

  return {
    pets: {
      async list(): Promise<Pet[]> {
        const rows = await db.pets.toArray()
        return rows.filter(alive)
      },

      async get(id: string): Promise<Pet | undefined> {
        const row = await db.pets.get(id)
        return row !== undefined && alive(row) ? row : undefined
      },

      async create(input: NewPet): Promise<Pet> {
        const at = stamp()
        const pet: Pet = {
          ...input,
          id: crypto.randomUUID(),
          owner_account_id: null,
          created_at: at,
          updated_at: at,
          deleted_at: null,
          recorded_by: null,
        }
        await db.pets.add(pet)
        return pet
      },

      async update(id: string, patch: Partial<Pet>): Promise<void> {
        const existing = await db.pets.get(id)
        if (existing === undefined) throw new Error(`아이를 찾지 못했습니다: ${id}`)
        // id 와 created_at 은 patch 가 무엇을 담고 있든 원본을 지킵니다.
        // 충돌 해소가 updated_at 을 기준으로 하므로(TECH_SPEC 3-3) 여기서
        // 반드시 갱신합니다.
        await db.pets.put({
          ...existing,
          ...patch,
          id: existing.id,
          created_at: existing.created_at,
          deleted_at: existing.deleted_at,
          updated_at: stamp(),
        })
      },

      async softDelete(id: string): Promise<void> {
        const existing = await db.pets.get(id)
        if (existing === undefined) throw new Error(`아이를 찾지 못했습니다: ${id}`)
        const at = stamp()
        await db.pets.put({ ...existing, deleted_at: at, updated_at: at })
      },
    },

    dailyLogs: {
      async getByDate(petId: string, date: DateStr): Promise<DailyLogWithTags | undefined> {
        const row = await db.daily_logs.where('[pet_id+date]').equals([petId, date]).first()
        if (row === undefined || !alive(row)) return undefined
        const [joined] = await withTags([row])
        return joined
      },

      async range(petId: string, from: DateStr, to: DateStr): Promise<DailyLogWithTags[]> {
        const rows = await db.daily_logs
          .where('[pet_id+date]')
          .between([petId, from], [petId, to], true, true)
          .toArray()
        return withTags(rows.filter(alive))
      },

      /**
       * 하루 1건을 지킵니다. 같은 날 다시 부르면 새로 만들지 않고 갱신합니다.
       *
       * 지워진 기록이 남아 있으면 되살립니다. `&[pet_id+date]` 가 유니크라
       * 새 행을 만들면 DB 가 거부하고, 사용자 입장에서는 "지웠던 날을 다시
       * 기록"하는 것이 영영 막히게 됩니다.
       *
       * 태그는 지우고 다시 답니다. 부분 갱신을 하면 화면이 보낸 목록과
       * 저장된 목록이 어긋날 수 있습니다.
       */
      async upsert(petId: string, date: DateStr, input: DailyLogInput): Promise<DailyLog> {
        const { tags, ...fields } = input
        return db.transaction('rw', db.daily_logs, db.daily_log_tags, async () => {
          const existing = await db.daily_logs.where('[pet_id+date]').equals([petId, date]).first()
          const at = stamp()
          let log: DailyLog
          if (existing === undefined) {
            log = {
              ...fields,
              id: crypto.randomUUID(),
              pet_id: petId,
              date,
              created_at: at,
              updated_at: at,
              deleted_at: null,
              recorded_by: null,
            }
            await db.daily_logs.add(log)
          } else {
            log = { ...existing, ...fields, deleted_at: null, updated_at: at }
            await db.daily_logs.put(log)
            await db.daily_log_tags.where('daily_log_id').equals(existing.id).delete()
          }
          const unique = [...new Set(tags)]
          await db.daily_log_tags.bulkAdd(unique.map((tag) => ({ daily_log_id: log.id, tag })))
          return log
        })
      },
    },

    medications: {
      async list(petId: string): Promise<Medication[]> {
        const rows = await db.medications.where('pet_id').equals(petId).toArray()
        return rows.filter(alive).sort((a, b) => a.started_at.localeCompare(b.started_at))
      },

      /**
       * 지금 주고 있는 약. "지금 먹는 약" 목록(PRD FR-9)이 씁니다.
       *
       * `is_active` 만 봅니다. 이 값과 `ended_at` 은 함께 움직입니다 —
       * `stop`·`replaceSchedule` 이 둘을 같이 씁니다. 도메인의
       * `expectedOccurrences` 가 `is_active` 를 보지 않는 것과 짝입니다
       * (handoff/U06.md 의 "결정" 절).
       */
      async listActive(petId: string): Promise<Medication[]> {
        const rows = await db.medications.where('pet_id').equals(petId).toArray()
        return rows
          .filter((row) => alive(row) && row.is_active)
          .sort((a, b) => a.started_at.localeCompare(b.started_at))
      },

      async get(id: string): Promise<Medication | undefined> {
        const row = await db.medications.get(id)
        return row !== undefined && alive(row) ? row : undefined
      },

      /** 종료일과 함께 등록하면 처음부터 비활성입니다. 두 값은 늘 같이 움직입니다. */
      async create(input: NewMedication): Promise<Medication> {
        const medication: Medication = {
          ...input,
          ...freshMeta(),
          id: crypto.randomUUID(),
          is_active: input.ended_at === null,
        }
        await db.medications.add(medication)
        return medication
      },

      /**
       * 오타 수정 등 **스케줄과 무관한** 제자리 수정 (TECH_SPEC 4-3).
       *
       * 타입이 `name`·`dose_text` 만 받습니다. `schedule_times` 를 여기로
       * 흘려보낼 방법이 없어야 append-only 가 실제로 지켜집니다.
       */
      async edit(id: string, patch: MedicationEdit): Promise<void> {
        await patchIn(db.medications, id, patch, '약')
      },

      /**
       * 스케줄 변경. **기존 행을 고치지 않고 닫은 뒤 새 행을 만듭니다**
       * (TECH_SPEC 4-3). 새 행을 돌려줍니다.
       *
       * 요약서의 예정 급여 횟수는 `Medication` 정의에서 역산됩니다. 정의를
       * 소급 수정하면 **과거의 컴플라이언스 수치가 조용히 바뀌고** 진료
       * 문서의 신뢰가 거기서 무너집니다.
       *
       * `endedOn` 이 새 시작일보다 이르지 않으면 던집니다. 두 행의 구간이
       * 겹치면 겹친 날의 예정 급여가 두 배로 세어집니다.
       */
      async replaceSchedule(
        id: string,
        next: { schedule_times: string[]; with_food: Medication['with_food']; started_at: DateStr },
        endedOn: DateStr,
      ): Promise<Medication> {
        if (endedOn >= next.started_at) {
          throw new Error(
            `새 시작일(${next.started_at})은 기존 행의 종료일(${endedOn})보다 뒤여야 합니다`,
          )
        }
        return db.transaction('rw', db.medications, async () => {
          const previous = await db.medications.get(id)
          if (previous === undefined) throw new Error(`약을 찾지 못했습니다: ${id}`)

          const at = stamp()
          await db.medications.put({ ...previous, ended_at: endedOn, is_active: false, updated_at: at })

          const replacement: Medication = {
            ...previous,
            ...next,
            ...freshMeta(),
            id: crypto.randomUUID(),
            ended_at: null,
            is_active: true,
          }
          await db.medications.add(replacement)
          return replacement
        })
      },

      /** 약을 끊습니다. `ended_at` 과 `is_active` 를 함께 씁니다. */
      async stop(id: string, endedOn: DateStr): Promise<void> {
        const existing = await db.medications.get(id)
        if (existing === undefined) throw new Error(`약을 찾지 못했습니다: ${id}`)
        await db.medications.put({
          ...existing,
          ended_at: endedOn,
          is_active: false,
          updated_at: stamp(),
        })
      },
    },

    medicationLogs: {
      /**
       * 예정 급여 1회를 기록합니다 (TECH_SPEC 6).
       *
       * **중복이면 예외를 던지지 않고 결과 타입으로 돌려줍니다.** 화면이
       * "이미 민준님이 8:10에 먹였어요"를 보여줄 수 있어야 하기 때문입니다.
       * 던지면 화면은 실패했다는 것밖에 모릅니다.
       *
       * 먼저 읽어서 흔한 경우를 처리하고, 그 사이에 다른 탭이 끼어들어
       * `&[medication_id+scheduled_at]` 이 물면 그때도 같은 답을 돌려줍니다.
       * 읽기와 쓰기 사이의 틈이 곧 중복 급여이므로 DB 가 마지막 방어선입니다.
       *
       * `at` 은 **실제로 먹인 시각**이고, Meta 의 시각은 주입받은 시계입니다.
       * `given_at` 은 약이 실제로 들어간 경우(`given`·`regiven`)에만 채웁니다 —
       * `skipped` 는 준 적이 없고, `spat_out` 은 뱉어서 들어가지 않았습니다.
       */
      async record(occurrence: Occurrence, status: MedStatus, at: Date): Promise<RecordResult> {
        const key: [string, string] = [occurrence.medicationId, occurrence.scheduledAt]

        const found = await db.medication_logs.where('[medication_id+scheduled_at]').equals(key).first()
        if (found !== undefined) return { ok: false, reason: 'already_recorded', existing: found }

        const medication = await db.medications.get(occurrence.medicationId)
        if (medication === undefined) {
          throw new Error(`약을 찾지 못했습니다: ${occurrence.medicationId}`)
        }

        const log: MedicationLog = {
          ...freshMeta(),
          id: crypto.randomUUID(),
          medication_id: occurrence.medicationId,
          // 비정규화. 기간 조회를 단일 인덱스로 처리합니다 (TECH_SPEC 4-2).
          pet_id: medication.pet_id,
          scheduled_at: occurrence.scheduledAt,
          given_at: status === 'given' || status === 'regiven' ? at.toISOString() : null,
          status,
          note: null,
        }

        try {
          await db.medication_logs.add(log)
        } catch (cause) {
          if (!isConstraintError(cause)) throw cause
          const raced = await db.medication_logs.where('[medication_id+scheduled_at]').equals(key).first()
          /* v8 ignore next */
          if (raced === undefined) throw cause
          return { ok: false, reason: 'already_recorded', existing: raced }
        }
        return { ok: true, log }
      },

      /**
       * 기간 안의 급여 기록. `from`·`to` 는 순간이고 양끝을 포함합니다.
       *
       * `scheduled_at` 인덱스로 훑고 아이로 거릅니다. 복합 인덱스
       * `[pet_id+scheduled_at]` 이 없는 것은 TECH_SPEC 4 의 스키마 그대로라
       * 그렇습니다. 기기 하나에 아이가 몇 마리뿐이라 문제되지 않습니다.
       */
      async range(petId: string, from: Date, to: Date): Promise<MedicationLog[]> {
        const rows = await db.medication_logs
          .where('scheduled_at')
          .between(from.toISOString(), to.toISOString(), true, true)
          .toArray()
        return rows
          .filter((row) => row.pet_id === petId && alive(row))
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      },
    },

    weights: {
      async range(petId: string, from: DateStr, to: DateStr): Promise<WeightRecord[]> {
        const rows = await db.weights
          .where('[pet_id+date]')
          .between([petId, from], [petId, to], true, true)
          .toArray()
        return rows.filter(alive)
      },

      /** 가장 최근에 잰 체중. 요약서의 변화율이 이 값에서 시작합니다. */
      async latest(petId: string): Promise<WeightRecord | undefined> {
        const rows = await db.weights.where('pet_id').equals(petId).toArray()
        const living = rows.filter(alive).sort((a, b) => a.date.localeCompare(b.date))
        return living.at(-1)
      },

      /**
       * 하루 1건을 지킵니다. `&[pet_id+date]` 가 유니크라 같은 날 두 번째
       * 행을 만들 수 없습니다. 지워진 기록이 남아 있으면 되살립니다 —
       * 그러지 않으면 지웠던 날짜를 영영 다시 잴 수 없습니다
       * (`dailyLogs.upsert` 와 같은 이유).
       */
      async upsert(petId: string, input: NewWeight): Promise<WeightRecord> {
        return db.transaction('rw', db.weights, async () => {
          const existing = await db.weights
            .where('[pet_id+date]')
            .equals([petId, input.date])
            .first()
          if (existing === undefined) {
            const row: WeightRecord = {
              ...freshMeta(),
              id: crypto.randomUUID(),
              pet_id: petId,
              date: input.date,
              weight_g: input.weight_g,
            }
            await db.weights.add(row)
            return row
          }
          const row: WeightRecord = {
            ...existing,
            weight_g: input.weight_g,
            deleted_at: null,
            updated_at: stamp(),
          }
          await db.weights.put(row)
          return row
        })
      },

      async softDelete(id: string): Promise<void> {
        await softDeleteIn(db.weights, id, '체중 기록')
      },
    },

    clinics: {
      async list(petId: string): Promise<Clinic[]> {
        const rows = await db.clinics.where('pet_id').equals(petId).toArray()
        return rows.filter(alive)
      },

      /**
       * 우리 병원. 원터치 전화가 이 값을 씁니다 (PRD FR-9).
       *
       * `is_primary` 가 참인 것이 둘 이상이면 먼저 등록한 것을 돌려줍니다.
       * **하나만 남기는 것은 여기서 강제하지 않습니다** — 병원 화면(P1)이
       * 정할 규칙이고 명세서에 없습니다.
       */
      async primary(petId: string): Promise<Clinic | undefined> {
        const rows = await db.clinics.where('pet_id').equals(petId).toArray()
        return rows
          .filter((row) => alive(row) && row.is_primary)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      },

      async create(input: Omit<Clinic, 'id' | keyof Meta>): Promise<Clinic> {
        const clinic: Clinic = { ...input, ...freshMeta(), id: crypto.randomUUID() }
        await db.clinics.add(clinic)
        return clinic
      },

      async update(id: string, patch: Partial<Clinic>): Promise<void> {
        await patchIn(db.clinics, id, patch, '병원')
      },

      async softDelete(id: string): Promise<void> {
        await softDeleteIn(db.clinics, id, '병원')
      },
    },

    clinicVisits: {
      /** 최근 방문이 앞입니다. 병원 탭의 진료 이력이 이 순서로 그려집니다. */
      async list(petId: string): Promise<ClinicVisit[]> {
        const rows = await db.clinic_visits.where('pet_id').equals(petId).toArray()
        return rows.filter(alive).sort((a, b) => b.visited_on.localeCompare(a.visited_on))
      },

      async create(input: Omit<ClinicVisit, 'id' | keyof Meta>): Promise<ClinicVisit> {
        const visit: ClinicVisit = { ...input, ...freshMeta(), id: crypto.randomUUID() }
        await db.clinic_visits.add(visit)
        return visit
      },

      async update(id: string, patch: Partial<ClinicVisit>): Promise<void> {
        await patchIn(db.clinic_visits, id, patch, '진료 기록')
      },

      async softDelete(id: string): Promise<void> {
        await softDeleteIn(db.clinic_visits, id, '진료 기록')
      },
    },

    careManual: {
      async list(petId: string): Promise<CareManualItem[]> {
        const rows = await db.care_manual.where('pet_id').equals(petId).toArray()
        return rows.filter(alive)
      },

      /**
       * 항목 1개는 `&[pet_id+key]` 로 하나뿐이라 만들기와 고치기를 나눌
       * 이유가 없습니다. 지워진 항목은 되살립니다.
       */
      async put(petId: string, key: ManualKey, valueText: string): Promise<CareManualItem> {
        return db.transaction('rw', db.care_manual, async () => {
          const existing = await db.care_manual.where('[pet_id+key]').equals([petId, key]).first()
          if (existing === undefined) {
            const item: CareManualItem = {
              ...freshMeta(),
              id: crypto.randomUUID(),
              pet_id: petId,
              key,
              value_text: valueText,
            }
            await db.care_manual.add(item)
            return item
          }
          const item: CareManualItem = {
            ...existing,
            value_text: valueText,
            deleted_at: null,
            updated_at: stamp(),
          }
          await db.care_manual.put(item)
          return item
        })
      },

      async softDelete(id: string): Promise<void> {
        await softDeleteIn(db.care_manual, id, '케어 매뉴얼 항목')
      },
    },

    questions: {
      async list(petId: string): Promise<Question[]> {
        const rows = await db.questions.where('pet_id').equals(petId).toArray()
        return rows.filter(alive).sort((a, b) => a.created_at.localeCompare(b.created_at))
      },

      /** 아직 해소되지 않은 것만. 통화 직전 화면이 씁니다 (PRD FR-9). */
      async listOpen(petId: string): Promise<Question[]> {
        const rows = await db.questions.where('pet_id').equals(petId).toArray()
        return rows
          .filter((row) => alive(row) && row.resolved_at === null)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
      },

      async create(petId: string, text: string): Promise<Question> {
        const question: Question = {
          ...freshMeta(),
          id: crypto.randomUUID(),
          pet_id: petId,
          text,
          resolved_at: null,
        }
        await db.questions.add(question)
        return question
      },

      /** 물어봤다고 표시합니다. 지우는 것이 아니라 닫는 것입니다. */
      async resolve(id: string, at: Date): Promise<void> {
        const existing = await db.questions.get(id)
        if (existing === undefined) throw new Error(`질문을 찾지 못했습니다: ${id}`)
        await db.questions.put({
          ...existing,
          resolved_at: at.toISOString(),
          updated_at: stamp(),
        })
      },

      async softDelete(id: string): Promise<void> {
        await softDeleteIn(db.questions, id, '질문')
      },
    },

    photos: {
      /** 원본을 그대로 담습니다. 리사이즈·용량 제한은 U10 의 몫입니다. */
      async put(petId: string, file: File): Promise<string> {
        const id = crypto.randomUUID()
        const { width, height } = await measure(file)
        await db.photos.add({ id, pet_id: petId, blob: file, width, height })
        return id
      },

      /**
       * 부르는 쪽이 다 쓰고 `URL.revokeObjectURL` 해야 합니다.
       * 안 하면 탭이 살아 있는 동안 Blob 이 메모리에 남습니다.
       */
      async url(id: string): Promise<string> {
        const photo = await db.photos.get(id)
        if (photo === undefined) throw new Error(`사진을 찾지 못했습니다: ${id}`)
        return URL.createObjectURL(photo.blob)
      },
    },

    settings: {
      async get<K extends SettingKey>(key: K): Promise<SettingValue<K> | undefined> {
        const row = await db.settings.get(key)
        // 키가 값의 타입을 결정하는 것은 Setting 유니온이 보장합니다.
        // Dexie 는 테이블 전체의 유니온을 돌려주므로 여기서 좁힙니다.
        return row === undefined ? undefined : (row.value as SettingValue<K>)
      },

      async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
        await db.settings.put({ key, value } as Setting)
      },
    },
  }
}
