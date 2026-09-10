/**
 * 3년치 시드 (U05 "테스트" 절 마지막 항목, 완료 판정 3).
 *
 * 규모를 지키는 것이 이 시드의 존재 이유입니다 (TECH_SPEC 18). 건수가
 * 조용히 줄면 "3년치로 테스트했다"는 말이 거짓이 되므로 기대값으로
 * 고정합니다.
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import { createDb, type Tables } from '../src/data'
import { EXPECTED, SEED_DAYS, clearAll, seed } from '../src/app/dev/seed'

const NOW = new Date('2026-09-09T12:00:00.000Z')
const TZ = 'Asia/Seoul'

let open: (Dexie & Tables) | null = null
let counter = 0

async function fresh(): Promise<Dexie & Tables> {
  counter += 1
  const db = createDb(`mgds-seed-${counter}`)
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

describe('시드', () => {
  it('건수가 기대값과 일치한다', async () => {
    const db = await fresh()
    const counts = await seed(db, NOW, TZ)

    expect(counts.pets).toBe(EXPECTED.pets)
    expect(counts.dailyLogs).toBe(EXPECTED.dailyLogs)
    expect(counts.weights).toBe(EXPECTED.weights)
    expect(counts.medications).toBe(EXPECTED.medications)
    expect(counts.medicationLogs).toBe(EXPECTED.medicationLogs)

    // 돌려준 숫자가 아니라 DB 에 실제로 들어간 숫자를 셉니다.
    expect(await db.pets.count()).toBe(EXPECTED.pets)
    expect(await db.daily_logs.count()).toBe(EXPECTED.dailyLogs)
    expect(await db.weights.count()).toBe(EXPECTED.weights)
    expect(await db.medications.count()).toBe(EXPECTED.medications)
    expect(await db.medication_logs.count()).toBe(EXPECTED.medicationLogs)
    expect(await db.daily_log_tags.count()).toBe(counts.dailyLogTags)
  })

  it('TECH_SPEC 18 의 규모(DailyLog ~1,100 · MedicationLog ~2,200)를 지킨다', async () => {
    expect(EXPECTED.dailyLogs).toBe(1100)
    // U07 에서 두 번째 약이 붙어 2,200 → 2,380 이 되었습니다. "약 2,200건"의
    // 자릿수를 지키는 것이 이 테스트의 뜻이라 폭도 함께 고정합니다. 3년 내내
    // 주는 약을 하나 더 넣어 두 배로 뛰면 여기서 잡힙니다.
    expect(EXPECTED.medicationLogs).toBe(2380)
    expect(EXPECTED.medicationLogs).toBeGreaterThan(2000)
    expect(EXPECTED.medicationLogs).toBeLessThan(2600)
  })

  it('5초 안에 끝난다 (완료 판정 3)', async () => {
    const db = await fresh()
    const started = performance.now()
    await seed(db, NOW, TZ)
    const elapsed = performance.now() - started
    // 실제 측정값을 출력에 남깁니다. 숫자가 보이지 않으면 여유가 얼마나
    // 남았는지 알 수 없고, 임계에 다가가는 것을 놓칩니다.
    console.log(`시드 ${SEED_DAYS}일치 생성: ${Math.round(elapsed)}ms (fake-indexeddb)`)
    expect(elapsed).toBeLessThan(5000)
  })

  it('마지막 날이 오늘이고 3년치가 이어진다', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)

    const dates = (await db.daily_logs.orderBy('date').toArray()).map((row) => row.date)
    // Asia/Seoul 에서 2026-09-09T12:00Z 는 2026-09-09 21:00 입니다.
    expect(dates.at(-1)).toBe('2026-09-09')
    expect(dates).toHaveLength(SEED_DAYS)
    expect(new Set(dates).size).toBe(SEED_DAYS)
  })

  it('태그가 산포되어 있다 — 전부도 아니고 없지도 않다', async () => {
    const db = await fresh()
    const counts = await seed(db, NOW, TZ)

    expect(counts.dailyLogTags).toBeGreaterThan(100)
    expect(counts.dailyLogTags).toBeLessThan(SEED_DAYS)

    const used = new Set((await db.daily_log_tags.toArray()).map((row) => row.tag))
    expect(used.size).toBe(9)
  })

  it('힘든 날·보통 날·좋은 날이 모두 있다', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)

    const seen = new Set((await db.daily_logs.toArray()).map((row) => row.overall))
    expect([...seen].sort()).toEqual(['good', 'hard', 'okay'])
  })

  it('같은 인자로 두 번 돌리면 같은 건수가 나온다', async () => {
    const db = await fresh()
    const first = await seed(db, NOW, TZ)
    const second = await seed(db, NOW, TZ)
    expect(second).toEqual(first)
    // 두 번째가 첫 번째 위에 쌓이지 않습니다.
    expect(await db.daily_logs.count()).toBe(EXPECTED.dailyLogs)
  })

  it('아이에 입양일이 들어 있다 (U04 T3)', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)
    const pet = await db.pets.toCollection().first()
    expect(pet?.adopted_at).toBe('2013-06-15')
    expect(await db.settings.get('active_pet_id')).toEqual({
      key: 'active_pet_id',
      value: pet?.id,
    })
  })

  it('약이 2종이고 두 번째는 최근에만 붙는다 (U07 시드 확장)', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)

    const meds = await db.medications.orderBy('id').toArray()
    expect(meds.map((m) => m.name).sort()).toEqual(['관절 영양제', '심장약'])

    const second = meds.find((m) => m.name === '관절 영양제')!
    expect(second.started_at).toBe('2026-03-14') // 오늘(2026-09-09) 에서 179일 전
    expect(second.is_active).toBe(true)

    const secondLogs = await db.medication_logs.where('medication_id').equals(second.id).count()
    expect(secondLogs).toBe(180)
  })

  it('병원 1곳과 케어 매뉴얼 일부가 들어 있다 (U07 시드 확장)', async () => {
    const db = await fresh()
    const counts = await seed(db, NOW, TZ)

    expect(counts.clinics).toBe(EXPECTED.clinics)
    expect(counts.careManual).toBe(EXPECTED.careManual)
    expect(await db.clinics.count()).toBe(1)
    expect((await db.clinics.toCollection().first())?.is_primary).toBe(true)

    // "일부"입니다. ManualKey 9개 중 3개만 채워 빈 항목이 남아 있어야
    // 완성도 계산(U30)과 "빈 블록은 숨긴다"(PRD FR-8-4)를 눈으로 볼 수 있습니다.
    const keys = (await db.care_manual.toArray()).map((item) => item.key).sort()
    expect(keys).toEqual(['cannot_eat', 'fears', 'med_method'])
  })

  it('시드가 만든 급여 기록이 U07 의 유니크 제약을 통과한다', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)

    // &[medication_id+scheduled_at] 이 유니크라, 두 약의 시각이 부딪쳤다면
    // bulkAdd 가 이미 실패했을 것입니다. 건수로 한 번 더 확인합니다.
    const rows = await db.medication_logs.toArray()
    const keys = new Set(rows.map((row) => `${row.medication_id} ${row.scheduled_at}`))
    expect(keys.size).toBe(rows.length)
    expect(rows).toHaveLength(EXPECTED.medicationLogs)
  })

  it('clearAll 이 모든 테이블을 비운다', async () => {
    const db = await fresh()
    await seed(db, NOW, TZ)
    await clearAll(db)
    for (const table of db.tables) expect(await table.count()).toBe(0)
  })
})
