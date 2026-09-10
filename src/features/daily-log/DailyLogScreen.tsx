import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { copy } from '../../copy'
import { RISK_TAGS } from '../../config'
import { ALL_TAGS, repo, type Clinic, type DailyLogWithTags, type Pet, type Tag } from '../../data'
import { HOME_PATH, PET_NEW_PATH } from '../../app/routes'
import { recordingTargetDate, today } from '../../domain'
import { Button, Card, Field } from '../../ui'
import { autoBackupOnce } from '../backup'
import { CARDS, isComplete, type CardDef, type Draft } from './cards'
import { HardDayThanks } from './HardDayThanks'
import { RiskContact } from './RiskContact'
import styles from './dailyLog.module.css'

/**
 * 일일 기록 카드 5장 (PRD FR-2). 이 제품의 심장입니다.
 *
 * 흐름은 두 단계뿐입니다.
 *
 * 1. **카드 5장** — 선택지를 누르면 곧바로 다음 장. 확인 버튼이 없어서
 *    5탭이면 저장까지 끝납니다 (PRD FR-2 수용 기준). 5번째 탭이 저장입니다.
 * 2. **저장 뒤** — 힘든 날이면 감사 반응(FR-2-2), 그리고 **선택 항목인**
 *    태그와 메모. 선택 항목을 5장 안에 끼워 넣으면 탭 수 계약이 깨지고,
 *    "매일 묻지 않는다"(FR-2-1)도 지킬 수 없습니다.
 *
 * 하루 1건은 두 겹으로 지킵니다 — `&[pet_id+date]` 유니크 제약(DB)과
 * `upsert`(같은 날 재진입 시 새로 만들지 않고 덮어쓰기). 화면은 세 번째
 * 겹으로 "이미 기록이 있어요"를 알립니다.
 *
 * **`useLiveQuery` 를 쓰지 않습니다** (TECH_SPEC 6 과 다름). 이 화면은 자기가
 * 쓴 것만 읽는 유일한 작성자라 구독이 주는 것이 없고, 저장이 반영될 때마다
 * 진행 중인 카드가 다시 그려집니다. 구독이 실제로 필요해지는 것은 다른
 * 사람의 기록이 내 화면에 나타나야 할 때이고(PRD FR-4), **라이트 버전에는
 * 계정도 동기화도 없어 그런 사람이 없습니다.**
 */
export function DailyLogScreen() {
  const params = useParams<{ date?: string }>()
  const navigate = useNavigate()

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  const defaultDate = recordingTargetDate(now, tz)
  const maxDate = today(now, tz)
  /** 주소에 날짜가 있으면 그 날, 없으면 04:00 규칙이 정한 날 (TECH_SPEC 3-2). */
  const date = params.date ?? defaultDate
  /** 04:00 이전이라 전날로 열린 경우. 지적이 아니라 설명입니다. */
  const openedForLastNight = params.date === undefined && defaultDate !== maxDate

  const [pet, setPet] = useState<Pet | null | undefined>(undefined)
  const [clinic, setClinic] = useState<Clinic | undefined>(undefined)
  const [saved, setSaved] = useState<DailyLogWithTags | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>({})
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [memo, setMemo] = useState('')

  // 날짜가 바뀌면 그 날의 기록을 처음부터 다시 읽습니다.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const petId = await repo.settings.get('active_pet_id')
      const found = petId === undefined ? undefined : await repo.pets.get(petId)
      if (cancelled) return
      if (found === undefined) {
        setPet(null)
        return
      }
      setPet(found)
      setClinic(await repo.clinics.primary(found.id))

      const existing = await repo.dailyLogs.getByDate(found.id, date)
      if (cancelled) return
      setSaved(existing)
      setStep(0)
      setDone(false)
      setDraft(
        existing === undefined
          ? {}
          : {
              meal: existing.meal,
              water: existing.water,
              energy: existing.energy,
              toilet: existing.toilet,
              overall: existing.overall,
            },
      )
      setTags(existing?.tags ?? [])
      setMemo(existing?.memo ?? '')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [date])

  /** 태그·메모까지 한 번에 씁니다. 선택 항목을 바꿀 때마다 그대로 저장됩니다. */
  const persist = useCallback(
    async (next: Draft, nextTags: Tag[], nextMemo: string) => {
      if (pet === undefined || pet === null || !isComplete(next)) return
      const log = await repo.dailyLogs.upsert(pet.id, date, {
        ...next,
        memo: nextMemo.trim() === '' ? null : nextMemo.trim(),
        tags: nextTags,
      })
      setSaved({ ...log, tags: nextTags })

      /**
       * 첫 기록 직후 자동 백업 (TECH_SPEC 8-6 대응 2번 · PRD FR-13-1).
       *
       * **기록이 저장된 뒤에, 기다리지 않고 부릅니다.** 이 함수는 던지지
       * 않고 두 번째 호출부터는 아무 일도 하지 않습니다. 백업 때문에 화면이
       * 멈추거나 기록이 막히는 일은 없어야 합니다 (U09 완료 판정 3).
       */
      void autoBackupOnce()
    },
    [pet, date],
  )

  const choose = (card: CardDef, value: string) => {
    const next: Draft = { ...draft, [card.field]: value }
    setDraft(next)
    if (step + 1 < CARDS.length) {
      setStep(step + 1)
      return
    }
    // 마지막 카드의 탭이 곧 저장입니다. 별도의 저장 버튼이 없습니다.
    setDone(true)
    void persist(next, tags, memo)
  }

  const toggleTag = (tag: Tag) => {
    const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]
    setTags(next)
    void persist(draft, next, memo)
  }

  if (pet === undefined) return null
  /**
   * 아이가 없으면 등록 화면으로 보냅니다 (U10 산출물 "아이가 없을 때 앱
   * 진입 시 이 화면으로 유도").
   *
   * **관문은 이 화면이 아닙니다** — 라이트에서는 `app/RootGate` 가 `/` 에서
   * 정합니다. 이 갈래는 `/today/2026-09-10` 처럼 주소로 곧바로 들어온
   * 경우를 위한 것입니다.
   */
  if (pet === null) return <Navigate to={PET_NEW_PATH} replace />

  const dateControl = (
    <div className={styles.dateRow}>
      <Field
        label={copy.dailyLog.pickDate}
        type="date"
        value={date}
        max={maxDate}
        onChange={(event) => navigate(`/today/${event.target.value}`)}
      />
    </div>
  )

  if (done) {
    const showRiskContact =
      clinic !== undefined && tags.some((tag) => RISK_TAGS.includes(tag))

    return (
      <div className={styles.page}>
        <h1 className={styles.date}>{date}</h1>
        <p className={styles.note} role="status">
          {copy.dailyLog.saved}
        </p>

        {/* 힘든 날이면 저장 직후 100% 표시됩니다 (PRD FR-2-2). */}
        {draft.overall === 'hard' ? <HardDayThanks /> : null}

        <Card title={copy.dailyLog.tags.title}>
          <p className={styles.note}>{copy.dailyLog.tags.hint}</p>
          <div className={styles.tagList}>
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.tag}
                aria-pressed={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </Card>

        {/* 병원 정보가 없으면 블록 자체가 나오지 않습니다 (PRD FR-2-3). */}
        {showRiskContact ? <RiskContact clinicName={clinic.name} phone={clinic.phone} /> : null}

        <Card title={copy.dailyLog.memo.label}>
          <Field
            label={copy.dailyLog.memo.label}
            placeholder={copy.dailyLog.memo.placeholder}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            onBlur={() => void persist(draft, tags, memo)}
          />
        </Card>

        {/*
          홈으로 돌아갑니다. **기록이 이미 저장된 뒤라 이탈이 아닙니다**
          (PRD FR-2-2) — 여기서 나가도 잃는 것이 없어야 태그·메모를
          선택 항목으로 둘 수 있습니다.
        */}
        <Button block onClick={() => navigate(HOME_PATH)}>
          {copy.common.done}
        </Button>
      </div>
    )
  }

  const card = CARDS[step]
  if (card === undefined) return null
  const current = draft[card.field]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.date}>{date}</h1>
        <p className={styles.progress}>{copy.dailyLog.progress(step + 1, CARDS.length)}</p>
      </div>

      {openedForLastNight ? <p className={styles.note}>{copy.dailyLog.lastNight}</p> : null}
      {saved !== undefined ? <p className={styles.note}>{copy.dailyLog.editing}</p> : null}

      <Card>
        <h2 className={styles.question}>{card.question}</h2>
        <div className={styles.options}>
          {card.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[styles.option, option.value === current ? styles.optionCurrent : '']
                .filter(Boolean)
                .join(' ')}
              // 수정 모드에서 지금 저장된 값을 스크린리더에도 알립니다.
              {...(option.value === current ? { 'aria-current': true } : {})}
              onClick={() => choose(card, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      {step > 0 ? (
        <Button variant="secondary" onClick={() => setStep(step - 1)}>
          {copy.common.back}
        </Button>
      ) : null}

      {dateControl}
    </div>
  )
}
