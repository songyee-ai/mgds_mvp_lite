import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo, type Sex, type Species } from '../../data'
import { WELCOME_PATH } from '../../app/routes'
import { today } from '../../domain'
import { Button, Card, Field } from '../../ui'
import {
  EMPTY_FORM,
  MAX_APPROXIMATE_YEARS,
  problemsOf,
  toNewClinic,
  toNewPet,
  type AgeMode,
  type PetForm,
} from './form'
import { PhotoError, resizePhoto, type ResizedPhoto } from './photo'
import styles from './pet.module.css'

/**
 * 아이 등록 최소 화면 — `/pet/new` (PRD FR-1 ① · U10).
 *
 * **라이트 온보딩의 유일한 입력 칸입니다.** 본 MVP 의 ②~⑥(어떤 마음으로
 * 오셨어요 · 약 · 알림 시각 · 병원 · 계정)은 라이트 범위 밖입니다. 그래서
 * 진행 표시도 "1/6" 같은 것을 두지 않았습니다 — 없는 단계를 가리키게 됩니다.
 * 앞은 인트로 3장, 뒤는 마무리 1장입니다.
 *
 * **⑤ 병원만 예외로 돌아왔습니다** (2026-09-13). 범위 밖으로 두었더니
 * `repo.clinics.primary()` 가 언제나 `undefined` 가 되어 위험 태그를 골라도
 * `RiskContact` 가 뜰 수 없었습니다 — PRD FR-2-3 의 안전 경로가 라이트에
 * 통째로 없었다는 뜻입니다. 각각의 결정(병원 화면 없음 · 홈의 「밤중에
 * 급하면」 카드 삭제)은 문서에 있었지만 그 합이 0 이 된다는 것은 아무 데도
 * 없었습니다. 병원 **목록**은 여전히 범위 밖이고, 여기서 받는 것은
 * **한 곳뿐**입니다.
 *
 * 한 화면에 전부 있고 카드로 나누지 않았습니다. 일일 기록(U08)은 매일 하는
 * 일이라 탭 수가 계약이지만, 등록은 평생 한 번이고 PRD FR-1 수용 기준이
 * 요구하는 것은 **"온보딩 통과 3분 이내"** 입니다. 한 화면에서 보이는 쪽이
 * 빠르고, 무엇을 묻는지 미리 다 보여 주는 쪽이 부담이 적습니다.
 *
 * 사진은 **유일하게 건너뛸 수 있는 항목입니다**(FR-1 표). 사진 실패가
 * 등록을 막지 않는 것이 완료 판정 1·3 입니다.
 */
export function PetCreate() {
  const navigate = useNavigate()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const maxDate = today(new Date(), tz)

  /**
   * 이미 등록된 아이가 있으면 이 화면을 열지 않습니다.
   *
   * **라이트에는 아이를 바꾸는 화면이 없습니다.** 그래서 두 번째 아이를
   * 만들면 `active_pet_id` 가 새 아이를 가리키고, 먼저 등록한 아이의
   * 기록은 앱 안에서 다시 닿을 수 없게 됩니다 — 지워지지는 않지만
   * 사용자에게는 사라진 것과 같습니다.
   *
   * 정상 경로로는 여기 올 수 없습니다(관문과 두 화면의 갈래가 모두 아이가
   * 없을 때만 보냅니다). 주소를 직접 치거나 예전 링크를 여는 경우를 막습니다.
   */
  const [existingPet, setExistingPet] = useState<boolean | undefined>(undefined)

  const [form, setForm] = useState<PetForm>(EMPTY_FORM)
  const [photo, setPhoto] = useState<ResizedPhoto | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** 처음부터 빨간 줄을 세우지 않습니다. 한 번 눌러 본 뒤부터 보여 줍니다. */
  const [tried, setTried] = useState(false)

  /** 미리보기 URL. 사진이 바뀌거나 화면을 떠날 때 반드시 반납합니다. */
  const previewUrl = useRef<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const showPreview = (file: File | null) => {
    if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = file === null ? null : URL.createObjectURL(file)
    setPreview(previewUrl.current)
  }

  // 화면을 떠날 때 Blob 을 붙잡고 있지 않게 합니다.
  useEffect(
    () => () => {
      if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current)
    },
    [],
  )

  // 이미 등록된 아이가 있는지. 위 `existingPet` 주석 참고.
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const petId = await repo.settings.get('active_pet_id')
      const pet = petId === undefined ? undefined : await repo.pets.get(petId)
      if (cancelled) return
      setExistingPet(pet !== undefined)
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof PetForm>(key: K, value: PetForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const onPickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 같은 파일을 두 번 고를 수 있게 비웁니다. 비우지 않으면 change 가 안 옵니다.
    event.target.value = ''
    if (file === undefined) return

    setBusy('photo')
    setPhotoError(null)
    try {
      const resized = await resizePhoto(file)
      setPhoto(resized)
      showPreview(resized.file)
    } catch (cause) {
      /**
       * HEIC 가 여기로 옵니다 (완료 판정 3). 아이폰 기본 설정이 HEIC 이고
       * 그건 사용자가 잘못한 것이 아니라서, **고른 사진을 지우지 않고**
       * 이전 상태를 그대로 둡니다. 문구가 다음에 할 일을 알려 줍니다.
       */
      setPhotoError(
        cause instanceof PhotoError
          ? copy.petCreate.photoErrors[cause.failure]
          : copy.petCreate.photoErrors.decode_failed,
      )
    } finally {
      setBusy(null)
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    setPhotoError(null)
    showPreview(null)
  }

  const onSubmit = async () => {
    setTried(true)
    const now = new Date()
    if (problemsOf(form, now, tz).length > 0) return

    setBusy('save')
    setSaveError(null)
    try {
      const pet = await repo.pets.create(toNewPet(form, now, tz))

      /**
       * 사진은 아이를 만든 **뒤에** 담습니다. `repo.photos.put` 이
       * `pet_id` 를 요구하기 때문입니다. 사진 저장이 실패해도 아이는
       * 이미 만들어져 있으므로 **등록을 되돌리지 않습니다** — 사진 없는
       * 아이가 아이 없는 상태보다 낫습니다. 사진은 나중에 넣을 수 있습니다.
       */
      if (photo !== null) {
        try {
          const photoId = await repo.photos.put(pet.id, photo.file)
          await repo.pets.update(pet.id, { photo_id: photoId })
        } catch {
          // 삼킵니다. 아래에서 기록 흐름으로 넘어갑니다.
        }
      }

      /**
       * 병원도 아이를 만든 뒤에 담습니다 — `pet_id` 가 필요합니다.
       *
       * **사진과 같은 계약으로 삼킵니다.** 병원 저장이 실패해도 등록을
       * 되돌리지 않습니다. 병원 없는 아이가 아이 없는 상태보다 낫습니다.
       * 다만 사진과 달리 **나중에 다시 넣을 화면이 아직 없습니다** —
       * 그래서 조용히 실패하면 사용자는 적었다고 믿는데 없습니다.
       * 병원을 고치는 화면이 생기면 이 삼킴도 같이 다시 보세요.
       */
      const clinic = toNewClinic(form, pet.id)
      if (clinic !== null) {
        try {
          await repo.clinics.create(clinic)
        } catch {
          // 삼킵니다. 위 주석 참고.
        }
      }

      // 아이 전환·다중 등록은 v1.1 입니다. 지금은 만든 아이가 곧 그 아이입니다.
      await repo.settings.set('active_pet_id', pet.id)

      /**
       * 등록 직후 온보딩 마무리 1장으로 갑니다.
       *
       * 본 MVP 는 여기서 곧바로 홈(`/today`)으로 갔습니다 — 그때는 뒤에
       * 이어질 칸이 없었기 때문입니다. 라이트는 마무리 한 장을 붙였고,
       * **최초 실행 의료 고지가 그 안에 있어**(PRD NFR-M M-5) 건너뛸 수
       * 없습니다. 마무리를 이미 지난 사람은 이 화면에 다시 오지 않습니다.
       */
      navigate(WELCOME_PATH, { replace: true })
    } catch {
      setSaveError(copy.petCreate.saveFailed)
      setBusy(null)
    }
  }

  if (existingPet === undefined) return null
  /**
   * 이미 아이가 있으면 관문으로 되돌립니다. 홈으로 바로 보내지 않는 이유는
   * 고지를 아직 안 한 사람도 여기 닿을 수 있어서입니다 — 어디로 가야 하는지는
   * `RootGate` 하나만 압니다.
   */
  if (existingPet) return <Navigate to="/" replace />

  const problems = tried ? problemsOf(form, new Date(), tz) : []

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{copy.petCreate.title}</h1>
      <p className={styles.note}>{copy.petCreate.intro}</p>

      <Card>
        <Field
          label={copy.petCreate.name.label}
          placeholder={copy.petCreate.name.placeholder}
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
        />
      </Card>

      <Card>
        <span className={styles.label}>{copy.petCreate.species.label}</span>
        <div className={styles.choices}>
          {(Object.keys(copy.petCreate.species.options) as Species[]).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.choice}
              aria-pressed={form.species === value}
              onClick={() => set('species', value)}
            >
              {copy.petCreate.species.options[value]}
            </button>
          ))}
        </div>
        {form.species === 'other' ? (
          <div className={styles.stack}>
            <Field
              label={copy.petCreate.species.otherLabel}
              placeholder={copy.petCreate.species.otherPlaceholder}
              value={form.speciesOtherLabel}
              onChange={(event) => set('speciesOtherLabel', event.target.value)}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <span className={styles.label}>{copy.petCreate.sex.label}</span>
        <div className={styles.choices}>
          {(Object.keys(copy.petCreate.sex.options) as Sex[]).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.choice}
              aria-pressed={form.sex === value}
              onClick={() => set('sex', value)}
            >
              {copy.petCreate.sex.options[value]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <span className={styles.label}>{copy.petCreate.age.label}</span>
        <div className={styles.choices}>
          {(Object.keys(copy.petCreate.age.modes) as AgeMode[]).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.choice}
              aria-pressed={form.ageMode === value}
              onClick={() => set('ageMode', value)}
            >
              {copy.petCreate.age.modes[value]}
            </button>
          ))}
        </div>

        <div className={styles.stack}>
          {form.ageMode === 'birthday' ? (
            <Field
              label={copy.petCreate.age.birthDateLabel}
              type="date"
              max={maxDate}
              value={form.birthDate}
              onChange={(event) => set('birthDate', event.target.value)}
            />
          ) : (
            <Field
              label={copy.petCreate.age.approximateLabel}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_APPROXIMATE_YEARS}
              placeholder={copy.petCreate.age.approximatePlaceholder}
              hint={copy.petCreate.age.approximateHint}
              value={form.approximateYears}
              onChange={(event) => set('approximateYears', event.target.value)}
            />
          )}
        </div>
      </Card>

      <Card>
        <Field
          label={copy.petCreate.adoptedAt.label}
          type="date"
          max={maxDate}
          hint={copy.petCreate.adoptedAt.hint}
          value={form.adoptedAt}
          onChange={(event) => set('adoptedAt', event.target.value)}
        />
      </Card>

      {/*
        자주 가는 병원 (PRD FR-2-3). 사진 앞에 둡니다 — 사진은 건너뛰는
        항목이라 맨 뒤가 자연스럽고, 이 칸은 적어 두면 쓰이는 칸입니다.
      */}
      <Card>
        <span className={styles.label}>{copy.petCreate.clinic.label}</span>
        <div className={styles.stack}>
          <Field
            label={copy.petCreate.clinic.nameLabel}
            placeholder={copy.petCreate.clinic.namePlaceholder}
            value={form.clinicName}
            onChange={(event) => set('clinicName', event.target.value)}
          />
          <Field
            label={copy.petCreate.clinic.phoneLabel}
            type="tel"
            inputMode="tel"
            placeholder={copy.petCreate.clinic.phonePlaceholder}
            hint={copy.petCreate.clinic.hint}
            value={form.clinicPhone}
            onChange={(event) => set('clinicPhone', event.target.value)}
          />
        </div>
      </Card>

      <Card>
        <span className={styles.label}>{copy.petCreate.photo.label}</span>
        <div className={styles.photoRow}>
          {preview === null ? null : (
            /* 미리보기라 설명이 필요 없습니다. 옆의 이름 칸이 이미 이름입니다. */
            <img className={styles.preview} src={preview} alt="" />
          )}
          <div className={styles.photoActions}>
            <label className={styles.pick}>
              {busy === 'photo'
                ? copy.petCreate.photo.working
                : photo === null
                  ? copy.petCreate.photo.pick
                  : copy.petCreate.photo.change}
              <input
                className={styles.pickInput}
                type="file"
                accept="image/*"
                disabled={busy !== null}
                onChange={(event) => void onPickPhoto(event)}
              />
            </label>
            {photo === null ? null : (
              <Button variant="secondary" onClick={clearPhoto}>
                {copy.petCreate.photo.remove}
              </Button>
            )}
          </div>
        </div>
        <p className={styles.note}>
          {photo === null
            ? copy.petCreate.photo.hint
            : copy.petCreate.photo.ready(
                photo.width,
                photo.height,
                Math.round(photo.bytes / 1000),
              )}
        </p>
        {photoError === null ? null : (
          <p className={styles.note} role="alert">
            {photoError}
          </p>
        )}
      </Card>

      {problems.length === 0 ? null : (
        <ul className={styles.problems} role="alert">
          {problems.map((problem) => (
            <li key={problem}>{copy.petCreate.problems[problem]}</li>
          ))}
        </ul>
      )}

      {saveError === null ? null : (
        <p className={styles.note} role="alert">
          {saveError}
        </p>
      )}

      <Button block disabled={busy !== null} onClick={() => void onSubmit()}>
        {busy === 'save' ? copy.petCreate.working : copy.petCreate.cta}
      </Button>
    </div>
  )
}
