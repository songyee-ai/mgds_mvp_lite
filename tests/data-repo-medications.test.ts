/**
 * U07 의 핵심 두 규칙 — append-only 와 중복 급여 거부.
 *
 * 둘 다 **repo 에서** 강제되는지를 봅니다 (완료 판정 2). 화면의 조건문에
 * 두면 화면이 늘어날 때마다 다시 지켜야 하고, 한 곳에서 빠지면 조용히
 * 어긋납니다. 그래서 테스트도 repo 를 직접 부릅니다.
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import {
  createDb,
  createLocalRepo,
  type Medication,
  type NewMedication,
  type Occurrence,
  type Repo,
  type Tables,
} from '../src/data'
import { expectedOccurrences } from '../src/domain/medSchedule'

const SEOUL = 'Asia/Seoul'

const NEW_MED: NewMedication = {
  pet_id: 'pet-1',
  name: '아모디핀',
  dose_text: '1/2정',
  schedule_times: ['08:00', '20:00'],
  with_food: 'after',
  started_at: '2026-09-01',
  ended_at: null,
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

async function fresh(): Promise<{ db: Dexie & Tables; repo: Repo }> {
  counter += 1
  const db = createDb(`mgds-med-${counter}`)
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

/** 그 약의 그 날 첫 예정. 도메인이 만든 것을 그대로 repo 에 넘깁니다. */
function firstOccurrence(medication: Medication, date: string): Occurrence {
  const [occurrence] = expectedOccurrences([medication], date, date, SEOUL)
  if (occurrence === undefined) throw new Error(`예정이 없습니다: ${date}`)
  return occurrence
}

describe('medications — append-only (TECH_SPEC 4-3)', () => {
  it('create 가 활성 상태로 만든다', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)

    expect(med.is_active).toBe(true)
    expect(med.ended_at).toBeNull()
    expect(med.created_at).toBe('2026-09-09T00:00:00.000Z')
  })

  it('종료일과 함께 등록하면 처음부터 비활성이다', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create({ ...NEW_MED, ended_at: '2026-09-05' })
    expect(med.is_active).toBe(false)
  })

  it('name 만 수정하면 제자리 수정이다 — 새 행이 없다', async () => {
    const { db, repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)

    await repo.medications.edit(med.id, { name: '암로디핀', dose_text: '1정' })

    expect(await db.medications.count()).toBe(1)
    const after = await repo.medications.get(med.id)
    expect(after?.id).toBe(med.id)
    expect(after?.name).toBe('암로디핀')
    expect(after?.dose_text).toBe('1정')
    // 스케줄은 그대로입니다.
    expect(after?.schedule_times).toEqual(['08:00', '20:00'])
    expect(after?.started_at).toBe('2026-09-01')
    expect(after?.is_active).toBe(true)
    // Meta 는 갱신됩니다.
    expect(after?.created_at).toBe(med.created_at)
    expect(after?.updated_at).not.toBe(med.updated_at)
  })

  it('schedule_times 변경은 새 행을 만들고 기존 행을 닫는다', async () => {
    const { db, repo } = await fresh()
    const before = await repo.medications.create(NEW_MED)

    const after = await repo.medications.replaceSchedule(
      before.id,
      { schedule_times: ['08:00', '14:00', '20:00'], with_food: 'after', started_at: '2026-09-06' },
      '2026-09-05',
    )

    expect(await db.medications.count()).toBe(2)
    expect(after.id).not.toBe(before.id)

    const closed = await repo.medications.get(before.id)
    expect(closed?.ended_at).toBe('2026-09-05')
    expect(closed?.is_active).toBe(false)
    // 옛 행의 스케줄은 손대지 않습니다. 여기가 과거 컴플라이언스의 근거입니다.
    expect(closed?.schedule_times).toEqual(['08:00', '20:00'])

    expect(after.schedule_times).toEqual(['08:00', '14:00', '20:00'])
    expect(after.started_at).toBe('2026-09-06')
    expect(after.ended_at).toBeNull()
    expect(after.is_active).toBe(true)
    // 이름·용량·아이는 따라옵니다.
    expect(after.name).toBe('아모디핀')
    expect(after.pet_id).toBe('pet-1')
  })

  it('두 행의 구간이 겹치면 던진다', async () => {
    const { db, repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)

    // 새 시작일이 종료일과 같으면 그 날 예정이 두 배가 됩니다.
    await expect(
      repo.medications.replaceSchedule(
        med.id,
        { schedule_times: ['09:00'], with_food: 'after', started_at: '2026-09-05' },
        '2026-09-05',
      ),
    ).rejects.toThrow(/뒤여야 합니다/)

    // 던졌으면 아무것도 바뀌지 않아야 합니다.
    expect(await db.medications.count()).toBe(1)
    expect((await repo.medications.get(med.id))?.is_active).toBe(true)
  })

  it('쪼개진 두 행의 예정 횟수 합이 맞는다 (U06 과 맞물림)', async () => {
    const { repo } = await fresh()
    const before = await repo.medications.create(NEW_MED)
    await repo.medications.replaceSchedule(
      before.id,
      { schedule_times: ['08:00', '14:00', '20:00'], with_food: 'after', started_at: '2026-09-06' },
      '2026-09-05',
    )

    const all = await repo.medications.list('pet-1')
    // 9/1~9/5 = 5일 × 2회 = 10, 9/6~9/10 = 5일 × 3회 = 15. 합 25.
    expect(expectedOccurrences(all, '2026-09-01', '2026-09-10', SEOUL)).toHaveLength(25)
  })

  it('stop 이 종료일과 비활성을 함께 쓴다', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    await repo.medications.stop(med.id, '2026-09-09')

    const after = await repo.medications.get(med.id)
    expect(after?.ended_at).toBe('2026-09-09')
    expect(after?.is_active).toBe(false)

    // 비활성 약에는 반드시 ended_at 이 있습니다. U06 의 windowOf 가
    // 이 불변식 위에 서 있습니다 (handoff/U06.md 의 "결정" 절).
    expect(after?.ended_at).not.toBeNull()
  })

  it('listActive 는 활성만, list 는 전부', async () => {
    const { repo } = await fresh()
    const first = await repo.medications.create(NEW_MED)
    await repo.medications.create({ ...NEW_MED, name: '관절 영양제', started_at: '2026-09-03' })
    await repo.medications.stop(first.id, '2026-09-02')

    expect((await repo.medications.list('pet-1')).map((m) => m.name)).toEqual([
      '아모디핀',
      '관절 영양제',
    ])
    expect((await repo.medications.listActive('pet-1')).map((m) => m.name)).toEqual(['관절 영양제'])
  })

  it('다른 아이의 약을 섞지 않는다', async () => {
    const { repo } = await fresh()
    await repo.medications.create(NEW_MED)
    await repo.medications.create({ ...NEW_MED, pet_id: 'pet-2', name: '다른 약' })

    expect(await repo.medications.list('pet-1')).toHaveLength(1)
    expect(await repo.medications.list('pet-2')).toHaveLength(1)
  })

  it('없는 약을 고치거나 닫으면 던진다', async () => {
    const { repo } = await fresh()
    await expect(repo.medications.edit('없음', { name: 'x' })).rejects.toThrow(/없음/)
    await expect(repo.medications.stop('없음', '2026-09-09')).rejects.toThrow(/없음/)
    await expect(
      repo.medications.replaceSchedule(
        '없음',
        { schedule_times: ['08:00'], with_food: 'none', started_at: '2026-09-10' },
        '2026-09-09',
      ),
    ).rejects.toThrow(/없음/)
  })
})

describe('medicationLogs.record — 중복 급여 (TECH_SPEC 6)', () => {
  it('첫 기록은 ok:true 다', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    const occurrence = firstOccurrence(med, '2026-09-09')

    const result = await repo.medicationLogs.record(
      occurrence,
      'given',
      new Date('2026-09-08T23:10:00.000Z'),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('첫 기록은 성공해야 합니다')
    expect(result.log.medication_id).toBe(med.id)
    expect(result.log.pet_id).toBe('pet-1') // occurrence 에 없던 값을 약에서 채웁니다
    expect(result.log.scheduled_at).toBe(occurrence.scheduledAt)
    expect(result.log.given_at).toBe('2026-09-08T23:10:00.000Z')
    expect(result.log.status).toBe('given')
  })

  it('같은 (medication_id, scheduled_at) 두 번째는 ok:false 와 첫 기록을 돌려준다', async () => {
    const { db, repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    const occurrence = firstOccurrence(med, '2026-09-09')

    const first = await repo.medicationLogs.record(
      occurrence,
      'given',
      new Date('2026-09-08T23:10:00.000Z'),
    )
    const second = await repo.medicationLogs.record(
      occurrence,
      'given',
      new Date('2026-09-08T23:40:00.000Z'),
    )

    // 예외가 아닙니다. 결과 타입입니다 (완료 판정 1).
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('두 번째는 거부되어야 합니다')
    expect(second.reason).toBe('already_recorded')
    if (!first.ok) throw new Error('첫 기록은 성공해야 합니다')
    expect(second.existing).toEqual(first.log)
    // 화면이 "이미 8:10에 먹였어요"를 그릴 수 있어야 합니다.
    expect(second.existing.given_at).toBe('2026-09-08T23:10:00.000Z')

    expect(await db.medication_logs.count()).toBe(1)
  })

  it('두 사람이 동시에 눌러도 하나만 들어간다', async () => {
    const { db, repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    const occurrence = firstOccurrence(med, '2026-09-09')
    const at = new Date('2026-09-08T23:10:00.000Z')

    // 먼저 읽고 나중에 쓰는 사이의 틈을 노립니다. DB 가 마지막 방어선입니다.
    const results = await Promise.all([
      repo.medicationLogs.record(occurrence, 'given', at),
      repo.medicationLogs.record(occurrence, 'given', at),
      repo.medicationLogs.record(occurrence, 'given', at),
    ])

    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok)).toHaveLength(2)
    expect(await db.medication_logs.count()).toBe(1)
  })

  it('시각이 다르면 별개의 예정이라 둘 다 들어간다', async () => {
    const { db, repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    const [morning, evening] = expectedOccurrences([med], '2026-09-09', '2026-09-09', SEOUL)

    await repo.medicationLogs.record(morning!, 'given', new Date())
    await repo.medicationLogs.record(evening!, 'given', new Date())

    expect(await db.medication_logs.count()).toBe(2)
  })

  it('given_at 은 실제로 약이 들어간 경우에만 채운다', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)
    const days = ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09'] as const
    const at = new Date('2026-09-09T00:00:00.000Z')

    const statuses = ['given', 'regiven', 'skipped', 'spat_out'] as const
    const filled: (string | null)[] = []
    for (const [index, status] of statuses.entries()) {
      const result = await repo.medicationLogs.record(firstOccurrence(med, days[index]!), status, at)
      if (!result.ok) throw new Error('기록에 실패했습니다')
      filled.push(result.log.given_at)
    }

    // given·regiven 은 약이 들어갔습니다. skipped 는 준 적이 없고,
    // spat_out 은 뱉어서 들어가지 않았습니다.
    expect(filled).toEqual([at.toISOString(), at.toISOString(), null, null])
  })

  it('없는 약의 예정을 기록하려 하면 던진다', async () => {
    const { repo } = await fresh()
    await expect(
      repo.medicationLogs.record(
        { medicationId: '없음', scheduledAt: '2026-09-09T11:00:00.000Z', localTime: '20:00' },
        'given',
        new Date(),
      ),
    ).rejects.toThrow(/없음/)
  })

  it('range 가 기간 양끝을 포함하고 아이로 거른다', async () => {
    const { repo } = await fresh()
    const mine = await repo.medications.create(NEW_MED)
    const other = await repo.medications.create({ ...NEW_MED, pet_id: 'pet-2' })

    for (const date of ['2026-09-08', '2026-09-09', '2026-09-10']) {
      await repo.medicationLogs.record(firstOccurrence(mine, date), 'given', new Date())
    }
    await repo.medicationLogs.record(firstOccurrence(other, '2026-09-09'), 'given', new Date())

    // 9/8 08:00 KST ~ 9/9 08:00 KST
    const rows = await repo.medicationLogs.range(
      'pet-1',
      new Date('2026-09-07T23:00:00.000Z'),
      new Date('2026-09-08T23:00:00.000Z'),
    )
    expect(rows.map((row) => row.scheduled_at)).toEqual([
      '2026-09-07T23:00:00.000Z',
      '2026-09-08T23:00:00.000Z',
    ])
    expect(rows.every((row) => row.pet_id === 'pet-1')).toBe(true)
  })

  it('도메인이 만든 예정을 그대로 넘길 수 있다 (Occurrence 한 벌)', async () => {
    const { repo } = await fresh()
    const med = await repo.medications.create(NEW_MED)

    // U06 에서 두 벌이던 타입을 U07 이 하나로 합쳤습니다. 이 줄이
    // 컴파일되는 것 자체가 판정입니다 — 변환 함수가 필요 없습니다.
    const occurrences = expectedOccurrences([med], '2026-09-09', '2026-09-09', SEOUL)
    for (const occurrence of occurrences) {
      const result = await repo.medicationLogs.record(occurrence, 'given', new Date())
      expect(result.ok).toBe(true)
    }
  })
})
