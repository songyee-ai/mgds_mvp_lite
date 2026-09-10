import { useEffect, useRef, useState } from 'react'
import intro1 from './assets/intro-1.mp4'
import intro2 from './assets/intro-2.mp4'
import intro3 from './assets/intro-3.mp4'
import poster1 from './assets/intro-1-poster.webp'
import poster2 from './assets/intro-2-poster.webp'
import poster3 from './assets/intro-3-poster.webp'
import styles from './intro.module.css'

/**
 * 인트로 3장의 일러스트. 움직이는 그림입니다.
 *
 * ## 무엇이 들어 있나
 *
 * 960×960 · 5.04초 · 24fps · H.264 · **오디오 트랙 없음**.
 * 239 / 193 / 364 KB (합 796 KB).
 *
 * ```
 * 1장 바라보기  창가 소파에 앉은 보호자, 햇살에 엎드린 아이
 * 2장 남겨보기  손에 든 기록 카드, 위로 떠오르는 지난 기록들
 * 3장 이어가기  강변 산책길을 나란히 걷는 뒷모습, 멀리 도시
 * ```
 *
 * ## 압축 — 다시 인코딩할 때
 *
 * 받은 원본은 합 2.9MB 였고 아래 설정으로 796KB 가 됐습니다. **원본을
 * 다시 받으면 같은 명령을 그대로 쓰세요.**
 *
 * ```
 * ffmpeg -i <원본> -c:v libx264 -crf 28 -preset slow -tune animation \
 *   -pix_fmt yuv420p -profile:v main -level 4.0 \
 *   -movflags +faststart -an <출력>
 * ```
 *
 * 각 옵션이 왜 있는지:
 *
 * - `-crf 28` — 3장 기준 SSIM 0.982. 원본과 나란히 2배로 확대해 하늘
 *   그라디언트와 인물 디테일을 비교했고 구분되지 않았습니다. 더 줄이려면
 *   31 까지 가도 밴딩이 없었습니다(합 538KB).
 * - `-tune animation` — 같은 SSIM 에 **11% 작습니다.** 회화체 애니메이션에
 *   맞는 디블로킹 설정이라 원본의 블록 노이즈까지 정리됩니다.
 * - `-movflags +faststart` — `moov` 를 `mdat` 앞으로 옮겨 **다 받기 전에
 *   재생이 시작됩니다.** 이게 없으면 파일 전체를 받아야 첫 프레임이 뜹니다.
 * - `-an` — 오디오 트랙을 확실히 없앱니다. 자동 재생의 전제입니다.
 * - `-profile:v main -level 4.0 -pix_fmt yuv420p` — 구형 기기까지 디코딩
 *   되는 조합입니다. `high` 나 `yuv444p` 로 두면 일부 안드로이드에서
 *   재생되지 않습니다.
 *
 * **H.264 를 유지합니다.** VP9·AV1·HEVC 는 같은 품질에 더 작지만 기기별
 * 디코딩 지원이 갈립니다. 첫 화면에서 재생이 안 되는 것보다 조금 큰 것이
 * 낫습니다.
 *
 * ## 왜 SVG 가 아니라 영상인가
 *
 * 처음에는 세 장을 손으로 쓴 인라인 SVG 로 그렸습니다. 회화 스타일의
 * 레퍼런스가 나오고 나서 **그 매체로는 재현할 수 없다는 것이 분명해졌습니다**
 * — 그라디언트로 칠한 그림에 피부톤·머리카락·물의 반사가 있고, 색이
 * 여덟 계열입니다. path 로 흉내내면 단순한 추상보다 못합니다.
 *
 * 벡터 판은 git 이력에 있습니다 (`IntroArt.tsx`). 되살릴 일이 있으면
 * 그 파일과 `intro.module.css` 의 `.art*` 클래스를 함께 꺼내세요.
 *
 * ## 잘립니다
 *
 * 정사각 영상을 정사각이 아닌 칸에 넣으므로 `object-fit: cover` 로 덮고
 * 넘치는 쪽을 자릅니다. 요즘 휴대폰에서 좌우 각 6~10%, 세로가 짧은
 * 화면에서 위아래 각 10% 입니다. 자세한 표는 `intro.module.css` 의
 * `.artFrame` 주석에 있습니다.
 *
 * ## 움직임을 원하지 않는 사람에게는 그림만
 *
 * `prefers-reduced-motion: reduce` 면 **영상을 아예 부르지 않고 포스터
 * 이미지만 보여 줍니다.** 전정 장애가 있는 사람에게 반복 움직임은 어지럼을
 * 일으킬 수 있고, 이 그림들은 정지 상태로도 완결입니다.
 *
 * iOS 의 「동작 줄이기」가 그 설정입니다. **흔하게 켜져 있어서 이 경로는
 * 예외가 아닙니다** — 그 사람들에게 796KB 를 받게 하지 않는 것이 이
 * 분기의 절반입니다.
 *
 * ## 자동 재생이 막히는 경우
 *
 * 저전력 모드, Safari 의 자동 재생 설정 같은 것들이 `play()` 를 거부합니다.
 * 그때는 포스터가 그림으로 남고, **화면을 한 번 만지면 다시 시도해서
 * 살립니다** — 제스처 뒤에는 같은 호출이 허용됩니다.
 */

/** 장 순서대로. `copy.intro.pages` 와 같은 순서여야 합니다. */
const SOURCES = [intro1, intro2, intro3] as const

/**
 * 각 영상의 첫 프레임. 같은 순서입니다.
 *
 * `ffmpeg -i intro-N.mp4 -frames:v 1 -c:v libwebp -quality 82 intro-N-poster.webp`
 *
 * 25 / 19 / 37 KB. 왜 필요한지는 `<video poster>` 쪽 주석에 있습니다.
 */
const POSTERS = [poster1, poster2, poster3] as const

/**
 * 움직임을 줄이라는 설정을 보고 있는지.
 *
 * 마운트 때 한 번만 읽지 않고 구독합니다 — 사용자가 설정을 바꾸면 그
 * 자리에서 반영되어야 합니다. 그리고 `matchMedia` 가 없는 환경(테스트의
 * jsdom 등)에서도 죽지 않아야 합니다.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export interface IntroMediaProps {
  /** 0부터 시작하는 장 번호. */
  readonly step: number
}

export function IntroMedia({ step }: IntroMediaProps) {
  const reduced = useReducedMotion()
  const video = useRef<HTMLVideoElement | null>(null)
  const src = SOURCES[step]
  const poster = POSTERS[step]

  /**
   * 화면을 한 번 만지면 멈춰 있는 영상을 다시 재생해 봅니다.
   *
   * **실기기에서 2·3장이 정지 화면으로 나왔습니다.** iOS 는 저전력 모드,
   * 손쉬운 사용의 「동작 줄이기」, Safari 의 자동 재생 설정 중 하나만
   * 켜져 있어도 자동 재생을 막습니다. 그때 `play()` 가 거부되고 첫
   * 프레임만 남습니다.
   *
   * **사용자 제스처 뒤에는 같은 `play()` 가 허용됩니다.** 그래서 한 번
   * 만지면 다시 부릅니다. 인트로는 [다음]을 눌러야 넘어가므로 2장부터는
   * 사실상 항상 움직입니다.
   *
   * `prefers-reduced-motion` 이 켜진 사람에게는 시도하지 않습니다 —
   * 그건 막힌 것이 아니라 요청받은 것입니다.
   */
  useEffect(() => {
    if (reduced) return
    const retry = () => {
      const element = video.current
      if (element !== null && element.paused) {
        void element.play().catch(() => {
          // 계속 막혀 있으면 포스터가 그 자리를 지킵니다.
        })
      }
    }
    // `pointerdown` 하나로 터치와 마우스를 다 받습니다.
    window.addEventListener('pointerdown', retry)
    return () => window.removeEventListener('pointerdown', retry)
  }, [reduced])

  /**
   * 다음 장의 영상을 미리 받아 둡니다.
   *
   * 화면에는 지금 장의 영상 하나만 있습니다(`IntroScreen` 이 현재 장만
   * 그립니다). 그래서 [다음]을 누르면 그 자리에서 200KB 를 새로 받기
   * 시작하고, 받는 동안 포스터가 그 자리를 지킵니다.
   *
   * 응답을 쓰지 않고 버립니다 — 목적은 브라우저 HTTP 캐시에 넣는 것이고,
   * 실제 재생은 `<video>` 가 같은 주소로 다시 요청해 캐시에서 가져옵니다.
   * **중단하지 않습니다.** 장을 넘기는 순간 취소되면 미리 받은 뜻이
   * 없어집니다.
   *
   * **움직임을 줄이라고 한 사람에게는 받지 않습니다.** 재생하지 않을
   * 영상입니다.
   */
  useEffect(() => {
    if (reduced) return
    const next = SOURCES[step + 1]
    if (next === undefined) return
    void fetch(next).catch(() => {
      // 미리 받기가 실패해도 재생은 됩니다. 조금 늦어질 뿐입니다.
    })
  }, [step, reduced])

  /**
   * `autoPlay` 만으로 되지 않는 브라우저가 있어 한 번 더 부릅니다.
   * 저전력 모드처럼 재생이 막히는 상황에서는 실패하는데, 그때는 포스터가
   * 그림으로 남고 사용자가 화면을 만지면 위의 재시도가 살립니다.
   */
  const onLoadedData = () => {
    const element = video.current
    if (element === null) return
    void element.play().catch(() => {
      // 포스터가 그 자리를 지킵니다.
    })
  }

  if (src === undefined || poster === undefined) return null

  /**
   * **움직임을 줄이라고 한 사람에게는 영상을 아예 받지 않습니다.**
   *
   * 처음에는 `<video>` 를 그대로 두고 자동 재생만 끄고 첫 프레임에서
   * 멈췄습니다. 화면은 맞았지만 **재생하지도 않을 796KB 를 그대로
   * 내려받았습니다.** 포스터가 그 첫 프레임과 같은 그림이므로 영상을
   * 부를 이유가 없습니다.
   *
   * 79KB 로 끝나고, `currentTime` 을 밀어 프레임을 그리게 하는 요령도
   * 필요 없어집니다. iOS 의 「동작 줄이기」는 흔하게 켜져 있어서 이 경로가
   * 예외가 아닙니다.
   *
   * 설정을 도중에 끄면 `reduced` 가 바뀌어 `<video>` 로 갈아탑니다.
   */
  if (reduced) {
    return <img className={styles.artMedia} src={poster} alt="" draggable={false} />
  }

  return (
    <video
      /**
       * 장이 바뀌면 새 요소로 만듭니다. `src` 만 바꾸면 이전 장의 마지막
       * 프레임이 잠깐 남습니다.
       */
      key={src}
      /**
       * **`muted` 를 속성으로도 직접 박습니다.**
       *
       * React 는 `muted` 를 DOM 속성(property)으로만 설정하고 HTML
       * 어트리뷰트는 남기지 않습니다. iOS Safari 는 자동 재생 자격을
       * **어트리뷰트로** 판단하는 경로가 있어서, React 로 만든 무음
       * 영상이 아이폰에서 자동 재생되지 않는 일이 생깁니다.
       *
       * 둘 다 해 둡니다. 손해가 없습니다.
       */
      ref={(element) => {
        video.current = element
        if (element === null) return
        element.muted = true
        element.setAttribute('muted', '')
      }}
      className={styles.artMedia}
      src={src}
      /**
       * **첫 프레임을 이미지로 미리 깔아 둡니다.**
       *
       * 실기기에서 1장이 아예 비어 있었습니다. iOS 는 `preload="auto"` 를
       * 무시하고 재생이 시작될 때까지 데이터를 받지 않는 경우가 많은데,
       * 자동 재생까지 막혀 있으면 프레임이 한 장도 디코딩되지 않아
       * **그림이 없는 상태로 남습니다.**
       *
       * 2·3장은 다음 장 미리 받기 덕에 캐시에 있어서 프레임이 나왔고,
       * 1장만 비었던 것이 그 증거입니다.
       *
       * 포스터는 25~37KB 짜리 WebP 라 즉시 뜨고, 영상이 준비되면 그 위를
       * 덮습니다. 재생이 끝까지 막히는 기기에서는 이 이미지가 그림으로
       * 남습니다 — 정지 상태로도 완결이라 잃는 것이 없습니다.
       */
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      onLoadedData={onLoadedData}
      /** 그림입니다. 재생 조작을 노출하지 않습니다. */
      controls={false}
      disablePictureInPicture
    />
  )
}
