import type { ReactNode } from 'react'
import { img } from '../lib/asset'
import { Banner } from './Banner'

// 竞品风格弹窗面板（商店/签到/转盘共用）：全屏暗底 + 青蓝描边绢帛面板 +
// 顶部木匾标题 + 右上关闭 X + 可选货币条 + 可选左侧挂栏（商店分类灯笼）。
export function GamePanel({
  title,
  onClose,
  coins,
  scrolls,
  sidebar,
  children,
}: {
  title: string
  onClose: () => void
  coins?: number
  scrolls?: number
  sidebar?: ReactNode
  children: ReactNode
}) {
  const hasSidebar = !!sidebar
  return (
    <div className={`gp-mask${hasSidebar ? ' has-sidebar' : ''}`}>
      <div className={`gp-panel${hasSidebar ? ' has-sidebar' : ''}`}>
        <div className="gp-roof" aria-hidden="true" />
        <div className="gp-titlebar">
          <Banner text={title} tone="gold" />
          <button className="gp-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        {coins != null && (
          <div className="gp-currency">
            <span className="coin"><img src={img('icon_coin')} alt="金币" />{coins}</span>
            <span className="scroll"><img src={img('icon_scroll')} alt="卷轴" />{scrolls ?? 0}</span>
          </div>
        )}
        {sidebar && <div className="gp-sidebar">{sidebar}</div>}
        <div className="gp-content">{children}</div>
      </div>
    </div>
  )
}
