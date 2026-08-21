import { useEffect } from 'react'

// 预制快捷语（对局中常用，简短有礼貌/俏皮）。
const QUICK_TEXTS = [
  '你好呀',
  '下得真妙',
  '承让承让',
  '我要认真了',
  '这步好棋',
  '稍等，我想想',
  '还望海涵',
  '不玩了不玩了',
]

// 预制表情。
const EMOJIS = ['👍', '👏', '😄', '🤔', '😭', '🔥', '❤️', '🎉', '⚡', '😮', '🥺', '💪']

// 对战快捷语/表情面板：点自己头像弹出（浮在我方头像下方），预制常用对局用语 + 一组表情。
// 选中即回调并关闭；点击遮罩或按 Esc 关闭。
export function EmotePicker({ onPick, onClose }: { onPick: (text: string) => void; onClose: () => void }) {
  // 键盘 Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (t: string) => {
    onPick(t)
    onClose()
  }

  return (
    <div className="emote-pop">
      {/* 透明遮罩：点空白处关闭（不挡面板内点击）。 */}
      <div className="emote-backdrop" onClick={onClose} />
      <div className="emote-panel" onClick={(e) => e.stopPropagation()}>
        <div className="emote-section">
          {QUICK_TEXTS.map((t) => (
            <button key={t} className="emote-text" onClick={() => pick(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="emote-divider" />
        <div className="emote-section emote-emojis">
          {EMOJIS.map((e) => (
            <button key={e} className="emote-emoji" onClick={() => pick(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
