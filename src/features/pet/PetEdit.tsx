import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { copy } from '../../copy'
import { repo, type Clinic, type Pet } from '../../data'
import { HOME_PATH, PET_NEW_PATH } from '../../app/routes'
import { Button, Card, Field } from '../../ui'
import { clinicActionOf, editProblemsOf, namePatchOf, type PetEditForm } from './editForm'
import { PhotoError, resizePhoto, type ResizedPhoto } from './photo'
import styles from './pet.module.css'

/**
 * 아이 정보 고치기 — `/pet/edit` (2026-09-13).
 *
 * 등록 화면이 유일한 입구였던 것을 메웁니다. 규칙은 `editForm.ts` 에 있고
 * 여기는 그것을 저장소에 붙이는 층입니다.
 *
 * ## 사진은 세 갈래입니다
 *
 * | 사용자가 한 것 | 저장 |
 * |---|---|
 * | 아무것도 안 함 | `photo_id` 를 건드리지 않습니다 |
 * | 새로 고름 | 새 사진을 담고 `photo_id` 를 바꿉니다 |
 * | 지움 | `photo_id: null` |
 *
 * **지운 사진의 행 자체는 남깁니다.** `repo.photos` 에 지우는 계약이 없고,
 * 백업 파일에도 그대로 담깁니다. 홈에서 안 보이는 것으로 충분하고, 잘못
 * 지웠을 때 되돌릴 수 있는 편이 낫습니다.
 *
 * ## 저장 실패는 되돌리지 않습니다
 *
 * 이름 · 사진 · 병원을 따로 씁니다. 중간에 하나가 실패해도 앞의 것은
 * 그대로 둡니다 — 등록 화면이 사진 실패에 아이를 되돌리지 않는 것과 같은
 * 계약입니다. 부분적으로 고쳐진 상태가, 고치려다 아무것도 안 된 상태보다
 * 낫습니다. 실패하면 문구가 뜨고 적은 내용은 화면에 남습니다.
 */
export function PetEdit() {
  const navigate = useNavigate()

  const [pet, setPet] = useState<Pet | null | undefined>(undefined)
  const [clinic, setClinic] = useState<Clinic | undefined>(undefined)
  const [form, setForm] = useState<PetEditForm>({ name: '', clinicName: '', clinicPhone: '' })

  /** 새로 고른 사진. `null` 이면 안 골랐다는 뜻입니다. */
  const [photo, setPhoto] = useState<ResizedPhoto | null>(null)
  /** 지금 있던 사진을 지우기로 했는가. 새로 고르면 다시 false 가 됩니다. */
  const [photoCleared, setPhotoCleared] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [busy, setBusy] = useState<'photo' | 'save' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** 처음부터 빨간 줄을 세우지 않습니다. 한 번 눌러 본 뒤부터 (등록과 같음). */
  const [tried, setTried] = useState(false)

  /** 지금 담겨 있는 사진의 URL. 화면을 떠날 때 반납합니다. */
  const savedUrl = useRef<string | null>(null)
  /** 새로 고른 사진의 미리보기 URL. 위와 따로 관리합니다. */
  const pickedUrl = useRef<string | null>(null)
  const [savedPreview, setSavedPreview] = useState<string | null>(null)
  const [pickedPreview, setPickedPreview] = useState<string | null>(null)

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

      const primary = await repo.clinics.primary(found.id)
      if (cancelled) return

      setPet(found)
      setClinic(primary)
      setForm({
        name: found.name,
        clinicName: primary?.name ?? '',
        clinicPhone: primary?.phone ?? '',
      })

      if (found.photo_id !== null) {
        let url: string | null = null
        try {
          url = await repo.photos.url(found.photo_id)
        } catch {
          // 사진 행이 없어도 화면은 떠야 합니다. 빈 자리로 둡니다.
          url = null
        }
        if (cancelled) {
          if (url !== null) URL.revokeObjectURL(url)
          return
        }
        savedUrl.current = url
        setSavedPreview(url)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // 화면을 떠날 때 Blob 을 붙잡고 있지 않게 합니다.
  useEffect(
    () => () => {
      if (savedUrl.current !== null) URL.revokeObjectURL(savedUrl.current)
      if (pickedUrl.current !== null) URL.revokeObjectURL(pickedUrl.current)
    },
    [],
  )

  const showPicked = (file: File | null) => {
    if (pickedUrl.current !== null) URL.revokeObjectURL(pickedUrl.current)
    pickedUrl.current = file === null ? null : URL.createObjectURL(file)
    setPickedPreview(pickedUrl.current)
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
      // 새로 골랐으면 "지우기"는 취소된 것입니다.
      setPhotoCleared(false)
      showPicked(resized.file)
    } catch (cause) {
      setPhotoError(
        cause instanceof PhotoError
          ? copy.petCreate.photoErrors[cause.failure]
          : copy.petCreate.photoErrors.decode_failed,
      )
    } finally {
      setBusy(null)
    }
  }

  /** 새로 고른 것이 있으면 그것만 무르고, 없으면 담겨 있던 사진을 지웁니다. */
  const clearPhoto = () => {
    setPhotoError(null)
    if (photo !== null) {
      setPhoto(null)
      showPicked(null)
      return
    }
    setPhotoCleared(true)
  }

  const set = <K extends keyof PetEditForm>(key: K, value: PetEditForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const onSubmit = async () => {
    setTried(true)
    if (pet === undefined || pet === null) return
    if (editProblemsOf(form).length > 0) return

    setBusy('save')
    setSaveError(null)
    try {
      const namePatch = namePatchOf(form, pet.name)

      if (photo !== null) {
        const photoId = await repo.photos.put(pet.id, photo.file)
        await repo.pets.update(pet.id, { ...namePatch, photo_id: photoId })
      } else if (photoCleared) {
        await repo.pets.update(pet.id, { ...namePatch, photo_id: null })
      } else if (namePatch !== null) {
        await repo.pets.update(pet.id, namePatch)
      }

      const action = clinicActionOf(form, clinic)
      if (action.kind === 'create') {
        await repo.clinics.create({
          pet_id: pet.id,
          name: action.name,
          phone: action.phone,
          address: null,
          lat: null,
          lng: null,
          is_primary: true,
        })
      } else if (action.kind === 'update') {
        await repo.clinics.update(action.id, { name: action.name, phone: action.phone })
      } else if (action.kind === 'remove') {
        await repo.clinics.softDelete(action.id)
      }

      navigate(HOME_PATH)
    } catch {
      setSaveError(copy.petCreate.saveFailed)
      setBusy(null)
    }
  }

  if (pet === undefined) return null
  /** 아이가 없으면 고칠 것도 없습니다. 관문이 갈 곳을 정합니다. */
  if (pet === null) return <Navigate to={PET_NEW_PATH} replace />

  const problems = tried ? editProblemsOf(form) : []
  /** 화면에 보여 줄 사진 — 새로 고른 것 > 담겨 있던 것 > 없음. */
  const preview = pickedPreview ?? (photoCleared ? null : savedPreview)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{copy.petEdit.title}</h1>
      <p className={styles.note}>{copy.petEdit.intro}</p>

      <Card>
        <Field
          label={copy.petCreate.name.label}
          placeholder={copy.petCreate.name.placeholder}
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
        />
      </Card>

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
            hint={copy.petEdit.clinicHint}
            value={form.clinicPhone}
            onChange={(event) => set('clinicPhone', event.target.value)}
          />
        </div>
      </Card>

      <Card>
        <span className={styles.label}>{copy.petCreate.photo.label}</span>
        <div className={styles.photoRow}>
          {preview === null ? null : (
            /* 미리보기라 설명이 필요 없습니다. 위의 이름 칸이 이미 이름입니다. */
            <img className={styles.preview} src={preview} alt="" />
          )}
          <div className={styles.photoActions}>
            <label className={styles.pick}>
              {busy === 'photo'
                ? copy.petCreate.photo.working
                : preview === null
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
            {preview === null ? null : (
              <Button variant="secondary" onClick={clearPhoto}>
                {copy.petCreate.photo.remove}
              </Button>
            )}
          </div>
        </div>
        <p className={styles.note}>
          {photo === null
            ? copy.petCreate.photo.hint
            : copy.petCreate.photo.ready(photo.width, photo.height, Math.round(photo.bytes / 1000))}
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
        {busy === 'save' ? copy.petEdit.working : copy.petEdit.cta}
      </Button>

      <Button variant="secondary" block onClick={() => navigate(HOME_PATH)}>
        {copy.common.back}
      </Button>
    </div>
  )
}
