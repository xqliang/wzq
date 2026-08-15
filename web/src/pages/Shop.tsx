import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { shopState, shopBuy, shopEquip } from '../net/rest'
import type { ShopState, ShopItem } from '../net/rest'
import { GamePanel } from '../components/GamePanel'
import { Avatar } from '../components/Avatar'
import { getTheme } from '../board/themes'
import { setSettings } from '../audio/audio'
import type { Effect } from '../audio/audio'

// 商店分类（对齐竞品：棋盘 / 头像框 / 落子动效）。
const SLOTS = [
  { key: 'board', label: '棋盘' },
  { key: 'frame', label: '头像框' },
  { key: 'effect', label: '落子' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

// 商店页：竞品风格面板 + 左侧分类标签 + 卡片网格（名称/预览/购买或装备）。
export function Shop() {
  const nav = useNavigate()
  const [state, setState] = useState<ShopState | null>(null)
  const [slot, setSlot] = useState<SlotKey>('board')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    shopState().then(setState).catch(() => setErr('加载商店失败'))
  }, [])

  // 应用最新商店状态，并把已装备的棋盘皮肤/落子动效同步到本地设置（即时生效）。
  const apply = (next: ShopState) => {
    setState(next)
    setSettings({ theme: next.equipped.board, effect: next.equipped.effect as Effect })
  }
  const buy = (it: ShopItem) => {
    setBusy(true)
    setErr('')
    shopBuy(it.slot, it.id).then(apply).catch(() => setErr('金币/卷轴不足或已拥有')).finally(() => setBusy(false))
  }
  const equip = (it: ShopItem) => {
    setBusy(true)
    setErr('')
    shopEquip(it.slot, it.id).then(apply).catch(() => setErr('装备失败')).finally(() => setBusy(false))
  }

  if (!state) return <div className="loading">{err || '加载中…'}</div>
  const items = state.items.filter((i) => i.slot === slot)

  return (
    <GamePanel title="商店" onClose={() => nav('/')} coins={state.coins} scrolls={state.scrolls}>
      <div className="shop-body">
        <div className="shop-tabs">
          {SLOTS.map((s) => (
            <button key={s.key} className={`shop-tab${slot === s.key ? ' active' : ''}`} onClick={() => setSlot(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="shop-grid">
          {items.map((it) => (
            <div key={it.slot + it.id} className={`shop-card${it.equipped ? ' equipped' : ''}`}>
              <div className="shop-card-name">{it.name}</div>
              <ItemPreview item={it} />
              <div className="shop-card-foot">
                {it.equipped ? (
                  <span className="tag-equipped">已装备</span>
                ) : it.owned ? (
                  <button className="op-btn" disabled={busy} onClick={() => equip(it)}>装备</button>
                ) : (
                  <button className="price-btn" disabled={busy} onClick={() => buy(it)}>
                    <img src={it.currency === 'scrolls' ? '/assets/img/icon_scroll.png' : '/assets/img/icon_coin.png'} alt="" />
                    {it.price}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {err && <p className="warn">{err}</p>}
    </GamePanel>
  )
}

// 商品预览小样：棋盘=主题色迷你盘，头像框=套框头像，落子=动效色标签。
function ItemPreview({ item }: { item: ShopItem }) {
  if (item.slot === 'board') {
    const t = getTheme(item.preview)
    return (
      <div className="board-swatch" style={{ background: t.boardFace, borderColor: t.frameBase }}>
        <span className="sw-line h" style={{ background: t.line }} />
        <span className="sw-line v" style={{ background: t.line }} />
        <span className="sw-stone b" />
        <span className="sw-stone w" />
      </div>
    )
  }
  if (item.slot === 'frame') {
    return <Avatar src="/assets/img/avatar_01.png" size={64} frame={item.preview} />
  }
  return <div className={`effect-swatch effect-${item.preview}`}>{item.name}</div>
}
