import { useEffect, useState } from 'react'
import { getSettings, setSettings, playSfx, startBgm } from '../audio/audio'
import type { Effect } from '../audio/audio'
import { THEMES } from '../board/themes'
import { GamePanel } from './GamePanel'
import { shopState } from '../net/rest'

// 落子特效可选项（值 + 中文名）。
const EFFECTS: { id: Effect; name: string }[] = [
  { id: 'none', name: '无' },
  { id: 'ripple', name: '水波纹' },
  { id: 'dust', name: '灰尘' },
  { id: 'ink', name: '墨韵' },
  { id: 'star', name: '星芒' },
  { id: 'flame', name: '流焰' },
]

// 设置弹窗：背景音乐/音效（开关合并到各自音量条同一行）+ 落子特效/棋盘主题。
// 落子特效/棋盘主题仅可选择免费或已购买的皮肤，未拥有的置灰禁用（拉取 shop 状态判断拥有）。
// 改动即时生效并持久化；用叉号关闭（首页与对局页共用）。
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState(getSettings())
  // 已拥有的棋盘皮肤 / 落子动效集合（含免费款；服务端已把 price=0 标记为 owned）。
  const [ownedBoards, setOwnedBoards] = useState<Set<string>>(new Set())
  const [ownedEffects, setOwnedEffects] = useState<Set<string>>(new Set())
  useEffect(() => {
    shopState()
      .then((st) => {
        const b = new Set<string>()
        const e = new Set<string>()
        for (const it of st.items) {
          if (!it.owned) continue
          if (it.slot === 'board') b.add(it.id)
          else if (it.slot === 'effect') e.add(it.id)
        }
        setOwnedBoards(b)
        setOwnedEffects(e)
      })
      .catch(() => {})
  }, [])
  const update = (patch: Partial<typeof s>) => {
    setSettings(patch)
    setS(getSettings())
  }
  // 未拥有则禁用（但已加载到数据时才禁用，且始终允许当前已选项，避免把人锁死）。
  const lockEffect = (id: string) => ownedEffects.size > 0 && !ownedEffects.has(id) && id !== s.effect
  const lockBoard = (id: string) => ownedBoards.size > 0 && !ownedBoards.has(id) && id !== s.theme
  return (
    <GamePanel title="设置" onClose={onClose}>
      <div className="settings-list">
        <label className="setting-row">
          <span>背景音乐</span>
          <input type="range" min={0} max={1} step={0.05} value={s.bgmVol} onChange={(e) => update({ bgmVol: Number(e.target.value) })} />
          <input
            type="checkbox"
            checked={s.bgm}
            onChange={(e) => {
              update({ bgm: e.target.checked })
              if (e.target.checked) startBgm()
            }}
          />
        </label>
        <label className="setting-row">
          <span>音效</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfxVol}
            onChange={(e) => {
              update({ sfxVol: Number(e.target.value) })
              playSfx('place')
            }}
          />
          <input type="checkbox" checked={s.sfx} onChange={(e) => update({ sfx: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span>落子特效</span>
          <select value={s.effect} onChange={(e) => update({ effect: e.target.value as Effect })}>
            {EFFECTS.map((f) => (
              <option key={f.id} value={f.id} disabled={lockEffect(f.id)}>
                {f.name}{lockEffect(f.id) ? '（未拥有）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>棋盘主题</span>
          <select value={s.theme} onChange={(e) => update({ theme: e.target.value })}>
            {Object.values(THEMES).map((th) => (
              <option key={th.id} value={th.id} disabled={lockBoard(th.id)}>
                {th.name}{lockBoard(th.id) ? '（未拥有）' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    </GamePanel>
  )
}
