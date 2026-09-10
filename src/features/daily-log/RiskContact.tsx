import { copy } from '../../copy'
import { Button, Card } from '../../ui'

/**
 * 위험 태그를 골랐을 때 그 자리에 나오는 병원 연락 (PRD FR-2-3).
 *
 * **놀라게 하는 것이 목적이 아닙니다.** 물어볼 곳이 있다는 것을 그 순간에
 * 알려 주는 것이 목적입니다. 그래서:
 *
 * - "응급"·"위급"·"위험" 같은 말을 쓰지 않습니다 (`lint-copy` 가 잡습니다)
 * - 빨간색을 쓰지 않습니다. 토큰에 빨강이 아예 없습니다
 * - 기본 버튼 그대로입니다. 강조 변형을 만들지 마세요
 *
 * 어떤 태그가 이 노출을 유발하는지는 `src/config/risk-tags.json` 입니다.
 * 코드가 아니라 설정 파일인 이유는 수의사가 감수하고 고칠 수 있어야 하기
 * 때문입니다.
 *
 * **병원 정보가 없으면 부르는 쪽이 이 블록을 아예 그리지 않습니다.**
 */
export interface RiskContactProps {
  clinicName: string
  phone: string
}

export function RiskContact({ clinicName, phone }: RiskContactProps) {
  return (
    <Card title={copy.riskContact.title}>
      <p>{clinicName}</p>
      {/* 원터치 전화 (PRD FR-9). 링크를 버튼 모양으로 감싸지 않고
          Button 의 onClick 으로 열어 tel: 스킴을 브라우저에 맡깁니다. */}
      <Button onClick={() => { window.location.href = `tel:${phone}` }}>
        {copy.riskContact.cta}
      </Button>
    </Card>
  )
}
