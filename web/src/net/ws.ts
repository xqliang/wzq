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
  players?: number
}

// 连接房间：把 http(s) 基址替换为 ws(s)，带上 room 与 token 查询参数。
export function connectRoom(roomId: string, onMsg: (m: ServerMsg) => void): WebSocket {
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/^http/, 'ws')
  const ws = new WebSocket(`${base}/ws?room=${roomId}&token=${token()}`)
  ws.onmessage = (e) => onMsg(JSON.parse(e.data))
  return ws
}

// 发送落子。
export function sendMove(ws: WebSocket, x: number, y: number) {
  ws.send(JSON.stringify({ type: 'move', x, y }))
}
// 发起悔棋请求。
export const sendUndoReq = (ws: WebSocket) => ws.send(JSON.stringify({ type: 'undo_req' }))
// 回应悔棋请求（同意/拒绝）。
export const sendUndoReply = (ws: WebSocket, agree: boolean) => ws.send(JSON.stringify({ type: 'undo_reply', agree }))
// 认输。
export const sendResign = (ws: WebSocket) => ws.send(JSON.stringify({ type: 'resign' }))
