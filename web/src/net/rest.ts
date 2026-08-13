// REST 客户端：封装与 Go 服务端的 HTTP 交互（游客注册、登录、绑定、人机结果上报、建房）。
// 通过 Vite 环境变量 VITE_API_BASE 指向后端地址。
const BASE = import.meta.env.VITE_API_BASE ?? ''

// 从 localStorage 读取 JWT（游客/登录后写入），无则返回空串。
function token(): string {
  return localStorage.getItem('wzq_token') ?? ''
}

// 统一的请求封装：带上 JSON header 与 Bearer token，非 2xx 抛错。
async function req(path: string, method: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

// 用户信息结构，与服务端 user JSON 对齐。
export interface User {
  id: number
  nickname: string
  avatar: string
  exp: number
  level: number
  username?: string
}

// 缓存当前登录用户：供 Game 页判断“我是谁”（区分自己/对手的落子广播）。
let currentUser: User | null = null
export function getCurrentUser(): User | null {
  return currentUser
}

// 确保拥有身份：已有 token 则拉取 /api/me；否则注册游客并落地 token。
export async function ensureGuest(): Promise<User> {
  if (token()) {
    const u = (await req('/api/me', 'GET')) as User
    currentUser = u
    return u
  }
  const { token: t, user } = await req('/api/guest', 'POST')
  localStorage.setItem('wzq_token', t)
  currentUser = user
  return user
}

// 绑定账号（游客升级为正式账号）。
export const bind = (username: string, password: string) => req('/api/bind', 'POST', { username, password })

// 账号密码登录，成功后覆盖本地 token。
export async function login(username: string, password: string): Promise<User> {
  const { token: t, user } = await req('/api/login', 'POST', { username, password })
  localStorage.setItem('wzq_token', t)
  currentUser = user
  return user
}

// 上报人机对局结果，服务端返回本局经验增量与最新用户信息。moves 为总手数（可选）。
export const reportAiResult = (level: number, win: boolean, moves = 0) =>
  req('/api/ai/result', 'POST', { level, win, moves })

// 战绩统计结构，与服务端 record.Stats JSON 对齐。
export interface Stats {
  total: number
  wins: number
  losses: number
  winRate: number
  streak: number
  aiGames: number
  pvpGames: number
}

// 拉取我的战绩统计与用户信息（需登录）。
export const myStats = () =>
  req('/api/me/stats', 'GET') as Promise<{
    stats: Stats
    user: { id: number; nickname: string; level: number; exp: number }
  }>

// 拉取某用户的公开炫耀视图（后端无需鉴权；req 仍带 Bearer 不影响）。
export const shareStats = (uid: number) =>
  req(`/api/share?uid=${uid}`, 'GET') as Promise<{
    nickname: string
    level: number
    wins: number
    streak: number
    total: number
  }>

// 创建真人对战房间，返回房间 id。
export const createRoom = () => req('/api/room', 'POST') as Promise<{ roomId: string }>

// ===== 残局闯关（endgame）相关接口 =====

// 关卡元信息：用于列表页展示（章节、难度、是否通关、尝试次数）。
export interface EndgameMeta {
  id: string
  chapter: number
  name: string
  difficulty: number
  passed: boolean
  attempts: number
}

// 单个关卡详情：预置棋子、轮到谁走、关卡类型（不含答案）。
export interface EndgameDetail {
  id: string
  name: string
  difficulty: number
  stones: { x: number; y: number; color: 'black' | 'white' }[]
  toMove: 'black' | 'white'
  kind: string
}

// 拉取全部关卡列表。
export const endgameLevels = () => req('/api/endgame/levels', 'GET') as Promise<EndgameMeta[]>

// 拉取单个关卡详情（预置局面）。
export const endgameLevel = (id: string) =>
  req(`/api/endgame/level?id=${id}`, 'GET') as Promise<EndgameDetail>

// 提交一手落子，服务端判定是否为正解。
export const endgameSubmit = (id: string, x: number, y: number) =>
  req('/api/endgame/submit', 'POST', { id, x, y }) as Promise<{ correct: boolean }>

// 请求提示：返回推荐落子坐标。
export const endgameHint = (id: string) =>
  req('/api/endgame/hint', 'POST', { id }) as Promise<{ x: number; y: number }>

// 查看答案：返回所有正解坐标。
export const endgameAnswer = (id: string) =>
  req(`/api/endgame/answer?id=${id}`, 'GET') as Promise<{ answers: [number, number][] }>

export { token }
