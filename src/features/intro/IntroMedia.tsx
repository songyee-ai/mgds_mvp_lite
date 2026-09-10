import { useEffect, useRef, useState } from 'react'
import intro1 from './assets/intro-1.mp4'
import intro2 from './assets/intro-2.mp4'
import intro3 from './assets/intro-3.mp4'
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
 * ## 움직임을 원하지 않는 사람에게는 멈춥니다
 *
 * `prefers-reduced-motion: reduce` 면 자동 재생하지 않고 **첫 프레임에서
 * 멈춥니다.** 전정 장애가 있는 사람에게 반복 움직임은 어지럼을 일으킬 수
 * 있고, 이 그림들은 정지 상태로도 완결입니다.
 *
 * 멈춘 상태에서 화면이 비지 않게 `currentTime` 을 아주 조금 옮깁니다 —
 * 브라우저가 프레임을 실제로 그리게 만드는 유일한 확실한 방법입니다.
 * `preload` 만으로는 검은 화면이나 빈 화면이 남는 브라우저가 있습니다.
 */

/** 장 순서대로. `copy.intro.pages` 와 같은 순서여야 합니다. */
const SOURCES = [intro1, intro2, intro3] as const

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

  /**
   * 다음 장의 영상을 미리 받아 둡니다.
   *
   * 화면에는 지금 장의 영상 하나만 있습니다(`IntroScreen` 이 현재 장만
   * 그립니다). 그래서 [다음]을 누르면 그 자리에서 720KB 를 새로 받기
   * 시작하고, 받는 동안 그림 자리가 빈 채로 남습니다.
   *
   * 응답을 쓰지 않고 버립니다 — 목적은 브라우저 HTTP 캐시에 넣는 것이고,
   * 실제 재생은 `<video>` 가 같은 주소로 다시 요청해 캐시에서 가져옵니다.
   * **중단하지 않습니다.** 장을 넘기는 순간 취소되면 미리 받은 뜻이
   * 없어집니다.
   */
  useEffect(() => {
    const next = SOURCES[step + 1]
    if (next === undefined) return
    void fetch(next).catch(() => {
      // 미리 받기가 실패해도 재생은 됩니다. 조금 늦어질 뿐입니다.
    })
  }, [step])

  const onLoadedData = () => {
    const element = video.current
    if (element === null) return
    if (reduced) {
      /**
       * 멈춘 채로 첫 프레임을 그리게 합니다. 0 으로 두면 브라우저가
       * "이미 그 자리"라고 보고 아무것도 그리지 않아 빈 화면이 남습니다.
       */
      element.currentTime = 0.01
      return
    }
    /**
     * `autoPlay` 만으로 되지 않는 브라우저가 있어 한 번 더 부릅니다.
     * 저전력 모드처럼 재생이 막히는 상황에서는 실패하는데, 그때는 첫
     * 프레임이 정지 화면으로 남습니다 — 받아들일 수 있는 결과입니다.
     */
    void element.play().catch(() => {
      element.currentTime = 0.01
    })
  }

  if (src === undefined) return null

  return (
    <video
      /**
       * 장이 바뀌면 새 요소로 만듭니다. `src` 만 바꾸면 이전 장의 마지막
       * 프레임이 잠깐 남습니다.
       */
      key={src}
      ref={video}
      className={styles.artMedia}
      src={src}
      muted
      loop
      playsInline
      autoPlay={!reduced}
      preload="auto"
      onLoadedData={onLoadedData}
      /** 그림입니다. 재생 조작을 노출하지 않습니다. */
      controls={false}
      disablePictureInPicture
    />
  )
}
