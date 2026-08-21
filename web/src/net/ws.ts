// WebSocket 客户端：连接对战房间，收发对局消息。
import { token } from './rest'

// 服务端 -> 客户端消息（联合了各类型的可选字段）。
export type ServerMsg = {
  type: string
  color?: 'black' | 'white'
  uid?: number
  x?: number
  y?: number
  seq?: number
  deadline?: number
  winner?: number
  reason?: string
  agree?: boolean
  n?: number
  players?: number
  text?: string // 表情/快捷语内容（在发送者头像下方展示）
  oppTier?: number // 开局下发的对手段位阶
  oppAvatar?: string // 对手头像
  oppFrame?: string // 对手头像框
  oppEffect?: string // 对手落子特效
}

// 连接房间：把 http(s) 基址替换为 ws(s)，带上 room 与 token 查询参数。
// VITE_API_BASE 为空（同源部署，前端由服务端一起托管）时，回退到当前页面 origin。
export function connectRoom(roomId: string, onMsg: (m: ServerMsg) => void): WebSocket {
  const origin = (import.meta.env.VITE_API_BASE ?? '') || window.location.origin
  const base = origin.replace(/^http/, 'ws')
  const ws = new WebSocket(`${base}/ws?room=${roomId}&token=${token()}`)
  ws.onmessage = (e) => onMsg(JSON.parse(e.data))
  return ws
}

// 发送落子。
export function sendMove(ws: WebSocket, x: number, y: number) {
  ws.send(JSON.stringify({ type: 'move', x, y }))
}
// 发起悔棋请求（steps=撤销手数）。
export const sendUndoReq = (ws: WebSocket, steps: number) => ws.send(JSON.stringify({ type: 'undo_req', steps }))
// 回应悔棋请求（同意/拒绝）。
export const sendUndoReply = (ws: WebSocket, agree: boolean) => ws.send(JSON.stringify({ type: 'undo_reply', agree }))
// 认输。
export const sendResign = (ws: WebSocket) => ws.send(JSON.stringify({ type: 'resign' }))
// 发送表情/快捷语（预制文本或表情符号），对方实时收到并在我的头像下方展示。
export const sendEmote = (ws: WebSocket, text: string) => ws.send(JSON.stringify({ type: 'emote', text }))
