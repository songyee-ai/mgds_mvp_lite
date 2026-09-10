/**
 * 빨간색·하드코딩 색상 검사 (U03).
 *
 * 검사 둘을 한 스크립트에 둡니다 (TECH_SPEC 16).
 *
 * 1. 빨간색 — `src/ui/tokens.css` 의 커스텀 속성 값을 HSL 로 바꿔
 *    hue 335~25° & 채도 30% 초과를 잡습니다. `--danger-text` 만 예외입니다.
 * 2. 하드코딩 색상 — 토큰 파일을 뺀 모든 `.css` 에서 `#`·`rgb(`·색상 키워드를 잡습니다.
 *
 * 대응 원칙: P6. 릴리스 차단 조건 PRD 4-1 (2).
 *
 * 팔레트에 빨강이 아예 없으면 상태 표시에 빨강을 쓸 방법이 없습니다. 그래서
 * "쓰지 말자"는 약속이 아니라 "쓸 수 없다"는 구조가 됩니다.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { collectFiles, displayPath, report } from './lint-lib.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS = join(repoRoot, 'src', 'ui', 'tokens.css')

/** 파괴적 동작 전용. 상태·건강 표시에 쓰지 않는 조건으로 예외입니다 (TECH_SPEC 14). */
const HUE_WHITELIST = new Set(['--danger-text'])

const RED_HUE_FROM = 335
const RED_HUE_TO = 25
const RED_SATURATION = 30

/** CSS 이름 있는 색. 값 자리에 이 단어가 나오면 하드코딩으로 봅니다. */
const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
   crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
   darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
   dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
   gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
   lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
   magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
   mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
   mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
   seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
   steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
   yellowgreen`
    .split(/\s+/)
    .filter(Boolean),
)

/** 색 자체가 아니라 "무엇을 상속할지"를 말하는 값들. 하드코딩이 아닙니다. */
const COLORLESS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none'])

/** 이름 있는 색을 실제로 받는 속성만 키워드 검사 대상으로 둡니다. */
const COLOR_PROPERTY = /(^|-)color$|^background|^border|^outline|^fill$|^stroke$|^box-shadow$|^text-shadow$/

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))

/**
 * CSS 에서 선언(`속성: 값`)을 전부 뽑습니다.
 *
 * 줄 시작에 고정하지 않는 것이 중요합니다. `.a { color: red; }` 처럼 한 줄에
 * 쓴 규칙이 검사를 그냥 통과해 버립니다.
 *
 * 값에 `{`·`}` 를 허용하지 않아 규칙 경계를 넘지 않습니다. 덕분에 `a:hover {`
 * 나 `@media (min-width: 500px) {` 같은 선택자·질의는 선언으로 잡히지 않습니다.
 */
function* declarations(css) {
  const pattern = /([\w-]+)\s*:\s*([^;{}]+)[;}]/g
  let match
  while ((match = pattern.exec(css)) !== null) {
    yield {
      property: match[1],
      value: match[2].trim(),
      line: css.slice(0, match.index).split('\n').length,
    }
  }
}

function toHsl(value) {
  const rgb = toRgb(value)
  if (rgb === null) return null

  const [r, g, b] = rgb.map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) return { hue: 0, saturation: 0, lightness: lightness * 100 }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue
  if (max === r) hue = 60 * (((g - b) / delta) % 6)
  else if (max === g) hue = 60 * ((b - r) / delta + 2)
  else hue = 60 * ((r - g) / delta + 4)

  return {
    hue: (hue + 360) % 360,
    saturation: saturation * 100,
    lightness: lightness * 100,
  }
}

function toRgb(value) {
  const text = value.trim().toLowerCase()

  const hex = /^#([0-9a-f]{3,8})$/.exec(text)
  if (hex !== null) {
    const digits = hex[1]
    if (digits.length === 3 || digits.length === 4) {
      return [0, 1, 2].map((i) => parseInt(digits[i].repeat(2), 16))
    }
    if (digits.length === 6 || digits.length === 8) {
      return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16))
    }
    return null
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(text)
  if (rgb !== null) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3)
    if (parts.length !== 3) return null
    const channels = parts.map((part) =>
      part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part),
    )
    return channels.some(Number.isNaN) ? null : channels
  }

  return null
}

const isRedHue = ({ hue, saturation }) =>
  (hue >= RED_HUE_FROM || hue <= RED_HUE_TO) && saturation > RED_SATURATION

// ── 1. 토큰의 빨간색 ────────────────────────────────────────────

const tokenViolations = []
let tokensChecked = 0

for (const { property, value, line } of declarations(stripCssComments(readFileSync(TOKENS, 'utf8')))) {
  if (!property.startsWith('--')) continue

  const hsl = toHsl(value)
  if (hsl === null) continue // 색이 아닌 토큰(--tap-min 등)과 transparent 는 넘어갑니다

  tokensChecked += 1
  if (!isRedHue(hsl) || HUE_WHITELIST.has(property)) continue

  tokenViolations.push({
    where: `${displayPath(TOKENS, repoRoot)}:${line}`,
    what: `빨강 계열 토큰 ${property}: ${value} (hue ${hsl.hue.toFixed(0)}°, 채도 ${hsl.saturation.toFixed(0)}%)`,
    hint: `상태 표시에 빨간색을 쓰지 않습니다 (PRD 원칙 P6 · PRD 11-3). 화이트리스트: ${[...HUE_WHITELIST].join(', ') || '(없음)'}`,
  })
}

// ── 2. 컴포넌트 CSS 의 하드코딩 색상 ────────────────────────────

const hardcodedViolations = []
let cssChecked = 0

for (const file of collectFiles(join(repoRoot, 'src'), ['.css'])) {
  if (file === TOKENS) continue
  cssChecked += 1

  for (const { property, value, line } of declarations(stripCssComments(readFileSync(file, 'utf8')))) {
    const where = `${displayPath(file, repoRoot)}:${line}`
    const hint = 'src/ui/tokens.css 에 토큰을 두고 var(--…) 로 쓰세요 (TECH_SPEC 14)'

    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(value)) {
      hardcodedViolations.push({ where, what: `하드코딩 색상 ${property}: ${value}`, hint })
      continue
    }

    // 이름 있는 색은 그 색을 실제로 받는 속성에서만 봅니다.
    // 안 그러면 font-family 의 글꼴 이름 같은 것이 걸립니다.
    if (!COLOR_PROPERTY.test(property)) continue
    for (const word of value.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (COLORLESS.has(word) || !NAMED_COLORS.has(word)) continue
      hardcodedViolations.push({ where, what: `색상 키워드 ${property}: ${value}`, hint })
      break
    }
  }
}

const redCode = report(`빨간색 토큰 (hue ${RED_HUE_FROM}~${RED_HUE_TO}° & 채도 ${RED_SATURATION}% 초과)`, tokensChecked, tokenViolations)
const hardCode = report('하드코딩 색상 (컴포넌트 CSS)', cssChecked, hardcodedViolations)

process.exit(redCode || hardCode)
