import { useEffect, useRef, useState } from 'react'
import { img } from '../lib/asset'
import { useNavigate } from 'react-router-dom'
import { shopState, shopBuy, shopEquip } from '../net/rest'
import type { ShopState, ShopItem } from '../net/rest'
import { GamePanel } from '../components/GamePanel'
import { Avatar } from '../components/Avatar'
import { getTheme } from '../board/themes'
import { setSettings } from '../audio/audio'
import type { Effect } from '../audio/audio'
import { EffectLoopPreview } from '../components/EffectLoopPreview'

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
  const [loadErr, setLoadErr] = useState('')
  // 购买/装备失败用飘动 toast 提示，避免 inline 文本撑出滚动条。
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const showToast = (m: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(m)
    toastTimer.current = window.setTimeout(() => setToast(''), 2000)
  }

  useEffect(() => {
    shopState().then(setState).catch(() => setLoadErr('加载商店失败'))
  }, [])

  // 应用最新商店状态，并把已装备的棋盘皮肤/落子动效同步到本地设置（即时生效）。
  const apply = (next: ShopState) => {
    setState(next)
    setSettings({ theme: next.equipped.board, effect: next.equipped.effect as Effect })
  }
  const buy = (it: ShopItem) => {
    setBusy(true)
    shopBuy(it.slot, it.id).then(apply).catch(() => showToast('金币/卷轴不足或已拥有')).finally(() => setBusy(false))
  }
  const equip = (it: ShopItem) => {
    setBusy(true)
    shopEquip(it.slot, it.id).then(apply).catch(() => showToast('装备失败')).finally(() => setBusy(false))
  }

  if (!state) return <div className="loading">{loadErr || '加载中…'}</div>
  const items = state.items.filter((i) => i.slot === slot)

  // 左侧分类灯笼标签（传给 GamePanel 作为 sidebar，渲染在面板左外侧、不被内容区遮挡）。
  const tabs = (
    <div className="shop-tabs">
      {SLOTS.map((s) => (
        <button key={s.key} className={`shop-tab${slot === s.key ? ' active' : ''}`} onClick={() => setSlot(s.key)}>
          {s.label}
        </button>
      ))}
    </div>
  )

  return (
    <GamePanel title="商店" onClose={() => nav('/')} coins={state.coins} scrolls={state.scrolls} sidebar={tabs}>
      <div className="shop-body">
        <div className="shop-grid">
          {items.map((it) => (
            <div key={it.slot + it.id} className={`shop-card${it.equipped ? ' equipped' : ''}`}>
              <div className="shop-card-name">{it.name}</div>
              <div className={`shop-card-preview${it.slot === 'board' ? ' preview-zoom' : ''}`}>
                <ItemPreview item={it} />
              </div>
              <div className="shop-card-foot">
                {it.equipped ? (
                  <span className="tag-equipped">已装备</span>
                ) : it.owned ? (
                  <button className="op-btn" disabled={busy} onClick={() => equip(it)}>装备</button>
                ) : (
                  <button className="price-btn" disabled={busy} onClick={() => buy(it)}>
                    <img src={it.currency === 'scrolls' ? img('icon_scroll') : img('icon_coin')} alt="" />
                    {it.price}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </GamePanel>
  )
}

// 商品预览小样：棋盘=主题色迷你棋盘(网格+交点落子)，头像框=套框头像，落子=动效色标签。
function ItemPreview({ item }: { item: ShopItem }) {
  if (item.slot === 'board') {
    const t = getTheme(item.preview)
    const size = 84
    const n = 5 // 5x5 网格
    const m = 12 // 四边留白
    const step = (size - 2 * m) / (n - 1)
    const at = (i: number) => m + i * step
    const lines = Array.from({ length: n }, (_, i) => i)
    return (
      <svg className="board-swatch" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: t.boardFace, borderColor: t.frameBase }}>
        {lines.map((i) => (
          <line key={`h${i}`} x1={m} y1={at(i)} x2={size - m} y2={at(i)} stroke={t.line} strokeWidth={1} />
        ))}
        {lines.map((i) => (
          <line key={`v${i}`} x1={at(i)} y1={m} x2={at(i)} y2={size - m} stroke={t.line} strokeWidth={1} />
        ))}
        {/* 棋子落在交点上 */}
        <circle cx={at(2)} cy={at(2)} r={step * 0.42} fill="#161616" />
        <circle cx={at(3)} cy={at(1)} r={step * 0.42} fill="#f4f0e6" stroke="#c9bfa6" />
      </svg>
    )
  }
  if (item.slot === 'frame') {
    return <Avatar src={img('avatar_01')} size={74} frame={item.preview} />
  }
  // 落子动效：在卡片内循环播放该商品自己的动效（水波卡循环水波，尘屑卡循环尘屑）。
  return <EffectLoopPreview effect={item.preview} height={76} />
}
