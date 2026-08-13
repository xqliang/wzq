// 音频管理：音效与背景音乐播放 + 用户设置持久化（localStorage）。
// 素材位于 /assets/audio/<name>.mp3（后续里程碑补充），缺失时静默失败。
type Sfx = 'place' | 'win' | 'lose' | 'button' | 'undo' | 'tick' | 'timeout'

interface Settings {
  bgm: boolean
  sfx: boolean
  bgmVol: number
  sfxVol: number
}

const DEFAULTS: Settings = { bgm: true, sfx: true, bgmVol: 0.5, sfxVol: 0.8 }

// 从 localStorage 读取设置并与默认值合并，异常时回退默认。
function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('wzq_audio') ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let settings = load()
const cache: Partial<Record<Sfx, HTMLAudioElement>> = {}
let bgmEl: HTMLAudioElement | null = null

// 拼接素材 URL。
function url(name: string) {
  return `/assets/audio/${name}.mp3`
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

// 播放一次性音效；关闭音效时直接返回，素材缺失时吞掉错误。
export function playSfx(name: Sfx) {
  if (!settings.sfx) return
  let el = cache[name]
  if (!el) {
    el = new Audio(url(name))
    cache[name] = el
  }
  el.volume = settings.sfxVol
  el.currentTime = 0
  el.play().catch(() => {})
}

// 启动循环背景音乐（首次调用创建元素）。
export function startBgm() {
  if (!bgmEl) {
    bgmEl = new Audio(url('bgm'))
    bgmEl.loop = true
  }
  bgmEl.volume = settings.bgmVol
  if (settings.bgm) bgmEl.play().catch(() => {})
}
