// 底部操作条：圆形木牌「菜单」（展开 提示/预演/悔棋/认输 等动作）与「设置」。
import { useState } from 'react'

export interface MenuAction {
  label: string
  onClick: () => void
}

export function GameMenu({
  actions,
  onSettings,
}: {
  actions: MenuAction[]
  onSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="game-menu">
      <button className="wood-btn" onClick={() => setOpen((v) => !v)}>菜单</button>
      <button className="wood-btn" onClick={onSettings}>设置</button>
      {open && (
        <div className="game-menu-pop">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                a.onClick()
                setOpen(false)
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
