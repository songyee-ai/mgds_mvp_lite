/**
 * LocalRepo 의 계약 (TECH_SPEC 6). U05 가 4개 네임스페이스, U07 이 나머지.
 *
 * 시계를 주입해서 Meta 의 시각을 눈금으로 확인합니다. `new Date()` 를
 * 그대로 쓰면 "updated_at 이 갱신되었다"를 밀리초 경합에 맡기게 됩니다.
 */

import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import localRepoSource from '../src/data/repo/local.ts?raw'
import {
  createDb,
  createLocalRepo,
  type Clinic,
  type ClinicVisit,
  type DailyLogInput,
  type Meta,
  type NewMedication,
  type NewPet,
  type Occurrence,
  type Repo,
  type Tables,
} from '../src/data'

const NEW_PET: NewPet = {
  name: '보리',
  photo_id: null,
  species: 'dog',
  species_other_label: null,
  breed: '믹스',
  sex: 'female',
  neutered: true,
  birth_date: '2013-04-20',
  birth_is_approximate: false,
  adopted_at: '2013-06-15',
}

const INPUT: DailyLogInput = {
  meal: 'ate_all',
  water: 'normal',
  energy: 'normal',
  toilet: 'normal',
  overall: 'good',
  memo: null,
  tags: [],
}

const NEW_MED: NewMedication = {
  pet_id: 'pet-1',
  name: '아모디핀',
  dose_text: '1/2정',
  schedule_times: ['08:00', '20:00'],
  with_food: 'after',
  started_at: '2026-09-01',
  ended_at: null,
}

const NEW_CLINIC: Omit<Clinic, 'id' | keyof Meta> = {
  pet_id: 'pet-1',
  name: '행복동물병원',
  phone: '02-000-0000',
  address: null,
  lat: null,
  lng: null,
  is_primary: true,
}

const NEW_VISIT: Omit<ClinicVisit, 'id' | keyof Meta> = {
  pet_id: 'pet-1',
  clinic_id: null,
  visited_on: '2026-09-01',
  next_scheduled_on: null,
  summary_text: null,
}

const OCCURRENCE: Occurrence = {
  medicationId: 'med-1',
  scheduledAt: '2026-09-08T23:00:00.000Z',
  localTime: '08:00',
}

/**
 * "없는 것을 고치려 했다"는 실패는 완성도 검사에서 통과로 봅니다.
 * 여기서 묻는 것은 "구현되어 있는가"이지 "빈 DB 에서 성공하는가"가 아닙니다.
 * 미구현이었다면 메시지가 `U07:` 로 시작합니다.
 */
const nonBlocking = (cause: unknown): unknown => {
  if (cause instanceof Error && cause.message.startsWith('U07:')) throw cause
  return null
}

/** 부를 때마다 1분씩 흐르는 시계. */
function ticking(start = '2026-09-09T00:00:00.000Z'): () => Date {
  let step = 0
  return () => {
    const at = new Date(new Date(start).getTime() + step * 60_000)
    step += 1
    return at
  }
}

let open: (Dexie & Tables) | null = null
let counter = 0

async function fresh(clock = ticking()): Promise<{ db: Dexie & Tables; repo: Repo }> {
  counter += 1
  const db = createDb(`mgds-repo-${counter}`)
  await db.open()
  open = db
  return { db, repo: createLocalRepo(db, clock) }
}

afterEach(async () => {
  if (open !== null) {
    await open.delete()
    open = null
  }
})

describe('pets', () => {
  it('create 가 id 와 Meta 를 채운다', async () => {
    const { repo } = await fresh()
    const pet = await repo.pets.create(NEW_PET)

    expect(pet.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(pet.owner_account_id).toBeNull()
    expect(pet.recorded_by).toBeNull()
    expect(pet.deleted_at).toBeNull()
    expect(pet.created_at).toBe('2026-09-09T00:00:00.000Z')
    expect(pet.updated_at).toBe(pet.created_at)
  })

  it('adopted_at 을 저장하고 되읽는다 (U04 T3 결정)', async () => {
    const { repo } = await fresh()
    const pet = await repo.pets.create(NEW_PET)
    expect((await repo.pets.get(pet.id))?.adopted_at).toBe('2013-06-15')

    // 입양일은 선택 항목입니다. 건너뛰면 null 입니다.
    const skipped = await repo.pets.create({ ...NEW_PET, adopted_at: null })
    expect((await repo.pets.get(skipped.id))?.adopted_at).toBeNull()
  })

  it('update 가 updated_at 을 갱신하고 created_at 을 보존한다', async () => {
    const { repo } = await fresh()
    const pet = await repo.pets.create(NEW_PET)
    await repo.pets.update(pet.id, { name: '보리야' })

    const after = await repo.pets.get(pet.id)
    expect(after?.name).toBe('보리야')
    expect(after?.created_at).toBe(pet.created_at)
    expect(after?.updated_at).toBe('2026-09-09T00:01:00.000Z')
  })

  it('update 가 patch 로 넘어온 id·created_at 을 무시한다', async () => {
    const { repo } = await fresh()
    const pet = await repo.pets.create(NEW_PET)
    await repo.pets.update(pet.id, {
      id: 'somebody-else',
      created_at: '1999-01-01T00:00:00.000Z',
      name: '보리야',
    })

    expect(await repo.pets.get('somebody-else')).toBeUndefined()
    const after = await repo.pets.get(pet.id)
    expect(after?.created_at).toBe(pet.created_at)
    expect(after?.name).toBe('보리야')
  })

  it('soft delete 한 아이는 조회에서 빠지지만 행은 남는다', async () => {
    const { db, repo } = await fresh()
    const pet = await repo.pets.create(NEW_PET)
    await repo.pets.softDelete(pet.id)

    expect(await repo.pets.get(pet.id)).toBeUndefined()
    expect(await repo.pets.list()).toEqual([])

    const raw = await db.pets.get(pet.id)
    expect(raw?.deleted_at).toBe('2026-09-09T00:01:00.000Z')
    expect(raw?.updated_at).toBe(raw?.deleted_at)
  })

  it('없는 아이를 고치거나 지우면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.pets.update('없음', { name: 'x' })).rejects.toThrow(/없음/)
    await expect(repo.pets.softDelete('없음')).rejects.toThrow(/없음/)
  })
})

describe('dailyLogs', () => {
  it('upsert 가 같은 날 재호출 시 갱신한다 (중복 생성 아님)', async () => {
    const { db, repo } = await fresh()
    const first = await repo.dailyLogs.upsert('pet-1', '2026-09-09', INPUT)
    const second = await repo.dailyLogs.upsert('pet-1', '2026-09-09', {
      ...INPUT,
      overall: 'hard',
      memo: '오늘은 힘들었다',
    })

    expect(second.id).toBe(first.id)
    expect(await db.daily_logs.count()).toBe(1)
    expect(second.overall).toBe('hard')
    expect(second.memo).toBe('오늘은 힘들었다')
  })

  it('upsert 가 created_at 을 보존하고 updated_at 만 올린다', async () => {
    const { repo } = await fresh()
    const first = await repo.dailyLogs.upsert('pet-1', '2026-09-09', INPUT)
    const second = await repo.dailyLogs.upsert('pet-1', '2026-09-09', INPUT)

    expect(second.created_at).toBe(first.created_at)
    expect(second.updated_at).not.toBe(first.updated_at)
    expect(second.updated_at).toBe('2026-09-09T00:01:00.000Z')
  })

  it('태그를 지우고 다시 단다', async () => {
    const { db, repo } = await fresh()
    await repo.dailyLogs.upsert('pet-1', '2026-09-09', { ...INPUT, tags: ['기침', '구토'] })
    expect((await repo.dailyLogs.getByDate('pet-1', '2026-09-09'))?.tags.sort()).toEqual([
      '구토',
      '기침',
    ])

    await repo.dailyLogs.upsert('pet-1', '2026-09-09', { ...INPUT, tags: ['떨림'] })
    expect((await repo.dailyLogs.getByDate('pet-1', '2026-09-09'))?.tags).toEqual(['떨림'])
    expect(await db.daily_log_tags.count()).toBe(1)
  })

  it('같은 태그를 두 번 넘겨도 한 번만 붙는다', async () => {
    const { db, repo } = await fresh()
    await repo.dailyLogs.upsert('pet-1', '2026-09-09', { ...INPUT, tags: ['기침', '기침'] })
    expect(await db.daily_log_tags.count()).toBe(1)
  })

  it('지운 날을 다시 기록하면 되살린다', async () => {
    const { db, repo } = await fresh()
    const first = await repo.dailyLogs.upsert('pet-1', '2026-09-09', INPUT)
    await db.daily_logs.update(first.id, { deleted_at: '2026-09-09T05:00:00.000Z' })
    expect(await repo.dailyLogs.getByDate('pet-1', '2026-09-09')).toBeUndefined()

    // 유니크 제약 때문에 새 행을 만들 수 없습니다. 되살리지 않으면
    // 사용자는 그 날짜를 영영 다시 기록하지 못합니다.
    const revived = await repo.dailyLogs.upsert('pet-1', '2026-09-09', INPUT)
    expect(revived.id).toBe(first.id)
    expect(revived.deleted_at).toBeNull()
    expect(await db.daily_logs.count()).toBe(1)
  })

  it('range 가 경계를 포함하고 지운 기록을 뺀다', async () => {
    const { db, repo } = await fresh()
    for (const date of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10']) {
      await repo.dailyLogs.upsert('pet-1', date, INPUT)
    }
    await repo.dailyLogs.upsert('pet-2', '2026-09-08', INPUT)

    const all = await repo.dailyLogs.range('pet-1', '2026-09-07', '2026-09-10')
    expect(all.map((row) => row.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
    ])

    const middle = await repo.dailyLogs.range('pet-1', '2026-09-08', '2026-09-09')
    expect(middle.map((row) => row.date)).toEqual(['2026-09-08', '2026-09-09'])

    const target = await db.daily_logs.where('[pet_id+date]').equals(['pet-1', '2026-09-08']).first()
    await db.daily_logs.update(target!.id, { deleted_at: '2026-09-11T00:00:00.000Z' })
    const afterDelete = await repo.dailyLogs.range('pet-1', '2026-09-07', '2026-09-10')
    expect(afterDelete.map((row) => row.date)).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-10',
    ])
  })

  it('기록이 없는 날은 undefined 다', async () => {
    const { repo } = await fresh()
    expect(await repo.dailyLogs.getByDate('pet-1', '2026-09-09')).toBeUndefined()
    expect(await repo.dailyLogs.range('pet-1', '2026-01-01', '2026-12-31')).toEqual([])
  })
})

describe('settings', () => {
  it('키마다 값을 넣고 뺀다', async () => {
    const { repo } = await fresh()
    expect(await repo.settings.get('guardian_name')).toBeUndefined()

    await repo.settings.set('guardian_name', '김보호')
    await repo.settings.set('condition_reminder_time', '20:00')
    await repo.settings.set('onboarding_reasons', ['약을 자꾸 잊어서'])

    expect(await repo.settings.get('guardian_name')).toBe('김보호')
    expect(await repo.settings.get('condition_reminder_time')).toBe('20:00')
    expect(await repo.settings.get('onboarding_reasons')).toEqual(['약을 자꾸 잊어서'])
  })

  it('같은 키를 다시 넣으면 덮어쓴다', async () => {
    const { db, repo } = await fresh()
    await repo.settings.set('guardian_name', '김보호')
    await repo.settings.set('guardian_name', '이보호')
    expect(await repo.settings.get('guardian_name')).toBe('이보호')
    expect(await db.settings.count()).toBe(1)
  })
})

describe('photos', () => {
  it('Blob 을 담고 id 로 되찾는다', async () => {
    const { db, repo } = await fresh()
    const file = new File(['not-really-a-jpeg'], 'bori.jpg', { type: 'image/jpeg' })
    const id = await repo.photos.put('pet-1', file)

    const stored = await db.photos.get(id)
    expect(stored?.pet_id).toBe('pet-1')
    expect(await stored?.blob.text()).toBe('not-really-a-jpeg')
  })

  it('없는 사진을 찾으면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.photos.url('없음')).rejects.toThrow(/없음/)
  })
})

describe('Repo 완성도 (U07 완료 판정 3)', () => {
  /**
   * U05 는 이 자리에서 미구현 30개가 던지는지 셌습니다. U07 이 전부
   * 채웠으므로 질문이 뒤집힙니다 — **아무것도 던지지 않는가.**
   *
   * 42개를 하나씩 실제로 부릅니다. 개수만 세면 이름만 있고 몸통이 없는
   * 메서드를 놓칩니다.
   */
  const calls: [string, (repo: Repo) => Promise<unknown>][] = [
    ['pets.list', (r) => r.pets.list()],
    ['pets.get', (r) => r.pets.get('x')],
    ['pets.create', (r) => r.pets.create(NEW_PET)],
    ['pets.update', (r) => r.pets.update('x', {}).catch(nonBlocking)],
    ['pets.softDelete', (r) => r.pets.softDelete('x').catch(nonBlocking)],
    ['dailyLogs.getByDate', (r) => r.dailyLogs.getByDate('p', '2026-09-09')],
    ['dailyLogs.range', (r) => r.dailyLogs.range('p', '2026-09-01', '2026-09-30')],
    ['dailyLogs.upsert', (r) => r.dailyLogs.upsert('p', '2026-09-09', INPUT)],
    ['medications.list', (r) => r.medications.list('p')],
    ['medications.listActive', (r) => r.medications.listActive('p')],
    ['medications.get', (r) => r.medications.get('x')],
    ['medications.create', (r) => r.medications.create(NEW_MED)],
    ['medications.edit', (r) => r.medications.edit('x', {}).catch(nonBlocking)],
    [
      'medications.replaceSchedule',
      (r) =>
        r.medications
          .replaceSchedule('x', { schedule_times: ['08:00'], with_food: 'after', started_at: '2026-09-10' }, '2026-09-09')
          .catch(nonBlocking),
    ],
    ['medications.stop', (r) => r.medications.stop('x', '2026-09-09').catch(nonBlocking)],
    ['medicationLogs.record', (r) => r.medicationLogs.record(OCCURRENCE, 'given', new Date()).catch(nonBlocking)],
    ['medicationLogs.range', (r) => r.medicationLogs.range('p', new Date(0), new Date())],
    ['weights.range', (r) => r.weights.range('p', '2026-09-01', '2026-09-30')],
    ['weights.latest', (r) => r.weights.latest('p')],
    ['weights.upsert', (r) => r.weights.upsert('p', { date: '2026-09-09', weight_g: 6200 })],
    ['weights.softDelete', (r) => r.weights.softDelete('x').catch(nonBlocking)],
    ['clinics.list', (r) => r.clinics.list('p')],
    ['clinics.primary', (r) => r.clinics.primary('p')],
    ['clinics.create', (r) => r.clinics.create(NEW_CLINIC)],
    ['clinics.update', (r) => r.clinics.update('x', {}).catch(nonBlocking)],
    ['clinics.softDelete', (r) => r.clinics.softDelete('x').catch(nonBlocking)],
    ['clinicVisits.list', (r) => r.clinicVisits.list('p')],
    ['clinicVisits.create', (r) => r.clinicVisits.create(NEW_VISIT)],
    ['clinicVisits.update', (r) => r.clinicVisits.update('x', {}).catch(nonBlocking)],
    ['clinicVisits.softDelete', (r) => r.clinicVisits.softDelete('x').catch(nonBlocking)],
    ['careManual.list', (r) => r.careManual.list('p')],
    ['careManual.put', (r) => r.careManual.put('p', 'fears', '천둥')],
    ['careManual.softDelete', (r) => r.careManual.softDelete('x').catch(nonBlocking)],
    ['questions.list', (r) => r.questions.list('p')],
    ['questions.listOpen', (r) => r.questions.listOpen('p')],
    ['questions.create', (r) => r.questions.create('p', '밥을 안 먹어요')],
    ['questions.resolve', (r) => r.questions.resolve('x', new Date()).catch(nonBlocking)],
    ['questions.softDelete', (r) => r.questions.softDelete('x').catch(nonBlocking)],
    ['photos.put', (r) => r.photos.put('p', new File(['x'], 'x.jpg'))],
    ['photos.url', (r) => r.photos.url('x').catch(nonBlocking)],
    ['settings.get', (r) => r.settings.get('guardian_name')],
    ['settings.set', (r) => r.settings.set('guardian_name', '김보호')],
  ]

  it.each(calls)('%s 가 U07 이라고 던지지 않는다', async (_member, call) => {
    const { repo } = await fresh()
    await expect(call(repo)).resolves.not.toThrow()
  })

  it('던지는 자리가 소스에 남아 있지 않다', () => {
    const source = localRepoSource
    // 먼저 소스를 진짜로 읽었는지 확인합니다. 빈 문자열이면 아래 두 줄이
    // 아무것도 검사하지 않으면서 통과합니다.
    expect(source).toMatch(/export function createLocalRepo/)
    expect(source).not.toMatch(/notYet/)
    expect(source).not.toMatch(/U07:/)
  })

  it('인터페이스의 11개 네임스페이스가 전부 있다', async () => {
    const { repo } = await fresh()
    expect(Object.keys(repo).sort()).toEqual(
      [
        'careManual',
        'clinicVisits',
        'clinics',
        'dailyLogs',
        'medicationLogs',
        'medications',
        'pets',
        'photos',
        'questions',
        'settings',
        'weights',
      ].sort(),
    )
  })
})
