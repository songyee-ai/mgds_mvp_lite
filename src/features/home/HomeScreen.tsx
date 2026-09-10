import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo, type DailyLog, type MedicationLog, type Pet } from '../../data'
import {
  addDays,
  daysTogether,
  countGood,
  expectedOccurrences,
  pendingItems,
  recordingTargetDate,
  today,
  weekDots,
  type Pending,
} from '../../domain'
import { PET_NEW_PATH } from '../../app/routes'
import { Button, Card, Dots, dotStateOf } from '../../ui'
import { BackupEntry } from '../backup'
import styles from './home.module.css'

/**
 * 홈 (PRD FR-5 · U11). **앱을 열면 아이가 먼저 보이고, 할 일이 행동
 * 버튼으로 있습니다.**
 *
 * 위에서 아래로 사진·이름·함께한 N일 · 오늘 기록 · 이번 주, 그리고 맨
 * 아래에 백업 링크 한 줄입니다.
 *
 * ## 라이트에서 뺀 카드 둘
 *
 * PRD FR-5 의 레이아웃에는 **다음 약**과 **밤중에 급하면**이 더 있습니다.
 * 본 MVP 는 그 둘을 `disabled` 버튼으로 세워 두고 동작을 U13·U24 로
 * 넘겼습니다. 라이트에서는 **카드째로 지웠습니다** — 약을 등록할 화면이
 * 없어 "다음 약"이 영원히 비고, 병원 목록도 없습니다. 누를 수 없는 버튼을
 * 남겨 두는 것은 아직 없는 기능을 매일 가리키는 일입니다.
 *
 * 도메인 쪽은 그대로 둡니다 — `expectedOccurrences` 는 `pendingItems` 가
 * 요구하는 인자이고, 약이 0건이면 결과도 빕니다. 계약을 화면 사정으로
 * 바꾸지 않는 것이 이 저장소의 규칙입니다.
 *
 * ## 이 화면이 하지 않는 것
 *
 * - **힘든 날을 세지 않습니다.** 좋은 날 개수만 있습니다 (PRD FR-5 수용
 *   기준 · 원칙 P2). `scripts/lint-hard-count.mjs` 가 집계 코드를 막습니다.
 * - **며칠 밀렸는지 세지 않습니다.** `pendingItems` 가 경과 일수를 돌려주지
 *   않는 것이 그 계약입니다 (TECH_SPEC 8-1).
 *
 * ## `useLiveQuery` 를 쓰지 않았습니다
 *
 * U08 이 "구독이 실제로 필요한 곳은 홈"이라고 적어 두었고 STATE.md 도
 * `dexie-react-hooks` 를 이 단위가 들이라고 넘겼습니다. **넣지 않았습니다.**
 *
 * 구독이 필요한 이유로 적힌 것은 PRD FR-4 의 "아침 약은 민준님이 8:10" —
 * **다른 사람이 쓴 것이 내 화면에 나타나는 것**입니다. 그런데 계정도
 * 동기화도 없어(U25·U28) 지금 이 앱에는 다른 사람이 없습니다. 화면 사이를
 * 오갈 때는 라우터가 이 컴포넌트를 다시 마운트하므로 한 번 읽기로 충분합니다.
 *
 * 의존성을 미루는 것은 이 저장소의 관례입니다 (TECH_SPEC 1-2 의 런타임
 * 의존성 10개 이하). **라이트 버전에는 계정도 동기화도 없으므로 끝까지
 * 필요하지 않습니다.**
 */

/** 주간 점이 덮는 날 수. PRD FR-5 의 점 일곱 개. */
const WEEK_DAYS = 7

type Loaded = {
  pet: Pet
  photoUrl: string | null
  /** 최근 7일치 하루 기록. `countGood`·`weekDots` 가 같은 창을 씁니다. */
  weekLogs: DailyLog[]
  /**
   * 앱 내 미완료 (TECH_SPEC 8-1). 라이트에서 실제로 그리는 것은
   * `today_log_missing` 하나이고, 나머지 종류는 그릴 화면이 없습니다.
   */
  pending: Pending[]
}

export function HomeScreen() {
  const navigate = useNavigate()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  const localToday = today(now, tz)
  /** 기록 화면이 열 날짜. 04:00 이전이면 어제입니다 (TECH_SPEC 3-2). */
  const targetDate = recordingTargetDate(now, tz)

  /**
   * 주간 점이 덮는 창은 **오늘로 끝나는 7일**입니다.
   *
   * 달력 주(월~일)로 잡으면 아직 오지 않은 날들이 미기록 점으로 줄줄이
   * 찍힙니다. 화요일에 열면 다섯 개가 "기록 없음"이 되는데, 그건 아직
   * 일어나지 않은 일을 비어 있다고 말하는 것입니다 — 이 제품이 하지 않기로
   * 한 바로 그 표시입니다 (PRD 4-1 (6)). 굴러가는 창이면 마지막 점이 늘
   * 오늘이고, PRD FR-5 그림의 `● ● ○ ● ● ● ·` 모양과도 맞습니다.
   */
  const weekStart = addDays(localToday, -(WEEK_DAYS - 1))

  const [state, setState] = useState<Loaded | null | undefined>(undefined)

  /** 사진 URL. 화면을 떠날 때 반드시 반납합니다 (U10 의 미리보기와 같은 패턴). */
  const photoUrl = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const petId = await repo.settings.get('active_pet_id')
      const pet = petId === undefined ? undefined : await repo.pets.get(petId)
      if (cancelled) return
      if (pet === undefined) {
        setState(null)
        return
      }

      const [weekLogs, meds, latestWeight] = await Promise.all([
        repo.dailyLogs.range(pet.id, weekStart, localToday),
        repo.medications.list(pet.id),
        repo.weights.latest(pet.id),
      ])

      /**
       * 급여 기록은 밀린 약을 찾는 창과 같은 구간에서 읽습니다.
       * 창을 좁히면 밀린 약을 놓치고, 넓히면 홈이 느려집니다.
       */
      const from = addDays(localToday, -(WEEK_DAYS - 1))
      const medLogs: MedicationLog[] = await repo.medicationLogs.range(
        pet.id,
        new Date(`${from}T00:00:00`),
        now,
      )
      if (cancelled) return

      const past = expectedOccurrences(meds, from, localToday, tz)
      const pending = pendingItems({
        targetDate,
        now,
        logs: weekLogs,
        occurrences: past,
        medLogs,
        latestWeightDate: latestWeight?.date ?? null,
      })

      let url: string | null = null
      if (pet.photo_id !== null) {
        try {
          url = await repo.photos.url(pet.photo_id)
        } catch {
          // 사진 행이 없어도 홈은 떠야 합니다. 빈 자리로 둡니다.
          url = null
        }
      }
      if (cancelled) {
        if (url !== null) URL.revokeObjectURL(url)
        return
      }
      if (photoUrl.current !== null) URL.revokeObjectURL(photoUrl.current)
      photoUrl.current = url

      setState({ pet, photoUrl: url, weekLogs, pending })
    }

    void load()
    return () => {
      cancelled = true
    }
    // 날짜가 바뀌면 다시 읽습니다. `now` 는 매 렌더 새 객체라 의존성에 두지 않습니다.
    // eslint 설정은 없지만 의도를 남겨 둡니다.
  }, [localToday, targetDate, weekStart, tz])

  // 화면을 떠날 때 Blob 을 붙잡고 있지 않게 합니다.
  useEffect(
    () => () => {
      if (photoUrl.current !== null) URL.revokeObjectURL(photoUrl.current)
    },
    [],
  )

  if (state === undefined) return null
  /**
   * 아이가 없으면 등록 화면으로.
   *
   * **관문은 이 화면이 아닙니다** — 라이트에서는 `app/RootGate` 가 `/` 에서
   * 정합니다. 이 갈래는 주소로 곧바로 들어온 경우를 위한 것입니다
   * (기록 화면에도 같은 갈래가 있습니다).
   */
  if (state === null) return <Navigate to={PET_NEW_PATH} replace />

  const { pet } = state

  /**
   * 함께한 날의 기준일 (U04 ⚠️ T3 결정, 2026-09-09 사용자 확인).
   * `입양일 → 정확한 생일 → 아이 등록일` 순이고, 마지막 경우에만 표기가
   * "기록 N일째" 로 바뀝니다 — 입양일도 정확한 생일도 모르면 "함께한"이라고
   * 말할 근거가 없습니다.
   */
  const exactBirth = pet.birth_is_approximate ? null : pet.birth_date
  const anchor = pet.adopted_at ?? exactBirth
  /** 우선순위 3번. `pets` 에 등록일 필드가 없어 Meta 에서 날짜만 자릅니다 (U05). */
  const joinedAt = pet.created_at.slice(0, 10)
  const days = daysTogether(anchor, joinedAt, now, tz)
  const daysText =
    anchor === null ? copy.home.recordDays(days) : copy.home.daysTogether(days)

  const dots = weekDots(state.weekLogs, weekStart).map(dotStateOf)
  /** 점마다 어느 날인지. 로케일이 요일 이름을 만듭니다 (하드코딩하지 않습니다). */
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' })
  const dayLabels = Array.from({ length: WEEK_DAYS }, (_unused, offset) =>
    weekday.format(new Date(`${addDays(weekStart, offset)}T00:00:00Z`)),
  )

  const loggedToday = state.pending.every((item) => item.kind !== 'today_log_missing')

  return (
    <div className={styles.page}>
      {/* PRD FR-5 수용 기준 1 — 최상단이 사진 + 이름 + "함께한 N일" */}
      <div className={styles.identity}>
        {state.photoUrl === null ? (
          <div className={[styles.photo, styles.photoEmpty].join(' ')}>
            {copy.home.photoEmpty}
          </div>
        ) : (
          <img className={styles.photo} src={state.photoUrl} alt="" />
        )}
        <div className={styles.names}>
          <h1 className={styles.name}>{pet.name}</h1>
          <p className={styles.days}>{daysText}</p>
          {/* 좋은 날 개수만. 힘든 날 개수를 여기 만들지 마세요 (원칙 P2). */}
          <p className={styles.good}>{copy.home.goodDays(countGood(state.weekLogs))}</p>
        </div>
      </div>

      {/*
        오늘 기록 — 미완료를 **행동 버튼으로만** 말합니다 (TECH_SPEC 8-1).
        PRD FR-5 그림의 "아직 비어있어요" 줄은 넣지 않았습니다. 같은 PRD 의
        수용 기준이 지적형을 금지하고, 8-1 이 "비어있어요"를 이름까지 들어
        금지하며 표시할 모양을 `오늘 기록 · [10초면 돼요]` 로 못박습니다.
      */}
      <Card title={copy.home.log.title}>
        {loggedToday ? (
          <>
            <p className={styles.line}>{copy.home.log.done}</p>
            <Link to={`/today/${targetDate}`}>{copy.home.log.edit}</Link>
          </>
        ) : (
          /*
           * `<Link>` 로 감싸지 않습니다 — `<a>` 안의 `<button>` 은 유효하지
           * 않은 HTML 이고 접근성 트리에 조작 요소가 둘로 겹칩니다.
           * `Button` 이 44px 하한을 보장하므로(NFR-A A-2) 버튼 쪽을 남기고
           * 이동은 라우터에 맡깁니다.
           */
          <Button onClick={() => navigate(`/today/${targetDate}`)}>
            {copy.home.log.cta}
          </Button>
        )}
      </Card>

      <Card title={copy.home.week.title}>
        <div className={styles.week}>
          <Dots values={dots} dayLabels={dayLabels} label={copy.home.week.label} />
        </div>
      </Card>

      {/*
        데이터 백업 진입점 (U09).

        **홈에서 유일하게 다른 화면으로 나가는 링크입니다.** 본 MVP 는 이
        줄을 아이 탭에 두었지만 라이트에는 탭바가 없고, 기록이 이 기기에만
        있는 앱이라 이 줄이 유일한 안전장치입니다 (TECH_SPEC 8-6).
        카드에 담지 않는 이유는 이것이 아이에 관한 정보가 아니기 때문입니다.
      */}
      <div className={styles.footer}>
        <BackupEntry />
      </div>
    </div>
  )
}
