import { useEffect, useRef, useState } from 'react'
import { img } from '../lib/asset'
import { useNavigate } from 'react-router-dom'
import { wheelState, wheelSpin } from '../net/rest'
import type { WheelState } from '../net/rest'
import { GamePanel } from '../components/GamePanel'
import { playSfx } from '../audio/audio'

// 幸运转盘页：消耗金币抽奖，转盘旋转到命中扇区，配合音效展示奖励。
export function Wheel() {
  const nav = useNavigate()
  const [st, setSt] = useState<WheelState | null>(null)
  const [coins, setCoins] = useState(0)
  const [scrolls, setScrolls] = useState(0)
  const [rot, setRot] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // 金币不足用飘动 toast，避免 inline 文本撑出滚动条。
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const showToast = (m: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(m)
    toastTimer.current = window.setTimeout(() => setToast(''), 2000)
  }

  useEffect(() => {
    wheelState()
      .then((w) => {
        setSt(w)
        setCoins(w.coins)
        setScrolls(w.scrolls)
      })
      .catch(() => setMsg('加载失败'))
  }, [])

  const spin = () => {
    if (!st || busy) return
    if (coins < st.cost) {
      showToast('金币不足')
      return
    }
    setBusy(true)
    setMsg('')
    playSfx('button')
    wheelSpin()
      .then((r) => {
        const n = st.prizes.length
        const seg = 360 / n
        // 指针在顶部：让命中扇区中心转到 0°，并多转 5 圈增强手感。
        const target = 360 * 5 + (360 - (r.index * seg + seg / 2))
        setRot((prev) => prev - (prev % 360) + target)
        window.setTimeout(() => {
          setCoins(r.coins)
          setScrolls(r.scrolls)
          setMsg(`恭喜获得 ${r.prize.label}`)
          playSfx('win')
          setBusy(false)
        }, 3200)
      })
      .catch(() => {
        showToast('金币不足')
        setBusy(false)
      })
  }

  if (!st) return <div className="loading">{msg || '加载中…'}</div>
  const n = st.prizes.length
  const seg = 360 / n
  return (
    <GamePanel title="幸运转盘" onClose={() => nav('/')} coins={coins} scrolls={scrolls}>
      <div className="wheel-wrap">
        <div className="wheel-pointer" />
        <div
          className="wheel"
          style={{ transform: `rotate(${rot}deg)`, transition: busy ? 'transform 3s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}
        >
          {/* 各扇区奖品标签：一次排好、随轮盘整体旋转。每个标签是一条从中心向外的
             「辐条」（定位在顶部中心、绕轮盘中心旋转到扇区中心角），文字落在辐条
             外侧＝扇区中部。文字反向旋转保持正向朝外（ upright 可读），
             但随轮盘一起公转、不重排。 */}
          {st.prizes.map((p, i) => {
            const ang = i * seg + seg / 2 // 扇区中心角（顶部为 0°，顺时针）
            const [unit, num] = p.label.split('×') // "金币×50" → ["金币", "50"]
            return (
              <span key={i} className="wheel-label" style={{ transform: `rotate(${ang}deg)` }}>
                <span className="wheel-label-text" style={{ transform: `rotate(${-ang}deg)` }}>
                  {unit}×<br />{num ?? ''}
                </span>
              </span>
            )
          })}
        </div>
        <div className="wheel-hub" />
      </div>
      <div className="wheel-cost">
        <img src={img('icon_coin')} alt="" />×{st.cost}/次
      </div>
      {msg && <p className="tip">{msg}</p>}
      <button className="ad-double" disabled={busy} onClick={spin}>{busy ? '抽奖中…' : '抽奖'}</button>
      {toast && <div className="toast">{toast}</div>}
    </GamePanel>
  )
}
