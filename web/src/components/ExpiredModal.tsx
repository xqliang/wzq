import { useNavigate } from 'react-router-dom'
import type { ExpiredItem } from '../net/rest'

// 外观过期提示弹窗：打开游戏时若检测到已装备外观超过 7 天有效期（已自动回退基础款），
// 弹窗列出失效项，引导用户前往商城重新购买。
export function ExpiredModal({ items, onClose }: { items: ExpiredItem[]; onClose: () => void }) {
  const nav = useNavigate()
  if (!items || items.length === 0) return null
  // 槽位中文名映射。
  const slotName: Record<string, string> = { board: '棋盘皮肤', frame: '头像框', effect: '落子动效' }
  return (
    <div className="exp-mask" onClick={onClose}>
      <div className="exp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="exp-title">外观已过期</div>
        <div className="exp-desc">以下外观已超过 7 天有效期，已恢复为默认款式：</div>
        <ul className="exp-list">
          {items.map((it, i) => (
            <li key={i}>
              <span className="exp-slot">{slotName[it.slot] ?? it.slot}</span>
              <span className="exp-name">{it.name}</span>
            </li>
          ))}
        </ul>
        <div className="exp-actions">
          <button className="exp-btn secondary" onClick={onClose}>稍后再去</button>
          <button className="exp-btn primary" onClick={() => { onClose(); nav('/shop') }}>前往商城</button>
        </div>
      </div>
    </div>
  )
}
