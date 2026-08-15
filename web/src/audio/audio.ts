// 音频管理：音效与背景音乐播放 + 用户设置持久化（localStorage）。
// 背景音乐经 Vite 打包为带 hash 的 URL（避免固定名缓存）；音效用 Web Audio 实时合成。
import bgmUrl from '../assets/audio/bgm.mp3'
type Sfx = 'place' | 'win' | 'lose' | 'button' | 'undo' | 'tick' | 'timeout'

// 落子特效类型：无 / 水波纹 / 灰尘。
export type Effect = 'none' | 'ripple' | 'dust'

interface Settings {
  bgm: boolean
  sfx: boolean
  bgmVol: number
  sfxVol: number
  effect: Effect // 落子视觉特效
  theme: string // 棋盘主题 id（见 board/themes.ts）
}

const DEFAULTS: Settings = {
  bgm: true,
  sfx: true,
  bgmVol: 0.5,
  sfxVol: 0.8,
  effect: 'ripple',
  theme: 'wood',
}

// 从 localStorage 读取设置并与默认值合并，异常时回退默认。
function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('wzq_audio') ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let settings = load()
let bgmEl: HTMLAudioElement | null = null

// —— Web Audio 合成 ——
// 占位 mp3 是静音的，这里用 Web Audio 实时合成音效，确保真的能听到（尤其落子声）。
let actx: AudioContext | null = null
function ctx(): AudioContext | null {
  try {
    if (!actx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      actx = new AC()
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {})
    return actx
  } catch {
    return null
  }
}

// 一个带包络的振荡器音。
function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const c = ctx()
  if (!c) return
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * settings.sfxVol), t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// 落子：轻质木“嗒”——较高、较短、低增益，去掉沉重低鸣，听感更柔和。
function clack() {
  const c = ctx()
  if (!c) return
  const t = c.currentTime
  tone(320, 0.07, 'sine', 0.28, 200) // 轻木鸣（不再低沉）
  // 轻短的高频敲击噪声
  const len = Math.floor(c.sampleRate * 0.018)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
  const n = c.createBufferSource()
  n.buffer = buf
  const ng = c.createGain()
  ng.gain.value = 0.18 * settings.sfxVol
  n.connect(ng).connect(c.destination)
  n.start(t)
}

// 各音效映射到合成器。
function synth(name: Sfx) {
  switch (name) {
    case 'place':
      clack()
      break
    case 'button':
      tone(660, 0.05, 'triangle', 0.4)
      break
    case 'win':
      tone(523, 0.12, 'triangle', 0.5)
      setTimeout(() => tone(784, 0.18, 'triangle', 0.5), 110)
      break
    case 'lose':
      tone(392, 0.18, 'sine', 0.5, 196)
      break
    case 'undo':
      tone(300, 0.1, 'sine', 0.4, 200)
      break
    case 'tick':
      tone(900, 0.04, 'square', 0.25)
      break
    case 'timeout':
      tone(200, 0.4, 'sawtooth', 0.5, 120)
      break
  }
}

// 读取当前设置副本。
export function getSettings(): Settings {
  return { ...settings }
}

// 更新设置并持久化；同步调整 BGM 音量/播放状态。
export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  localStorage.setItem('wzq_audio', JSON.stringify(settings))
  if (bgmEl) {
    bgmEl.volume = settings.bgmVol
    if (!settings.bgm) bgmEl.pause()
    else bgmEl.play().catch(() => {})
  }
}

// 播放一次性音效（Web Audio 合成）；关闭音效或环境不支持时静默。
export function playSfx(name: Sfx) {
  if (!settings.sfx) return
  synth(name)
}

// 启动循环背景音乐（首次调用创建元素）。
export function startBgm() {
  if (!bgmEl) {
    bgmEl = new Audio(bgmUrl)
    bgmEl.loop = true
  }
  bgmEl.volume = settings.bgmVol
  if (settings.bgm) bgmEl.play().catch(() => {})
}
