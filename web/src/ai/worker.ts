/// <reference lib="webworker" />
import { bestMove } from './search'
import type { Board, Color } from '../core/types'

// AI 计算请求的消息结构：棋盘、当前执子方、难度等级
export interface AiRequest { board: Board; color: Color; level: number }

// 在 Web Worker 线程中运行 AI 搜索，避免阻塞主线程 UI。
// 收到主线程消息后计算最佳落子，再通过 postMessage 回传结果。
self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { board, color, level } = e.data
  const mv = bestMove(board, color, level)
  ;(self as unknown as Worker).postMessage(mv)
}
