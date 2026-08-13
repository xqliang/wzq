import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, setSettings, playSfx, startBgm } from '../audio/audio'

// 设置页：背景音乐 / 音效开关与音量。改动即时生效并持久化。
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

        <button onClick={() => nav('/')}>返回首页</button>
      </div>
    </div>
  )
}
