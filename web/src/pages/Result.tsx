import { useLocation, useNavigate } from 'react-router-dom'

// 结果页：展示胜负与经验变化，并提供「再来一局」。
// 人机：重开同难度；真人：重新进入同一房间（双方都点再来一局即自动开新局）。
export function Result() {
  const nav = useNavigate()
  const { state } = useLocation() as {
    state?: {
      win: boolean | number
      expDelta?: number
      reason?: string
      mode?: string
      level?: number
      roomId?: string
    }
  }
  const win = !!state?.win
  const timeout = state?.reason === 'timeout'

  // 再来一局：按模式重开。
  const rematch = () => {
    if (state?.mode === 'pvp' && state.roomId) {
      nav('/game', { state: { mode: 'pvp', roomId: state.roomId } })
    } else {
      nav('/game', { state: { mode: 'ai', level: state?.level ?? 1 } })
    }
  }

  return (
    <div className="result screen">
      <h1>{win ? '🎉 胜利' : '本局失败'}</h1>
      {timeout && !win && <p>超时判负</p>}
      <p>{win ? `+${state?.expDelta ?? 20} 经验` : '+5 经验，再接再厉！'}</p>
      <button onClick={rematch}>再来一局</button>
      {state?.mode === 'pvp' && <p className="tip">双方都点「再来一局」即在原房间开新局</p>}
      <button className="back-btn" onClick={() => nav('/')}>返回首页</button>
    </div>
  )
}
