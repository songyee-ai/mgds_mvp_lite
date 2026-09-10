/**
 * Dexie 스키마가 DB 레벨에서 무는지 확인합니다 (U05 완료 판정 1).
 *
 * 여기서 보는 것은 애플리케이션 로직이 아니라 **제약 그 자체**입니다.
 * Repo 를 거치지 않고 테이블에 직접 씁니다. Repo 의 upsert 가 아무리
 * 잘 짜여 있어도, 나중에 누가 다른 경로로 쓸 때 DB 가 막아 주는지가
 * 이 테스트의 질문입니다.
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import { createDb, type DailyLog, type Meta, type Tables } from '../src/data'

const META: Meta = {
  created_at: '2026-09-09T00:00:00.000Z',
  updated_at: '2026-09-09T00:00:00.000Z',
  deleted_at: null,
  recorded_by: null,
}

const log = (id: string, petId: string, date: string): DailyLog => ({
  ...META,
  id,
  pet_id: petId,
  date,
  meal: 'ate_all',
  water: 'normal',
  energy: 'normal',
  toilet: 'normal',
  overall: 'good',
  memo: null,
})

let open: (Dexie & Tables) | null = null
let counter = 0

async function fresh(): Promise<Dexie & Tables> {
  counter += 1
  const db = createDb(`mgds-schema-${counter}`)
  await db.open()
  open = db
  return db
}

afterEach(async () => {
  if (open !== null) {
    await open.delete()
    open = null
  }
})

describe('Dexie 스키마 (TECH_SPEC 4)', () => {
  it('버전 1 이고 테이블 13개가 전부 있다', async () => {
    const db = await fresh()
    expect(db.verno).toBe(1)
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'care_manual',
        'clinic_visits',
        'clinics',
        'daily_log_tags',
        'daily_logs',
        'medication_logs',
        'medications',
        'outbox',
        'pets',
        'photos',
        'questions',
        'settings',
        'weights',
      ].sort(),
    )
  })

  it('&[pet_id+date] 가 같은 날 두 번째 DailyLog 를 거부한다', async () => {
    const db = await fresh()
    await db.daily_logs.add(log('a', 'pet-1', '2026-09-09'))

    // id 가 달라도 (pet_id, date) 가 같으면 DB 가 막습니다.
    await expect(db.daily_logs.add(log('b', 'pet-1', '2026-09-09'))).rejects.toThrow(
      /ConstraintError/,
    )
    expect(await db.daily_logs.count()).toBe(1)
  })

  it('아이가 다르면 같은 날짜를 허용한다', async () => {
    const db = await fresh()
    await db.daily_logs.add(log('a', 'pet-1', '2026-09-09'))
    await db.daily_logs.add(log('b', 'pet-2', '2026-09-09'))
    expect(await db.daily_logs.count()).toBe(2)
  })

  it('&[pet_id+date] 가 WeightRecord 에도 걸린다', async () => {
    const db = await fresh()
    const row = { ...META, id: 'w1', pet_id: 'pet-1', date: '2026-09-09', weight_g: 6200 }
    await db.weights.add(row)
    await expect(db.weights.add({ ...row, id: 'w2' })).rejects.toThrow(/ConstraintError/)
  })

  it('&[medication_id+scheduled_at] 가 중복 급여를 거부한다', async () => {
    const db = await fresh()
    const row = {
      ...META,
      id: 'm1',
      medication_id: 'med-1',
      pet_id: 'pet-1',
      scheduled_at: '2026-09-09T11:00:00.000Z',
      given_at: null,
      status: 'given' as const,
      note: null,
    }
    await db.medication_logs.add(row)
    await expect(db.medication_logs.add({ ...row, id: 'm2' })).rejects.toThrow(/ConstraintError/)
  })

  it('&[daily_log_id+tag] 가 같은 태그를 두 번 달지 못하게 한다', async () => {
    const db = await fresh()
    await db.daily_log_tags.add({ daily_log_id: 'a', tag: '기침' })
    await expect(db.daily_log_tags.add({ daily_log_id: 'a', tag: '기침' })).rejects.toThrow(
      /ConstraintError/,
    )
    // 같은 기록에 다른 태그는 됩니다.
    await db.daily_log_tags.add({ daily_log_id: 'a', tag: '구토' })
    expect(await db.daily_log_tags.count()).toBe(2)
  })

  it('&[pet_id+key] 가 케어 매뉴얼 항목을 1건으로 묶는다', async () => {
    const db = await fresh()
    const row = { ...META, id: 'c1', pet_id: 'pet-1', key: 'fears' as const, value_text: '천둥' }
    await db.care_manual.add(row)
    await expect(db.care_manual.add({ ...row, id: 'c2' })).rejects.toThrow(/ConstraintError/)
  })

  it('outbox 는 seq 를 자동으로 매긴다', async () => {
    const db = await fresh()
    const first = await db.outbox.add({ table: 'daily_logs', row_id: 'a' })
    const second = await db.outbox.add({ table: 'daily_logs', row_id: 'b' })
    expect(second).toBeGreaterThan(first)
  })
})
