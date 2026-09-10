/**
 * U07 이 채운 나머지 — 체중 · 병원 · 진료 이력 · 케어 매뉴얼 · 질문.
 *
 * 공통 계약 3개를 각 네임스페이스에서 확인합니다.
 * (1) 유니크 제약이 있는 곳은 갱신하고 되살린다
 * (2) soft delete 는 조회에서만 빼고 행은 남긴다
 * (3) `created_at` 보존 · `updated_at` 갱신
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import {
  createDb,
  createLocalRepo,
  type Clinic,
  type ClinicVisit,
  type Meta,
  type Repo,
  type Tables,
} from '../src/data'

const NEW_CLINIC: Omit<Clinic, 'id' | keyof Meta> = {
  pet_id: 'pet-1',
  name: '행복동물병원',
  phone: '02-000-0000',
  address: '서울시 어딘가',
  lat: null,
  lng: null,
  is_primary: true,
}

const NEW_VISIT: Omit<ClinicVisit, 'id' | keyof Meta> = {
  pet_id: 'pet-1',
  clinic_id: null,
  visited_on: '2026-09-01',
  next_scheduled_on: '2026-09-20',
  summary_text: null,
}

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

async function fresh(): Promise<{ db: Dexie & Tables; repo: Repo }> {
  counter += 1
  const db = createDb(`mgds-rec-${counter}`)
  await db.open()
  open = db
  return { db, repo: createLocalRepo(db, ticking()) }
}

afterEach(async () => {
  if (open !== null) {
    await open.delete()
    open = null
  }
})

describe('weights', () => {
  it('같은 날 두 번 입력하면 갱신한다 (새 행 아님)', async () => {
    const { db, repo } = await fresh()
    const first = await repo.weights.upsert('pet-1', { date: '2026-09-09', weight_g: 6200 })
    const second = await repo.weights.upsert('pet-1', { date: '2026-09-09', weight_g: 6150 })

    expect(second.id).toBe(first.id)
    expect(second.weight_g).toBe(6150)
    expect(await db.weights.count()).toBe(1)
    expect(second.created_at).toBe(first.created_at)
    expect(second.updated_at).not.toBe(first.updated_at)
  })

  it('지운 날을 다시 재면 되살린다', async () => {
    const { db, repo } = await fresh()
    const first = await repo.weights.upsert('pet-1', { date: '2026-09-09', weight_g: 6200 })
    await repo.weights.softDelete(first.id)
    expect(await repo.weights.range('pet-1', '2026-09-01', '2026-09-30')).toEqual([])

    // &[pet_id+date] 가 유니크라 새 행을 만들 수 없습니다.
    const revived = await repo.weights.upsert('pet-1', { date: '2026-09-09', weight_g: 6100 })
    expect(revived.id).toBe(first.id)
    expect(revived.deleted_at).toBeNull()
    expect(revived.weight_g).toBe(6100)
    expect(await db.weights.count()).toBe(1)
  })

  it('soft delete 는 행을 남긴다', async () => {
    const { db, repo } = await fresh()
    const row = await repo.weights.upsert('pet-1', { date: '2026-09-09', weight_g: 6200 })
    await repo.weights.softDelete(row.id)

    expect(await db.weights.count()).toBe(1)
    expect((await db.weights.get(row.id))?.deleted_at).not.toBeNull()
  })

  it('latest 가 가장 최근에 잰 값이다', async () => {
    const { repo } = await fresh()
    for (const [date, grams] of [
      ['2026-09-01', 6300],
      ['2026-09-15', 6100],
      ['2026-09-08', 6200],
    ] as const) {
      await repo.weights.upsert('pet-1', { date, weight_g: grams })
    }
    // 넣은 순서가 아니라 날짜 순서입니다.
    expect((await repo.weights.latest('pet-1'))?.date).toBe('2026-09-15')
  })

  it('latest 가 지운 기록을 건너뛴다', async () => {
    const { repo } = await fresh()
    await repo.weights.upsert('pet-1', { date: '2026-09-01', weight_g: 6300 })
    const newest = await repo.weights.upsert('pet-1', { date: '2026-09-15', weight_g: 6100 })
    await repo.weights.softDelete(newest.id)

    expect((await repo.weights.latest('pet-1'))?.date).toBe('2026-09-01')
  })

  it('기록이 없으면 latest 가 undefined 다', async () => {
    const { repo } = await fresh()
    expect(await repo.weights.latest('pet-1')).toBeUndefined()
  })

  it('range 가 경계를 포함하고 다른 아이를 뺀다', async () => {
    const { repo } = await fresh()
    for (const date of ['2026-08-31', '2026-09-01', '2026-09-15', '2026-09-16']) {
      await repo.weights.upsert('pet-1', { date, weight_g: 6200 })
    }
    await repo.weights.upsert('pet-2', { date: '2026-09-01', weight_g: 3000 })

    const rows = await repo.weights.range('pet-1', '2026-09-01', '2026-09-15')
    expect(rows.map((row) => row.date)).toEqual(['2026-09-01', '2026-09-15'])
  })
})

describe('clinics', () => {
  it('create 가 id 와 Meta 를 채운다', async () => {
    const { repo } = await fresh()
    const clinic = await repo.clinics.create(NEW_CLINIC)

    expect(clinic.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(clinic.name).toBe('행복동물병원')
    expect(clinic.deleted_at).toBeNull()
    expect(clinic.created_at).toBe('2026-09-09T00:00:00.000Z')
  })

  it('primary 가 우리 병원을 돌려준다', async () => {
    const { repo } = await fresh()
    await repo.clinics.create({ ...NEW_CLINIC, name: '다른 병원', is_primary: false })
    await repo.clinics.create(NEW_CLINIC)

    expect((await repo.clinics.primary('pet-1'))?.name).toBe('행복동물병원')
  })

  it('우리 병원이 없으면 undefined 다', async () => {
    const { repo } = await fresh()
    await repo.clinics.create({ ...NEW_CLINIC, is_primary: false })
    expect(await repo.clinics.primary('pet-1')).toBeUndefined()
  })

  it('지운 병원은 primary 로 나오지 않는다', async () => {
    const { repo } = await fresh()
    const clinic = await repo.clinics.create(NEW_CLINIC)
    await repo.clinics.softDelete(clinic.id)

    expect(await repo.clinics.primary('pet-1')).toBeUndefined()
    expect(await repo.clinics.list('pet-1')).toEqual([])
  })

  it('update 가 created_at 을 보존한다', async () => {
    const { repo } = await fresh()
    const clinic = await repo.clinics.create(NEW_CLINIC)
    await repo.clinics.update(clinic.id, { phone: '02-111-1111' })

    const after = (await repo.clinics.list('pet-1'))[0]
    expect(after?.phone).toBe('02-111-1111')
    expect(after?.created_at).toBe(clinic.created_at)
    expect(after?.updated_at).not.toBe(clinic.updated_at)
  })

  it('없는 병원을 고치거나 지우면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.clinics.update('없음', {})).rejects.toThrow(/없음/)
    await expect(repo.clinics.softDelete('없음')).rejects.toThrow(/없음/)
  })
})

describe('clinicVisits', () => {
  it('최근 방문이 앞에 온다', async () => {
    const { repo } = await fresh()
    for (const visited of ['2026-03-01', '2026-09-01', '2026-06-01']) {
      await repo.clinicVisits.create({ ...NEW_VISIT, visited_on: visited })
    }
    expect((await repo.clinicVisits.list('pet-1')).map((v) => v.visited_on)).toEqual([
      '2026-09-01',
      '2026-06-01',
      '2026-03-01',
    ])
  })

  it('update 로 다음 예정일을 고칠 수 있다', async () => {
    const { repo } = await fresh()
    const visit = await repo.clinicVisits.create(NEW_VISIT)
    await repo.clinicVisits.update(visit.id, { next_scheduled_on: '2026-10-01' })

    expect((await repo.clinicVisits.list('pet-1'))[0]?.next_scheduled_on).toBe('2026-10-01')
  })

  it('soft delete 가 목록에서 뺀다', async () => {
    const { db, repo } = await fresh()
    const visit = await repo.clinicVisits.create(NEW_VISIT)
    await repo.clinicVisits.softDelete(visit.id)

    expect(await repo.clinicVisits.list('pet-1')).toEqual([])
    expect(await db.clinic_visits.count()).toBe(1)
  })

  it('없는 진료 기록을 고치거나 지우면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.clinicVisits.update('없음', {})).rejects.toThrow(/없음/)
    await expect(repo.clinicVisits.softDelete('없음')).rejects.toThrow(/없음/)
  })
})

describe('careManual', () => {
  it('같은 key 를 다시 넣으면 갱신한다 (새 행 아님)', async () => {
    const { db, repo } = await fresh()
    const first = await repo.careManual.put('pet-1', 'fears', '천둥')
    const second = await repo.careManual.put('pet-1', 'fears', '천둥, 청소기')

    expect(second.id).toBe(first.id)
    expect(second.value_text).toBe('천둥, 청소기')
    expect(await db.care_manual.count()).toBe(1)
    expect(second.created_at).toBe(first.created_at)
  })

  it('key 가 다르면 별개 항목이다', async () => {
    const { repo } = await fresh()
    await repo.careManual.put('pet-1', 'fears', '천둥')
    await repo.careManual.put('pet-1', 'med_method', '츄르에 싸서')

    expect((await repo.careManual.list('pet-1')).map((item) => item.key).sort()).toEqual([
      'fears',
      'med_method',
    ])
  })

  it('지운 항목을 다시 넣으면 되살린다', async () => {
    const { db, repo } = await fresh()
    const first = await repo.careManual.put('pet-1', 'fears', '천둥')
    await repo.careManual.softDelete(first.id)
    expect(await repo.careManual.list('pet-1')).toEqual([])

    // &[pet_id+key] 가 유니크라 새 행을 만들 수 없습니다.
    const revived = await repo.careManual.put('pet-1', 'fears', '천둥')
    expect(revived.id).toBe(first.id)
    expect(revived.deleted_at).toBeNull()
    expect(await db.care_manual.count()).toBe(1)
  })

  it('아이가 다르면 같은 key 를 쓸 수 있다', async () => {
    const { repo } = await fresh()
    await repo.careManual.put('pet-1', 'fears', '천둥')
    await repo.careManual.put('pet-2', 'fears', '자동차')

    expect((await repo.careManual.list('pet-1'))[0]?.value_text).toBe('천둥')
    expect((await repo.careManual.list('pet-2'))[0]?.value_text).toBe('자동차')
  })

  it('없는 항목을 지우면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.careManual.softDelete('없음')).rejects.toThrow(/없음/)
  })
})

describe('questions', () => {
  it('만든 순서대로 나온다', async () => {
    const { repo } = await fresh()
    await repo.questions.create('pet-1', '밥을 안 먹어요')
    await repo.questions.create('pet-1', '밤에 서성여요')

    expect((await repo.questions.list('pet-1')).map((q) => q.text)).toEqual([
      '밥을 안 먹어요',
      '밤에 서성여요',
    ])
  })

  it('resolve 는 지우는 것이 아니라 닫는 것이다', async () => {
    const { repo } = await fresh()
    const question = await repo.questions.create('pet-1', '밥을 안 먹어요')
    await repo.questions.resolve(question.id, new Date('2026-09-20T05:00:00.000Z'))

    // 목록에는 남고 열린 목록에서만 빠집니다.
    expect(await repo.questions.list('pet-1')).toHaveLength(1)
    expect(await repo.questions.listOpen('pet-1')).toEqual([])
    expect((await repo.questions.list('pet-1'))[0]?.resolved_at).toBe('2026-09-20T05:00:00.000Z')
  })

  it('listOpen 은 아직 안 물어본 것만 준다', async () => {
    const { repo } = await fresh()
    const asked = await repo.questions.create('pet-1', '물어봤음')
    await repo.questions.create('pet-1', '아직')
    await repo.questions.resolve(asked.id, new Date())

    expect((await repo.questions.listOpen('pet-1')).map((q) => q.text)).toEqual(['아직'])
  })

  it('soft delete 는 목록에서도 뺀다', async () => {
    const { db, repo } = await fresh()
    const question = await repo.questions.create('pet-1', '밥을 안 먹어요')
    await repo.questions.softDelete(question.id)

    expect(await repo.questions.list('pet-1')).toEqual([])
    expect(await repo.questions.listOpen('pet-1')).toEqual([])
    expect(await db.questions.count()).toBe(1)
  })

  it('없는 질문을 닫거나 지우면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.questions.resolve('없음', new Date())).rejects.toThrow(/없음/)
    await expect(repo.questions.softDelete('없음')).rejects.toThrow(/없음/)
  })
})
