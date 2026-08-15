import type { ReactNode } from 'react'
import { Banner } from './Banner'

// 竞品风格弹窗面板（商店/签到/转盘共用）：全屏暗底 + 青蓝描边绢帛面板 +
// 顶部木匾标题 + 右上关闭 X + 可选货币条。色系与全站古风统一。
export function GamePanel({
  title,
  onClose,
  coins,
  scrolls,
  children,
}: {
  title: string
  onClose: () => void
  coins?: number
  scrolls?: number
  children: ReactNode
}) {
  return (
    <div className="gp-mask">
      <div className="gp-panel">
        <div className="gp-titlebar">
          <Banner text={title} tone="gold" />
          <button className="gp-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        {coins != null && (
          <div className="gp-currency">
            <span className="coin"><img src="/assets/img/icon_coin.png" alt="金币" />{coins}</span>
            <span className="scroll"><img src="/assets/img/icon_scroll.png" alt="卷轴" />{scrolls ?? 0}</span>
          </div>
        )}
        <div className="gp-content">{children}</div>
      </div>
    </div>
  )
}
