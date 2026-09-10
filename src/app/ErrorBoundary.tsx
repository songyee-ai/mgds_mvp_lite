import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly error: Error | null
}

/**
 * 최상위 에러 바운더리.
 * 렌더 중 예외가 나도 앱이 백지가 되지 않게 하고, 다시 시도할 길을 남깁니다.
 * 사용자에게 보이는 문구는 U03(카피 저장소)에서 다듬습니다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private readonly handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div role="alert" style={{ padding: '1rem' }}>
        <h1>화면을 여는 중 문제가 생겼어요</h1>
        <p>기록은 이 기기에 그대로 있습니다.</p>
        <button type="button" onClick={this.handleReload}>
          다시 열기
        </button>
      </div>
    )
  }
}
