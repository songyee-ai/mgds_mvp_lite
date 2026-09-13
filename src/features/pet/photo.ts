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

/**
 * 형식 사다리 (2026-09-13, 아이폰 실기기에서 사진이 안 담기던 것).
 *
 * **명세서는 WebP 를 정했지만, 브라우저가 WebP 로 못 쓰면 사진을 통째로
 * 잃습니다.** 그쪽이 더 나쁩니다.
 *
 * `canvas.toBlob` 은 모르는 형식을 요구받으면 **거절하지 않고 조용히 PNG 로
 * 떨어뜨립니다.** 그래서 아래 `encode` 가 돌려받은 `blob.type` 을 확인하고,
 * 요구한 형식이 아니면 그 형식을 못 쓰는 것으로 보고 다음 칸으로 갑니다.
 *
 * **JPEG 로 내려가는 것은 형식을 못 쓸 때뿐입니다.** WebP 로 쓸 수 있으면
 * 크기가 얼마든 WebP 를 씁니다 — 크기는 아래 `QUALITY_LADDER` 의 일이고,
 * 이 사다리는 "이 브라우저가 이 형식을 쓸 수 있는가"에만 반응합니다.
 * 두 사다리를 섞으면 같은 기기에서 사진마다 형식이 달라집니다.
 *
 * 저장·내보내기는 형식을 가리지 않습니다 — `Photo.blob` 이 자기 타입을
 * 들고 다니고 `export.ts` 가 그것을 그대로 옮깁니다.
 */
export const MIME_LADDER: readonly string[] = [WEBP_MIME, 'image/jpeg']

/** 형식마다 파일 이름 끝. `repo.photos.put` 은 이름을 보지 않지만 사람이 봅니다. */
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
}

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
  /** 실제로 쓰인 형식. WebP 를 못 쓰는 브라우저에서는 `image/jpeg` 입니다. */
  mime: string
}

/**
 * 그림을 픽셀로 바꿉니다. **두 길을 차례로 시도합니다.**
 *
 * `createImageBitmap` 이 먼저인 이유는 `imageOrientation: 'from-image'` 로
 * EXIF 회전을 명시적으로 요구할 수 있기 때문입니다 — 세로로 찍은 사진이
 * 눕는 것을 막는 자리입니다.
 *
 * 그것이 실패하면 `<img>` 로 갑니다. **둘의 디코더가 늘 같지는 않습니다** —
 * 특히 iOS 의 HEIC 는 `<img>` 로는 열리는데 `createImageBitmap` 으로는
 * 안 되는 경우가 보고됩니다. `<img>` 쪽도 요즘 브라우저는 EXIF 회전을
 * 기본으로 적용하므로(`image-orientation: from-image` 가 기본값) 결과는
 * 같습니다.
 *
 * 둘 다 실패해야 `decode_failed` 입니다.
 */
type Decoded = {
  draw: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function decode(source: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
    return {
      draw: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  } catch {
    // 아래 `<img>` 로 넘어갑니다. 여기서 던지면 두 번째 길이 막힙니다.
  }

  const url = URL.createObjectURL(source)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('img decode failed'))
      element.src = url
    })
    return {
      draw: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      // URL 은 캔버스에 그린 뒤에 반납합니다. 먼저 반납하면 그림이 비어 나옵니다.
      release: () => URL.revokeObjectURL(url),
    }
  } catch (cause) {
    URL.revokeObjectURL(url)
    throw new PhotoError('decode_failed', `createImageBitmap and <img> both failed: ${String(cause)}`)
  }
}

/**
 * 한 칸 써 봅니다. 이 브라우저가 그 형식을 못 쓰면 `null`.
 *
 * **`toBlob` 은 모르는 형식을 거절하지 않습니다.** 조용히 PNG 를 돌려줍니다.
 * 그대로 담으면 용량이 몇 배가 되어 "300KB 이하"가 소리 없이 깨지므로,
 * 돌려받은 타입을 확인해 다른 형식이면 못 쓰는 것으로 봅니다.
 */
async function encode(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality)
  })
  if (blob === null) return null
  return blob.type === mime ? blob : null
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
export async function resizePhoto(source: Blob, name = 'pet'): Promise<ResizedPhoto> {
  const decoded = await decode(source)

  try {
    const longest = Math.max(decoded.width, decoded.height)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context === null) throw new PhotoError('encode_failed', '2d context unavailable')
    context.drawImage(decoded.draw, 0, 0, width, height)

    /**
     * 사다리 둘을 겹쳐 내려갑니다.
     *
     * **바깥이 형식, 안이 품질입니다.** 형식 하나로 한 칸이라도 써지면 그
     * 형식으로 끝냅니다 — 크기가 안 맞아도 다음 형식으로 넘어가지 않습니다.
     * 넘어가면 같은 기기에서 사진마다 형식이 달라집니다.
     *
     * 품질 첫 칸이 명세서의 0.8 이고, 300KB 안에 들면 거기서 끝입니다 —
     * 실사 사진은 전부 여기서 끝납니다. 마지막 칸까지 가도 300KB 를 넘으면
     * **그래도 담습니다.** 사진을 잃는 것보다 조금 큰 사진이 낫고, 결과
     * 크기는 `bytes` 로 돌려주므로 부르는 쪽이 압니다.
     */
    for (const mime of MIME_LADDER) {
      let best: { blob: Blob; quality: number } | null = null

      for (const step of QUALITY_LADDER) {
        const blob = await encode(canvas, mime, step)
        // 첫 칸에서 막히면 이 브라우저가 이 형식을 못 쓰는 것입니다.
        if (blob === null) break
        best = { blob, quality: step }
        if (blob.size <= MAX_BYTES) break
      }

      if (best === null) continue

      const extension = EXTENSIONS[mime] ?? 'img'
      return {
        file: new File([best.blob], `${name}.${extension}`, { type: mime }),
        width,
        height,
        bytes: best.blob.size,
        quality: best.quality,
        mime,
      }
    }

    throw new PhotoError('encode_failed', `no usable format among ${MIME_LADDER.join(', ')}`)
  } finally {
    decoded.release()
  }
}
