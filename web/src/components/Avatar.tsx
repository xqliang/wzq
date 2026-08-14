// 头像 + 外框容器。阶段 A 只用默认框；frame 预留给阶段 C 的头像框皮肤。
export function Avatar({
  src,
  size = 56,
  frame = 'none',
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
