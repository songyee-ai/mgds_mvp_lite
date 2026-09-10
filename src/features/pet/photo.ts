/**
 * 사진 리사이즈 (TECH_SPEC 11-6 · U10).
 *
 * | 단계 | 방식 |
 * |---|---|
 * | 1~5 | IndexedDB `photos` 에 Blob. **최대 1024px, WebP, 품질 0.8** |
 * | 6+ | Supabase Storage (U28 이후) |
 *
 * **`repo.photos.put` 은 여전히 받은 것을 그대로 담습니다.** 리사이즈를 저장소
 * 안으로 넣지 않은 이유는 두 가지입니다.
 *
 * 1. `canvas` 는 브라우저에만 있습니다. `data/` 는 fake-indexeddb 만으로 전부
 *    단위 테스트되는 계층이고, 거기에 "캔버스가 없으면 원본을 담는다"는
 *    우회로를 두면 **"300KB 이하"라는 완료 판정이 정작 그것을 주장하는
 *    계층에서 검증 불가능해집니다.** 있으나 마나 한 게이트가 됩니다.
 * 2. HEIC 실패는 사용자에게 보여 줄 문구가 필요한 실패입니다.
 *    `Repo.photos.put` 의 계약은 `Promise<string>` 이라 실패 종류를 실어
 *    보낼 통로가 없습니다.
 *
 * 그래서 **사진을 담는 쪽은 반드시 이 함수를 거쳐야 합니다.** 지금 유일한
 * 사용처는 `PetCreate` 이고, 새 사용처가 생기면 여기를 통과시키세요.
 */

/** TECH_SPEC 11-6 이 정한 값 3개. 여기서만 정합니다. */
export const MAX_EDGE = 1024
export const WEBP_QUALITY = 0.8
export const WEBP_MIME = 'image/webp'

/** U10 완료 판정 2 — "리사이즈 후 파일 크기 300KB 이하". */
export const MAX_BYTES = 300_000

/**
 * 압축 사다리 (2026-09-09, 사용자 결정).
 *
 * **명세서 안의 두 줄이 부딪히는 자리입니다.** 산출물은 파라미터를 고정하고
 * ("최대 1024px, WebP, 품질 0.8") 완료 판정은 결과를 요구합니다
 * ("300KB 이하"). 고정 파라미터로는 결과가 보장되지 않습니다 — 실측:
 *
 * | 1024px WebP q0.8 결과 | 크기 |
 * |---|---|
 * | 실사에 가까운 내용 4:3 · 1:1 | 19KB · 24KB |
 * | 순수 노이즈 4:3 (1024×768) | 292KB |
 * | **순수 노이즈 1:1 (1024×1024)** | **391KB** |
 *
 * 정사각은 4:3 보다 화소가 33% 많아 같은 내용에서도 더 큽니다. 순수 노이즈는
 * 카메라가 만들지 않는 내용이지만, 털·풀·나뭇잎 클로즈업이 그 방향입니다.
 *
 * 그래서 **항상 0.8 로 먼저 시도하고, 300KB 를 넘을 때만** 낮춥니다.
 * 실사 사진은 첫 시도에서 끝나므로 명세서의 "품질 0.8" 이 사실상 모든
 * 사진에 그대로 적용됩니다. TECH_SPEC 9-3 이 요약서 A4 1장을 보장하는
 * 방식과 같은 모양입니다.
 *
 * 마지막 칸까지 가도 300KB 를 넘으면 **그래도 담습니다.** 사진을 잃는 것보다
 * 조금 큰 사진을 갖는 편이 낫고, 결과 크기는 `ResizedPhoto.bytes` 로
 * 돌려주므로 부르는 쪽이 알 수 있습니다.
 */
export const QUALITY_LADDER: readonly number[] = [WEBP_QUALITY, 0.6, 0.45]

/** 사진을 담지 못한 이유. 화면이 문구를 고르는 근거입니다. */
export type PhotoFailure =
  /** 이 브라우저가 읽을 수 없는 형식입니다. HEIC 가 대표적입니다. */
  | 'decode_failed'
  /** 읽기는 됐는데 WebP 로 다시 쓰지 못했습니다. */
  | 'encode_failed'

/**
 * 문구를 담지 않는 예외입니다. 화면이 `failure` 로 `copy/ko.ts` 를 찾습니다
 * (TECH_SPEC 13). `data/export.ts` 의 `ImportError` 와 같은 모양입니다.
 */
export class PhotoError extends Error {
  readonly failure: PhotoFailure

  constructor(failure: PhotoFailure, message: string) {
    super(message)
    this.name = 'PhotoError'
    this.failure = failure
  }
}

export type ResizedPhoto = {
  /** `repo.photos.put` 에 그대로 넘길 수 있는 모양. */
  file: File
  width: number
  height: number
  /** 바이트. 완료 판정("300KB 이하")을 화면에서 확인할 수 있게 함께 돌려줍니다. */
  bytes: number
  /** 실제로 쓰인 품질. 사다리를 내려갔으면 0.8 이 아닙니다. */
  quality: number
}

/**
 * 긴 변을 1024px 로 맞추고 WebP 품질 0.8 로 다시 씁니다.
 *
 * 이미 1024px 이하면 **키우지 않습니다** — 작은 사진을 늘리면 용량만 늘고
 * 화질은 그대로입니다. 그래도 WebP 로 다시 쓰기는 합니다. 형식을 하나로
 * 모아 두면 6단계의 Storage 경로(`{photo_id}.webp`)가 예외 없이 성립합니다.
 *
 * EXIF 회전은 `createImageBitmap` 의 `imageOrientation: 'from-image'` 가
 * 처리합니다. 세로로 찍은 사진이 눕는 것을 막는 자리입니다. 캔버스에 그린
 * 뒤에는 EXIF 가 남지 않으므로 **위치 정보 같은 메타데이터도 함께 사라집니다** —
 * 가입 전 서버 전송이 0건이라는 성질(TECH_SPEC 8-7)과 같은 방향입니다.
 */
export async function resizePhoto(source: Blob, name = 'pet.webp'): Promise<ResizedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  } catch (cause) {
    throw new PhotoError('decode_failed', `createImageBitmap failed: ${String(cause)}`)
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context === null) throw new PhotoError('encode_failed', '2d context unavailable')
    context.drawImage(bitmap, 0, 0, width, height)

    /**
     * 사다리를 내려갑니다. 첫 칸이 명세서의 0.8 이고, 300KB 안에 들면
     * 거기서 끝입니다 — 실사 사진은 전부 여기서 끝납니다.
     */
    let blob: Blob | null = null
    let quality = WEBP_QUALITY
    for (const step of QUALITY_LADDER) {
      quality = step
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, WEBP_MIME, step)
      })
      if (blob === null) throw new PhotoError('encode_failed', 'toBlob returned null')
      /**
       * WebP 를 못 쓰는 브라우저는 **조용히 PNG 로 떨어뜨립니다.** 그러면
       * 용량이 몇 배가 되어 "300KB 이하"가 조용히 깨집니다. 확인합니다.
       */
      if (blob.type !== WEBP_MIME) {
        throw new PhotoError('encode_failed', `expected ${WEBP_MIME}, got ${blob.type}`)
      }
      if (blob.size <= MAX_BYTES) break
    }
    if (blob === null) throw new PhotoError('encode_failed', 'ladder produced nothing')

    return {
      file: new File([blob], name, { type: WEBP_MIME }),
      width,
      height,
      bytes: blob.size,
      quality,
    }
  } finally {
    bitmap.close()
  }
}
