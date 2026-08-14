// 通用结果弹窗：全屏暗底遮罩 + 居中卡片。
// win=true 走喜庆金/红配色；win=false 走素色。渲染标题、若干说明行与操作按钮组。
export function ResultModal({
  win,
  title,
  lines,
  actions,
}: {
  win: boolean
  title: string
  lines?: string[]
  actions: { label: string; onClick: () => void; primary?: boolean }[]
}) {
  return (
    <div className="modal-mask">
      <div className={win ? 'modal-card win' : 'modal-card lose'}>
        <h2 className="modal-title">{title}</h2>
        {lines?.map((l, i) => (
          <p className="modal-line" key={i}>
            {l}
          </p>
        ))}
        <div className="modal-actions">
          {actions.map((a, i) => (
            <button key={i} className={a.primary ? 'primary' : ''} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
