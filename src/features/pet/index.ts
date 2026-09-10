/**
 * 아이 등록 (U10, PRD FR-1 ①).
 *
 * 온보딩 전체 흐름과 인트로는 U31 입니다. 여기 있는 것은 첫 칸 하나와
 * 사진 리사이즈(TECH_SPEC 11-6)뿐입니다.
 */
export { PetCreate } from './PetCreate'
export {
  EMPTY_FORM,
  MAX_APPROXIMATE_YEARS,
  approximateBirthDate,
  problemsOf,
  toNewPet,
  type AgeMode,
  type FormProblem,
  type PetForm,
} from './form'
export {
  MAX_BYTES,
  MAX_EDGE,
  PhotoError,
  QUALITY_LADDER,
  WEBP_MIME,
  WEBP_QUALITY,
  resizePhoto,
  type PhotoFailure,
  type ResizedPhoto,
} from './photo'
