import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, setSettings, playSfx, startBgm } from '../audio/audio'
import type { Effect } from '../audio/audio'
import { THEMES } from '../board/themes'

// 落子特效可选项（值 + 中文名）。
const EFFECTS: { id: Effect; name: string }[] = [
  { id: 'none', name: '无' },
  { id: 'ripple', name: '水波纹' },
  { id: 'dust', name: '灰尘' },
]

// 设置页：背景音乐 / 音效开关与音量 + 棋盘特效与主题。改动即时生效并持久化。
export function Settings() {
  const nav = useNavigate()
  const [s, setS] = useState(getSettings())

  const update = (patch: Partial<typeof s>) => {
    setSettings(patch)
    setS(getSettings())
  }

  return (
    <div className="settings screen home">
      <div className="settings-panel">
        <h2>设置</h2>

        <label className="setting-row">
          <span>背景音乐</span>
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
          <span>音乐音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.bgmVol}
            onChange={(e) => update({ bgmVol: Number(e.target.value) })}
          />
        </label>

        <label className="setting-row">
          <span>音效</span>
          <input
            type="checkbox"
            checked={s.sfx}
            onChange={(e) => update({ sfx: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>音效音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfxVol}
            onChange={(e) => {
              update({ sfxVol: Number(e.target.value) })
              playSfx('place') // 试听
            }}
          />
        </label>

        <h3 className="settings-section">棋盘</h3>
        <label className="setting-row">
          <span>落子特效</span>
          <select
            value={s.effect}
            onChange={(e) => update({ effect: e.target.value as Effect })}
          >
            {EFFECTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>棋盘主题</span>
          <span className="theme-picker">
            <span
              className="theme-swatch"
              style={{ background: THEMES[s.theme]?.boardFace ?? '#e3c088' }}
              aria-hidden="true"
            />
            <select value={s.theme} onChange={(e) => update({ theme: e.target.value })}>
              {Object.values(THEMES).map((th) => (
                <option key={th.id} value={th.id}>
                  {th.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <button className="back-btn" onClick={() => nav('/')}>返回首页</button>
      </div>
    </div>
  )
}
