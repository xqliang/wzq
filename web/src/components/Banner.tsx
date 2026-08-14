// 木牌横幅：木匾底图 + 毛笔字（guqi 字体），tone 控制金/银/墨渐变。
// 复用于 胜利/失败/段位进阶/商店/签到/转盘 等标题。
export type BannerTone = 'gold' | 'silver' | 'ink'

export function Banner({ text, tone = 'gold' }: { text: string; tone?: BannerTone }) {
  return (
    <div className={`banner banner-${tone}`}>
      <span className="banner-text">{text}</span>
    </div>
  )
}
