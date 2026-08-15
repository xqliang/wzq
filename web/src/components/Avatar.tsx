// 头像 + 外框容器。默认叠古风金环（复刻竞品）；frame 可切换其它头像框皮肤（阶段 C）。
export function Avatar({
  src,
  size = 56,
  frame = 'gold',
}: {
  src: string
  size?: number
  frame?: string
}) {
  return (
    <div className={`avatar-box frame-${frame}`} style={{ width: size, height: size }}>
      <img src={src} alt="" className="avatar-img" />
    </div>
  )
}
