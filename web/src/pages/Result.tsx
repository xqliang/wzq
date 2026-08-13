import { useLocation, useNavigate } from 'react-router-dom'

// 结果页：展示胜负与经验变化。
export function Result() {
  const nav = useNavigate()
  const { state } = useLocation() as { state?: { win: boolean | number; expDelta?: number } }
  const win = !!state?.win
  return (
    <div className="result screen">
      <h1>{win ? '🎉 胜利' : '本局失败'}</h1>
      <p>{win ? `+${state?.expDelta ?? 20} 经验` : '+5 经验，再接再厉！'}</p>
      <button onClick={() => nav('/')}>返回首页</button>
      <button onClick={() => nav(-1)}>再来一局</button>
    </div>
  )
}
