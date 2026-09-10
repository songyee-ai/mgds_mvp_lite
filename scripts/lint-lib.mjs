/**
 * 원칙 린트 3종이 함께 쓰는 도구 (U03).
 *
 * 린트 스크립트는 3개인데 그중 둘(lint-copy·lint-hangul)이 JS/TS 소스에서
 * "주석을 뺀 코드"와 "문자열 리터럴 목록"을 똑같이 필요로 합니다. 정규식으로
 * 대충 훑으면 주석 안의 한글을 위반으로 잡거나(거짓 양성), 문자열 안의 `//` 를
 * 주석으로 착각해 뒤를 통째로 지워 위반을 놓칩니다(거짓 음성). CI 게이트가
 * 조용히 놓치는 것이 문서에만 원칙을 두는 것보다 나쁘므로 문자 단위로 훑습니다.
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** 한글 음절·자모. 문자열 안에 하나라도 있으면 한글 리터럴로 봅니다. */
export const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/

/**
 * `/` 가 나눗셈이 아니라 정규식의 시작일 수 있는 자리인지.
 *
 * `}` 는 일부러 뺐습니다. JSX 의 자기닫힘 태그(`<span ... {expr} />`)에서 `/`
 * 앞 글자가 `}` 라서, 넣어 두면 태그 닫기를 정규식 시작으로 오인합니다.
 */
function mayStartRegex(lastCode) {
  if (lastCode === '') return true
  return '(,=:[!&|?;+-*%<>~^'.includes(lastCode)
}

/**
 * 소스를 훑어 주석을 지운 텍스트와 문자열 리터럴 목록을 돌려줍니다.
 *
 * - 주석은 같은 길이의 공백으로 바꿉니다. 줄바꿈은 남겨서 줄 번호가 어긋나지 않습니다.
 * - 문자열·템플릿·정규식 리터럴 안의 `//` 는 주석으로 보지 않습니다.
 * - 템플릿 리터럴은 `${...}` 를 경계로 조각을 나눠 담습니다. 조각을 이어 붙이면
 *   원문에 없는 표현이 만들어져 거짓 양성이 납니다.
 *
 * 한계: `${...}` 안에 중첩된 문자열은 목록에 담기지 않습니다(주석 제거 결과에는
 * 남습니다). copy/ko.ts 는 순수 데이터라 실제로 문제가 되지 않습니다.
 */
export function scanSource(source) {
  const out = []
  const strings = []
  let line = 1
  let i = 0
  let lastCode = ''

  const emit = (ch) => {
    out.push(ch)
    if (!/\s/.test(ch)) lastCode = ch
  }
  const blank = (ch) => out.push(ch === '\n' ? '\n' : ' ')
  const count = (ch) => {
    if (ch === '\n') line += 1
  }

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1] ?? ''

    // 줄 주석
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        blank(source[i])
        i += 1
      }
      continue
    }

    // 블록 주석 (JSDoc, JSX 주석 `{/* */}` 포함)
    if (ch === '/' && next === '*') {
      blank(' ')
      blank(' ')
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        count(source[i])
        blank(source[i])
        i += 1
      }
      blank(' ')
      blank(' ')
      i += 2
      continue
    }

    // 정규식 리터럴. 같은 줄에서 닫히는 것만 정규식으로 인정합니다.
    // 닫히지 않으면 JSX 자기닫힘(`/>`)이나 나눗셈이므로 평범한 글자로 둡니다.
    if (ch === '/' && mayStartRegex(lastCode) && closesOnSameLine(source, i)) {
      blank(' ')
      i += 1
      let escaped = false
      let inClass = false
      while (i < source.length && source[i] !== '\n') {
        const c = source[i]
        blank(c)
        i += 1
        if (escaped) escaped = false
        else if (c === '\\') escaped = true
        else if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) break
      }
      continue
    }

    // 따옴표 문자열
    if (ch === "'" || ch === '"') {
      const quote = ch
      const startLine = line
      let value = ''
      let escaped = false
      emit(quote)
      i += 1
      while (i < source.length) {
        const c = source[i]
        emit(c)
        i += 1
        if (escaped) {
          value += c
          escaped = false
          continue
        }
        if (c === '\\') {
          escaped = true
          continue
        }
        if (c === quote) break
        count(c)
        value += c
      }
      strings.push({ value, line: startLine })
      continue
    }

    // 템플릿 리터럴
    if (ch === '`') {
      let startLine = line
      let value = ''
      let escaped = false
      emit(ch)
      i += 1
      while (i < source.length) {
        const c = source[i]

        if (!escaped && c === '$' && source[i + 1] === '{') {
          // 조각을 끊습니다. `${}` 를 사이에 두고 이어 붙이면 없던 말이 생깁니다.
          strings.push({ value, line: startLine })
          value = ''
          emit('$')
          emit('{')
          i += 2
          let depth = 1
          while (i < source.length && depth > 0) {
            const e = source[i]
            if (e === '{') depth += 1
            else if (e === '}') depth -= 1
            count(e)
            emit(e)
            i += 1
          }
          startLine = line
          continue
        }

        emit(c)
        i += 1
        if (escaped) {
          value += c
          escaped = false
          continue
        }
        if (c === '\\') {
          escaped = true
          continue
        }
        if (c === '`') break
        count(c)
        value += c
      }
      strings.push({ value, line: startLine })
      continue
    }

    count(ch)
    emit(ch)
    i += 1
  }

  return { stripped: out.join(''), strings }
}

function closesOnSameLine(source, start) {
  let escaped = false
  let inClass = false
  for (let i = start + 1; i < source.length; i += 1) {
    const c = source[i]
    if (c === '\n') return false
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') escaped = true
    else if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) return true
  }
  return false
}

/** 디렉토리를 훑어 확장자가 맞는 파일 경로를 모읍니다. 없는 디렉토리는 건너뜁니다. */
export function collectFiles(root, extensions) {
  const found = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries.sort()) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (extensions.some((ext) => entry.endsWith(ext))) found.push(full)
    }
  }
  walk(root)
  return found
}

/** 저장소 기준 상대 경로. 어느 OS 에서 돌려도 출력이 같도록 `/` 로 맞춥니다. */
export function displayPath(file, repoRoot) {
  return relative(repoRoot, file).split(sep).join('/')
}

/**
 * 위반 목록을 사람이 읽을 수 있게 출력하고 종료 코드를 정합니다.
 * CI 로그에서 "무엇이 왜 걸렸는지"가 한눈에 보여야 고치는 사람이 문서를 안 찾습니다.
 */
export function report(name, checked, violations) {
  if (violations.length === 0) {
    console.log(`  OK  ${name} — 검사 ${checked}건, 위반 없음`)
    return 0
  }

  console.error(`  NG  ${name} — 위반 ${violations.length}건`)
  for (const violation of violations) {
    console.error(`      ${violation.where}`)
    console.error(`        ${violation.what}`)
    if (violation.hint) console.error(`        → ${violation.hint}`)
  }
  return 1
}
