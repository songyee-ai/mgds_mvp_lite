/**
 * Blob 을 파일로 내려받게 하는 한 가지 방법 (U09).
 *
 * DOM 을 만지는 유일한 자리라 따로 두었습니다. `data/export.ts` 는 Blob 만
 * 만들고, `autoBackup.ts` 는 이 함수를 인자로 받습니다. 그래서 자동 백업의
 * 실패 경로를 브라우저 없이 단위 테스트할 수 있습니다.
 *
 * ⚠️ **자동 다운로드는 브라우저가 막을 수 있습니다** (TECH_SPEC 8-6 대응
 * 2번의 ⚠️, 명세서 21장 T11). 사용자 조작 없이 부르는 경우가 특히 그렇습니다.
 * 여기서 예외가 나면 부르는 쪽이 삼켜야 하고, 기록 흐름은 계속되어야 합니다.
 *
 * `revokeObjectURL` 을 즉시 부르지 않는 이유는 브라우저가 URL 을 읽기
 * 시작하기 전에 취소되면 다운로드가 조용히 실패하기 때문입니다. 다음
 * 이벤트 루프로 넘깁니다.
 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
