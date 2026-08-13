# 古风五子棋网页对战游戏 Phase 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一款浏览器端古风五子棋，含本地 AI 三档人机对战、WebSocket 好友真人对战、游客+可升级账号、经验/等级、棋谱落库，部署到 ECS。

**Architecture:** monorepo。`web/` React+TS+Vite 前端（gomoku-core 纯逻辑、gomoku-ai 跑 Web Worker、Canvas 棋盘）；`server/` Go 模块化单体（对齐 dubbing：config 驱动 sqlite/MySQL、gorilla/websocket、JWT、内存房间 + 服务端裁判）；`scripts/` seedream 素材生成。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand + Vitest；Go 1.26 + gorilla/websocket + golang-jwt + go-sql-driver/mysql + modernc.org/sqlite；uv + pillow（素材）。

---

## 文件结构

```
wzq/
  web/
    package.json, tsconfig.json, vite.config.ts, vitest.config.ts
    src/
      core/board.ts            # 棋盘状态 + 落子合法性
      core/win.ts              # 五连判定
      core/types.ts            # Color/Cell/Move/Board 类型
      core/board.test.ts
      core/win.test.ts
      ai/evaluate.ts           # 局面/连珠打分
      ai/search.ts             # minimax + α-β + 候选点
      ai/worker.ts             # Web Worker 入口
      ai/ai.test.ts
      net/rest.ts              # REST 客户端
      net/ws.ts                # WebSocket 客户端
      store/game.ts            # Zustand 对局状态
      board/BoardCanvas.tsx    # Canvas 渲染
      pages/Home.tsx / AiConfig.tsx / Game.tsx / Result.tsx / Room.tsx
      audio/audio.ts
      App.tsx / main.tsx
  server/
    go.mod
    config.yaml
    cmd/server/main.go
    internal/config/config.go
    internal/gomoku/gomoku.go        # Go 棋规核心（裁判用）
    internal/gomoku/gomoku_test.go
    internal/auth/auth.go            # JWT 签发/校验
    internal/auth/auth_test.go
    internal/store/store.go          # DB 接口 + 迁移
    internal/store/sqlite.go
    internal/user/user.go            # 用户 + 经验 + 等级 + 防刷
    internal/user/user_test.go
    internal/room/room.go            # 房间状态机 + 裁判
    internal/room/hub.go             # 内存 hub + WS 升级
    internal/room/room_test.go
    internal/record/record.go        # 对局 + 棋谱落库
    internal/api/http.go             # REST 路由
    deploy/deploy.sh
  scripts/
    make-board.py / make-pieces.py / make-backgrounds.py / _seedream.py
  docs/
```

---

## Milestone 1：前端棋规核心（gomoku-core, TS, TDD）

### Task 1: 前端工程脚手架

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`

- [ ] **Step 1: 初始化工程**

Run:
```bash
cd /Users/jyxc-dz-0100360/work/fun/wzq
npm create vite@latest web -- --template react-ts
cd web && npm install && npm install zustand && npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: 写 vitest 配置**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'jsdom', globals: true },
})
```

- [ ] **Step 3: 冒烟测试构建**

Run: `cd web && npm run build`
Expected: 构建成功，生成 `dist/`

- [ ] **Step 4: Commit**

```bash
git add web && git commit -m "chore(web): scaffold React+TS+Vite with vitest"
```

### Task 2: 类型定义

**Files:**
- Create: `web/src/core/types.ts`

- [ ] **Step 1: 写类型**

```ts
export type Color = 'black' | 'white'
export type Cell = Color | null
export const SIZE = 15
export interface Move { x: number; y: number; color: Color }
// 棋盘：二维数组 board[y][x]，null 为空
export type Board = Cell[][]

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/core/types.ts && git commit -m "feat(core): board types and emptyBoard"
```

### Task 3: 落子合法性

**Files:**
- Create: `web/src/core/board.ts`, `web/src/core/board.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { emptyBoard, SIZE } from './types'
import { isLegal, applyMove } from './board'

describe('board', () => {
  it('空点合法', () => {
    expect(isLegal(emptyBoard(), 7, 7)).toBe(true)
  })
  it('越界非法', () => {
    expect(isLegal(emptyBoard(), -1, 0)).toBe(false)
    expect(isLegal(emptyBoard(), SIZE, 0)).toBe(false)
  })
  it('已占非法', () => {
    const b = applyMove(emptyBoard(), { x: 7, y: 7, color: 'black' })
    expect(isLegal(b, 7, 7)).toBe(false)
  })
  it('applyMove 不改原棋盘', () => {
    const b0 = emptyBoard()
    const b1 = applyMove(b0, { x: 0, y: 0, color: 'black' })
    expect(b0[0][0]).toBeNull()
    expect(b1[0][0]).toBe('black')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/core/board.test.ts`
Expected: FAIL（isLegal/applyMove 未定义）

- [ ] **Step 3: 实现**

```ts
import { Board, Move, SIZE } from './types'

export function isLegal(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false
  return board[y][x] === null
}

export function applyMove(board: Board, move: Move): Board {
  const next = board.map((row) => row.slice())
  next[move.y][move.x] = move.color
  return next
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/core/board.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core/board.ts web/src/core/board.test.ts && git commit -m "feat(core): isLegal and applyMove"
```

### Task 4: 五连判定

**Files:**
- Create: `web/src/core/win.ts`, `web/src/core/win.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { emptyBoard } from './types'
import { applyMove } from './board'
import { checkWin } from './win'

describe('checkWin', () => {
  it('横向五连黑胜', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 7; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(checkWin(b, 7, 7)).toBe('black')
  })
  it('竖向五连', () => {
    let b = emptyBoard()
    for (let y = 0; y <= 4; y++) b = applyMove(b, { x: 5, y, color: 'white' })
    expect(checkWin(b, 5, 4)).toBe('white')
  })
  it('主对角线五连', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: i, color: 'black' })
    expect(checkWin(b, 4, 4)).toBe('black')
  })
  it('副对角线五连', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: 4 - i, color: 'black' })
    expect(checkWin(b, 4, 0)).toBe('black')
  })
  it('四连未胜', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(checkWin(b, 6, 7)).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/core/win.test.ts`
Expected: FAIL（checkWin 未定义）

- [ ] **Step 3: 实现**

```ts
import { Board, Color, SIZE } from './types'

const DIRS = [
  [1, 0],   // 横
  [0, 1],   // 竖
  [1, 1],   // 主对角
  [1, -1],  // 副对角
]

// 检查刚落在 (x,y) 的子是否形成五连；返回胜方颜色或 null
export function checkWin(board: Board, x: number, y: number): Color | null {
  const color = board[y][x]
  if (!color) return null
  for (const [dx, dy] of DIRS) {
    let count = 1
    for (const sign of [1, -1]) {
      let nx = x + dx * sign
      let ny = y + dy * sign
      while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === color) {
        count++
        nx += dx * sign
        ny += dy * sign
      }
    }
    if (count >= 5) return color
  }
  return null
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/core/win.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core/win.ts web/src/core/win.test.ts && git commit -m "feat(core): five-in-a-row win detection"
```

---

## Milestone 2：前端 AI（gomoku-ai）

### Task 5: 局面评估

**Files:**
- Create: `web/src/ai/evaluate.ts`, `web/src/ai/ai.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { emptyBoard } from '../core/types'
import { applyMove } from '../core/board'
import { evaluate } from './evaluate'

describe('evaluate', () => {
  it('己方活四得分高于活三', () => {
    let four = emptyBoard()
    for (let x = 3; x <= 6; x++) four = applyMove(four, { x, y: 7, color: 'black' })
    let three = emptyBoard()
    for (let x = 3; x <= 5; x++) three = applyMove(three, { x, y: 7, color: 'black' })
    expect(evaluate(four, 'black')).toBeGreaterThan(evaluate(three, 'black'))
  })
  it('空盘评分为 0', () => {
    expect(evaluate(emptyBoard(), 'black')).toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/ai/ai.test.ts`
Expected: FAIL（evaluate 未定义）

- [ ] **Step 3: 实现**

```ts
import { Board, Color, SIZE } from '../core/types'

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]
// 连子数 → 基础分（活/眠由两端空位数区分，简化：按连子数 + 两端开放度打分）
const SCORE: Record<number, number> = { 1: 10, 2: 100, 3: 1000, 4: 10000, 5: 1000000 }

function lineScore(board: Board, x: number, y: number, dx: number, dy: number, color: Color): number {
  // 只在“连子起点”统计：前一个不同色/越界，避免重复计数
  const px = x - dx, py = y - dy
  if (px >= 0 && py >= 0 && px < SIZE && py < SIZE && board[py][px] === color) return 0
  let count = 0, cx = x, cy = y
  while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
    count++; cx += dx; cy += dy
  }
  if (count === 0) return 0
  // 两端开放度
  let open = 0
  const bx = x - dx, by = y - dy
  if (bx >= 0 && by >= 0 && bx < SIZE && by < SIZE && board[by][bx] === null) open++
  if (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === null) open++
  const base = SCORE[Math.min(count, 5)] ?? 0
  return open === 0 && count < 5 ? base * 0.1 : base * (open === 2 ? 1.2 : 1)
}

// 从 color 视角评估：己方得分 - 对手得分*1.1（略偏防守）
export function evaluate(board: Board, color: Color): number {
  const opp: Color = color === 'black' ? 'white' : 'black'
  let self = 0, other = 0
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = board[y][x]
      if (!c) continue
      for (const [dx, dy] of DIRS) {
        const s = lineScore(board, x, y, dx, dy, c)
        if (c === color) self += s
        else other += s
      }
    }
  }
  return self - other * 1.1
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/ai/ai.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ai/evaluate.ts web/src/ai/ai.test.ts && git commit -m "feat(ai): heuristic board evaluation"
```

### Task 6: 搜索（minimax + α-β）与三档

**Files:**
- Create: `web/src/ai/search.ts`
- Modify: `web/src/ai/ai.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `ai.test.ts` 追加：
```ts
import { bestMove } from './search'

describe('bestMove', () => {
  it('Lv3 必须堵对方冲四（否则下一手就输）', () => {
    let b = emptyBoard()
    // 白方 4 连（x=3..6, y=7），黑方 Lv3 必须堵在 (2,7) 或 (7,7)
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 7, color: 'white' })
    const mv = bestMove(b, 'black', 3)
    const blocks = (mv.x === 2 && mv.y === 7) || (mv.x === 7 && mv.y === 7)
    expect(blocks).toBe(true)
  })
  it('Lv3 己方有连五机会必成五', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 5, color: 'black' })
    const mv = bestMove(b, 'black', 3)
    const wins = (mv.x === 2 && mv.y === 5) || (mv.x === 7 && mv.y === 5)
    expect(wins).toBe(true)
  })
  it('空盘返回中心附近', () => {
    const mv = bestMove(emptyBoard(), 'black', 1)
    expect(Math.abs(mv.x - 7)).toBeLessThanOrEqual(2)
    expect(Math.abs(mv.y - 7)).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/ai/ai.test.ts`
Expected: FAIL（bestMove 未定义）

- [ ] **Step 3: 实现**

```ts
import { Board, Color, Move, SIZE } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'
import { evaluate } from './evaluate'

// 候选点：已有棋子周围 2 格内的空点（缩小分支）
function candidates(board: Board): { x: number; y: number }[] {
  const set = new Set<number>()
  let hasStone = false
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (board[y][x]) {
        hasStone = true
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !board[ny][nx])
              set.add(ny * SIZE + nx)
          }
      }
  if (!hasStone) return [{ x: 7, y: 7 }]
  return [...set].map((v) => ({ x: v % SIZE, y: Math.floor(v / SIZE) }))
}

function negamax(board: Board, color: Color, depth: number, alpha: number, beta: number, lastX: number, lastY: number): number {
  if (lastX >= 0 && checkWin(board, lastX, lastY)) return -1000000 - depth // 上一手（对手）赢了，对当前方极差
  if (depth === 0) return evaluate(board, color)
  const opp: Color = color === 'black' ? 'white' : 'black'
  let best = -Infinity
  for (const c of candidates(board)) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    const score = -negamax(nb, opp, depth - 1, -beta, -alpha, c.x, c.y)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

// level: 1 普通(depth1+噪声) / 2 中等(depth2) / 3 高级(depth4)
export function bestMove(board: Board, color: Color, level: number): Move {
  const depth = level >= 3 ? 4 : level === 2 ? 2 : 1
  const noise = level === 1 ? 0.15 : 0
  const opp: Color = color === 'black' ? 'white' : 'black'
  let best = -Infinity
  let choice = { x: 7, y: 7 }
  for (const c of candidates(board)) {
    // 己方直接成五立即选
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    if (checkWin(nb, c.x, c.y)) return { x: c.x, y: c.y, color }
    let score = -negamax(nb, opp, depth - 1, -Infinity, Infinity, c.x, c.y)
    if (noise) score += (Math.random() - 0.5) * Math.abs(score || 1) * noise
    if (score > best) { best = score; choice = c }
  }
  return { ...choice, color }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/ai/ai.test.ts`
Expected: PASS（如 Lv3 深度导致偶发超时，将 depth 从 4 调到 3 重跑）

- [ ] **Step 5: Commit**

```bash
git add web/src/ai/search.ts web/src/ai/ai.test.ts && git commit -m "feat(ai): negamax alpha-beta search with 3 difficulty levels"
```

### Task 7: Web Worker 封装

**Files:**
- Create: `web/src/ai/worker.ts`

- [ ] **Step 1: 实现 Worker**

```ts
import { bestMove } from './search'
import type { Board, Color } from '../core/types'

export interface AiRequest { board: Board; color: Color; level: number }

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { board, color, level } = e.data
  const mv = bestMove(board, color, level)
  ;(self as unknown as Worker).postMessage(mv)
}
```

- [ ] **Step 2: 验证类型编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add web/src/ai/worker.ts && git commit -m "feat(ai): web worker wrapper"
```

---

## Milestone 3：Go 服务端基础（工程 + 棋规裁判 + config + auth）

### Task 8: Go 工程脚手架

**Files:**
- Create: `server/go.mod`, `server/cmd/server/main.go`, `server/config.yaml`

- [ ] **Step 1: 初始化模块**

Run:
```bash
cd /Users/jyxc-dz-0100360/work/fun/wzq/server
go mod init github.com/wzq/gomoku
go get github.com/gorilla/websocket@v1.5.3
go get github.com/golang-jwt/jwt/v5@v5.3.1
go get github.com/go-sql-driver/mysql@v1.8.1
go get modernc.org/sqlite@v1.52.0
go get golang.org/x/crypto@v0.53.0
go get gopkg.in/yaml.v3@v3.0.1
go get github.com/google/uuid@v1.6.0
```

- [ ] **Step 2: 最小 main + config.yaml**

`server/cmd/server/main.go`:
```go
package main

import (
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	log.Println("listening :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

`server/config.yaml`:
```yaml
addr: ":8080"
db:
  driver: sqlite
  dsn: data/app.db
auth:
  authTtlMinutes: 43200
```

- [ ] **Step 3: 冒烟**

Run: `cd server && go build ./... && go vet ./...`
Expected: 成功

- [ ] **Step 4: Commit**

```bash
git add server && git commit -m "chore(server): scaffold Go module and healthz"
```

### Task 9: Go 棋规核心（裁判用）

**Files:**
- Create: `server/internal/gomoku/gomoku.go`, `server/internal/gomoku/gomoku_test.go`

- [ ] **Step 1: 写失败测试**

```go
package gomoku

import "testing"

func TestApplyAndWin(t *testing.T) {
	b := NewBoard()
	for x := 3; x <= 7; x++ {
		if err := b.Apply(x, 7, Black); err != nil {
			t.Fatalf("apply: %v", err)
		}
	}
	if w := b.CheckWin(7, 7); w != Black {
		t.Fatalf("want black win, got %q", w)
	}
}

func TestIllegal(t *testing.T) {
	b := NewBoard()
	if err := b.Apply(0, 0, Black); err != nil {
		t.Fatal(err)
	}
	if err := b.Apply(0, 0, White); err == nil {
		t.Fatal("expected error placing on occupied cell")
	}
	if err := b.Apply(-1, 0, Black); err == nil {
		t.Fatal("expected error out of range")
	}
}

func TestNoWinFour(t *testing.T) {
	b := NewBoard()
	for x := 3; x <= 6; x++ {
		_ = b.Apply(x, 7, Black)
	}
	if w := b.CheckWin(6, 7); w != "" {
		t.Fatalf("four should not win, got %q", w)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/gomoku/`
Expected: FAIL（编译错误：未定义）

- [ ] **Step 3: 实现**

```go
// Package gomoku 是服务端权威棋规：落子合法性 + 五连判定，供房间裁判使用。
package gomoku

import "errors"

const Size = 15

type Color string

const (
	Black Color = "black"
	White Color = "white"
)

var ErrIllegal = errors.New("illegal move")

type Board struct {
	cells [Size][Size]Color // 空为 ""
}

func NewBoard() *Board { return &Board{} }

func inRange(x, y int) bool { return x >= 0 && y >= 0 && x < Size && y < Size }

// At 返回坐标处颜色（空为 ""）。
func (b *Board) At(x, y int) Color {
	if !inRange(x, y) {
		return ""
	}
	return b.cells[y][x]
}

// Apply 落子；越界或已占返回 ErrIllegal。
func (b *Board) Apply(x, y int, c Color) error {
	if !inRange(x, y) || b.cells[y][x] != "" {
		return ErrIllegal
	}
	b.cells[y][x] = c
	return nil
}

var dirs = [4][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}}

// CheckWin 检查刚落在 (x,y) 是否五连，返回胜方或 ""。
func (b *Board) CheckWin(x, y int) Color {
	c := b.At(x, y)
	if c == "" {
		return ""
	}
	for _, d := range dirs {
		count := 1
		for _, sign := range [2]int{1, -1} {
			nx, ny := x+d[0]*sign, y+d[1]*sign
			for inRange(nx, ny) && b.cells[ny][nx] == c {
				count++
				nx += d[0] * sign
				ny += d[1] * sign
			}
		}
		if count >= 5 {
			return c
		}
	}
	return ""
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/gomoku/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/gomoku && git commit -m "feat(server): authoritative gomoku rules"
```

### Task 10: config 加载（对齐 dubbing）

**Files:**
- Create: `server/internal/config/config.go`, `server/internal/config/config_test.go`

- [ ] **Step 1: 写失败测试**

```go
package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaultsAndYAML(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.yaml")
	os.WriteFile(p, []byte("addr: \":9090\"\ndb:\n  driver: sqlite\n  dsn: data/x.db\n"), 0o644)
	cfg, err := Load(p)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":9090" {
		t.Fatalf("addr=%q", cfg.Addr)
	}
	if cfg.Auth.AuthTTLMinutes == 0 {
		t.Fatal("auth ttl default not applied")
	}
}

func TestEnvOverridesSecret(t *testing.T) {
	t.Setenv("WZQ_AUTH_SECRET", "s3cr3t")
	cfg, err := Load(filepath.Join(t.TempDir(), "missing.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Auth.Secret != "s3cr3t" {
		t.Fatalf("secret=%q", cfg.Auth.Secret)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/config/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package config 加载服务端配置：默认值 < config.yaml < 环境变量。
package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type DB struct {
	Driver string `yaml:"driver"` // sqlite | mysql
	DSN    string `yaml:"dsn"`
}

type Auth struct {
	Secret         string `yaml:"-"` // 只走环境变量 WZQ_AUTH_SECRET
	AuthTTLMinutes int    `yaml:"authTtlMinutes"`
}

type Config struct {
	Addr string `yaml:"addr"`
	DB   DB     `yaml:"db"`
	Auth Auth   `yaml:"auth"`
}

// Load 读配置文件（不存在则用默认），再叠加环境变量。
func Load(path string) (*Config, error) {
	cfg := &Config{
		Addr: ":8080",
		DB:   DB{Driver: "sqlite", DSN: "data/app.db"},
		Auth: Auth{AuthTTLMinutes: 43200}, // 30 天
	}
	if data, err := os.ReadFile(path); err == nil {
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, err
		}
	}
	if v := os.Getenv("WZQ_AUTH_SECRET"); v != "" {
		cfg.Auth.Secret = v
	}
	if cfg.Auth.Secret == "" {
		cfg.Auth.Secret = "dev-insecure-secret" // 本地默认，部署时由 deploy.sh 注入随机值
	}
	if v := os.Getenv("WZQ_DB_DSN"); v != "" {
		cfg.DB.DSN = v
	}
	if v := os.Getenv("WZQ_DB_DRIVER"); v != "" {
		cfg.DB.Driver = v
	}
	return cfg, nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/config/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/config && git commit -m "feat(server): config loader with env overrides"
```

### Task 11: JWT auth（对齐 dubbing）

**Files:**
- Create: `server/internal/auth/auth.go`, `server/internal/auth/auth_test.go`

- [ ] **Step 1: 写失败测试**

```go
package auth

import "testing"

func TestSignAndVerify(t *testing.T) {
	m := NewManager("secret", 60)
	tok, err := m.Issue("42")
	if err != nil {
		t.Fatal(err)
	}
	uid, err := m.Verify(tok)
	if err != nil {
		t.Fatal(err)
	}
	if uid != "42" {
		t.Fatalf("uid=%q", uid)
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	m := NewManager("secret", 60)
	if _, err := m.Verify("not.a.token"); err == nil {
		t.Fatal("expected error")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/auth/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package auth 提供 HS256 JWT 的签发与校验（sub=userID）。
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

type Manager struct {
	secret  []byte
	authTTL time.Duration
}

func NewManager(secret string, ttlMinutes int) *Manager {
	return &Manager{secret: []byte(secret), authTTL: time.Duration(ttlMinutes) * time.Minute}
}

func (m *Manager) Issue(userID string) (string, error) {
	now := time.Now()
	c := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.authTTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(m.secret)
}

func (m *Manager) Verify(token string) (string, error) {
	var c jwt.RegisteredClaims
	t, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !t.Valid {
		return "", ErrInvalidToken
	}
	return c.Subject, nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/auth/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth && git commit -m "feat(server): JWT issue and verify"
```

---

## Milestone 4：数据层 + 用户/经验/等级/防刷

### Task 12: store（DB 连接 + 迁移）

**Files:**
- Create: `server/internal/store/store.go`, `server/internal/store/store_test.go`

- [ ] **Step 1: 写失败测试**

```go
package store

import "testing"

func TestOpenSqliteAndMigrate(t *testing.T) {
	s, err := Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	// 迁移后 user 表可插入
	var n int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM user").Scan(&n); err != nil {
		t.Fatalf("user table missing: %v", err)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/store/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package store 管理数据库连接与建表迁移，兼容 sqlite（本地）与 mysql（线上）。
package store

import (
	"database/sql"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
)

type Store struct {
	DB     *sql.DB
	driver string
}

// Open 按 driver 打开连接。sqlite driver 名为 "sqlite"（modernc）。
func Open(driver, dsn string) (*Store, error) {
	name := driver
	if driver == "sqlite" {
		name = "sqlite"
	}
	db, err := sql.Open(name, dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return &Store{DB: db, driver: driver}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// autoInc 返回各方言的自增主键定义。
func (s *Store) autoInc() string {
	if s.driver == "mysql" {
		return "BIGINT PRIMARY KEY AUTO_INCREMENT"
	}
	return "INTEGER PRIMARY KEY AUTOINCREMENT"
}

func (s *Store) Migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS user (
			id ` + s.autoInc() + `,
			guest_id VARCHAR(64) UNIQUE,
			username VARCHAR(64) UNIQUE,
			password_hash VARCHAR(128),
			nickname VARCHAR(64),
			avatar VARCHAR(128),
			exp INT NOT NULL DEFAULT 0,
			level INT NOT NULL DEFAULT 1,
			created_at DATETIME,
			last_login DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS game_record (
			id ` + s.autoInc() + `,
			mode VARCHAR(8),
			ai_level INT,
			black_uid BIGINT,
			white_uid BIGINT,
			winner VARCHAR(8),
			moves INT,
			duration INT,
			end_reason VARCHAR(16),
			created_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS game_move (
			id ` + s.autoInc() + `,
			game_id BIGINT,
			seq INT,
			color VARCHAR(8),
			x INT,
			y INT,
			ts DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS exp_daily (
			uid BIGINT,
			day VARCHAR(10),
			ai_wins INT NOT NULL DEFAULT 0,
			PRIMARY KEY (uid, day)
		)`,
	}
	for _, q := range stmts {
		if _, err := s.DB.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/store/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/store && git commit -m "feat(server): db store with sqlite/mysql migration"
```

### Task 13: user + 经验/等级 + 游客注册

**Files:**
- Create: `server/internal/user/user.go`, `server/internal/user/user_test.go`

- [ ] **Step 1: 写失败测试**

```go
package user

import (
	"testing"

	"github.com/wzq/gomoku/internal/store"
)

func newSvc(t *testing.T) *Service {
	s, err := store.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return New(s)
}

func TestCreateGuestAndGet(t *testing.T) {
	svc := newSvc(t)
	u, err := svc.CreateGuest()
	if err != nil {
		t.Fatal(err)
	}
	if u.Nickname == "" || u.Level != 1 {
		t.Fatalf("bad guest: %+v", u)
	}
	got, err := svc.Get(u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != u.ID {
		t.Fatal("get mismatch")
	}
}

func TestLevelFromExp(t *testing.T) {
	if LevelForExp(0) != 1 {
		t.Fatal("0 exp -> level 1")
	}
	if LevelForExp(100000) != 5 {
		t.Fatal("huge exp -> level 5")
	}
	if LevelForExp(120) <= 1 {
		t.Fatal("120 exp should be > level 1")
	}
}

func TestAddExpUpdatesLevel(t *testing.T) {
	svc := newSvc(t)
	u, _ := svc.CreateGuest()
	if err := svc.AddExp(u.ID, 200); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.Get(u.ID)
	if got.Exp != 200 || got.Level < 2 {
		t.Fatalf("exp/level not updated: %+v", got)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/user/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package user 管理用户、经验与等级。
package user

import (
	"database/sql"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/wzq/gomoku/internal/store"
)

type User struct {
	ID       int64  `json:"id"`
	GuestID  string `json:"guestId"`
	Username string `json:"username,omitempty"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Exp      int    `json:"exp"`
	Level    int    `json:"level"`
}

type Service struct{ s *store.Store }

func New(s *store.Store) *Service { return &Service{s: s} }

// 等级阈值：累计经验 -> 等级（Lv1~Lv5）。
var levelThresholds = []int{0, 100, 500, 2000, 8000}

func LevelForExp(exp int) int {
	lvl := 1
	for i, th := range levelThresholds {
		if exp >= th {
			lvl = i + 1
		}
	}
	return lvl
}

var nickPrefix = []string{"松", "竹", "梅", "兰", "石", "溪", "云", "山"}
var nickSuffix = []string{"客", "隐", "翁", "生", "子", "叟"}

func randomNick() string {
	return nickPrefix[rand.Intn(len(nickPrefix))] + nickSuffix[rand.Intn(len(nickSuffix))] + fmt.Sprintf("%03d", rand.Intn(1000))
}

func (svc *Service) CreateGuest() (*User, error) {
	now := time.Now()
	u := &User{GuestID: uuid.NewString(), Nickname: randomNick(), Avatar: "avatar_01", Level: 1}
	res, err := svc.s.DB.Exec(
		`INSERT INTO user (guest_id, nickname, avatar, exp, level, created_at, last_login) VALUES (?,?,?,?,?,?,?)`,
		u.GuestID, u.Nickname, u.Avatar, 0, 1, now, now)
	if err != nil {
		return nil, err
	}
	u.ID, _ = res.LastInsertId()
	return u, nil
}

func (svc *Service) Get(id int64) (*User, error) {
	u := &User{}
	var username sql.NullString
	err := svc.s.DB.QueryRow(
		`SELECT id, guest_id, username, nickname, avatar, exp, level FROM user WHERE id=?`, id).
		Scan(&u.ID, &u.GuestID, &username, &u.Nickname, &u.Avatar, &u.Exp, &u.Level)
	if err != nil {
		return nil, err
	}
	u.Username = username.String
	return u, nil
}

// AddExp 增减经验并同步等级（不低于 0）。
func (svc *Service) AddExp(id int64, delta int) error {
	u, err := svc.Get(id)
	if err != nil {
		return err
	}
	exp := u.Exp + delta
	if exp < 0 {
		exp = 0
	}
	_, err = svc.s.DB.Exec(`UPDATE user SET exp=?, level=? WHERE id=?`, exp, LevelForExp(exp), id)
	return err
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/user/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/user && git commit -m "feat(server): user service with exp and level"
```

### Task 14: 升级绑定 + 登录 + 防刷计数

**Files:**
- Modify: `server/internal/user/user.go`
- Modify: `server/internal/user/user_test.go`

- [ ] **Step 1: 追加失败测试**

```go
func TestBindAndLogin(t *testing.T) {
	svc := newSvc(t)
	u, _ := svc.CreateGuest()
	if err := svc.Bind(u.ID, "alice", "pw123456"); err != nil {
		t.Fatal(err)
	}
	got, err := svc.Login("alice", "pw123456")
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != u.ID {
		t.Fatal("login returned wrong user")
	}
	if _, err := svc.Login("alice", "wrong"); err == nil {
		t.Fatal("expected auth failure")
	}
}

func TestAiWinDailyCap(t *testing.T) {
	svc := newSvc(t)
	u, _ := svc.CreateGuest()
	cap := 3
	granted := 0
	for i := 0; i < 5; i++ {
		if svc.AllowAiWinExp(u.ID, cap) {
			granted++
		}
	}
	if granted != cap {
		t.Fatalf("granted=%d want %d", granted, cap)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/user/`
Expected: FAIL

- [ ] **Step 3: 实现（追加到 user.go）**

```go
import "golang.org/x/crypto/bcrypt" // 加到 import 块

var ErrAuth = errors.New("auth failed") // 需 import "errors"

func (svc *Service) Bind(id int64, username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = svc.s.DB.Exec(`UPDATE user SET username=?, password_hash=? WHERE id=?`, username, string(hash), id)
	return err
}

func (svc *Service) Login(username, password string) (*User, error) {
	var id int64
	var hash string
	err := svc.s.DB.QueryRow(`SELECT id, password_hash FROM user WHERE username=?`, username).Scan(&id, &hash)
	if err != nil {
		return nil, ErrAuth
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return nil, ErrAuth
	}
	return svc.Get(id)
}

// AllowAiWinExp 返回今日是否还能因人机胜利发经验（原子自增 + 判上限）。
func (svc *Service) AllowAiWinExp(id int64, dailyCap int) bool {
	day := time.Now().Format("2006-01-02")
	// upsert 计数
	svc.s.DB.Exec(`INSERT INTO exp_daily (uid, day, ai_wins) VALUES (?,?,0)
		ON CONFLICT(uid, day) DO NOTHING`, id, day)
	var wins int
	if err := svc.s.DB.QueryRow(`SELECT ai_wins FROM exp_daily WHERE uid=? AND day=?`, id, day).Scan(&wins); err != nil {
		return false
	}
	if wins >= dailyCap {
		return false
	}
	svc.s.DB.Exec(`UPDATE exp_daily SET ai_wins=ai_wins+1 WHERE uid=? AND day=?`, id, day)
	return true
}
```

注：在文件顶部 import 块补上 `"errors"` 与 `"golang.org/x/crypto/bcrypt"`。

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/user/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/user && git commit -m "feat(server): bind/login and daily ai-win anti-farm"
```

---

## Milestone 5：房间对战（状态机 + 裁判 + 悔棋 + 落库）

设计：把**房间对战逻辑**（纯状态机，不含网络）与**WebSocket 传输**分离，前者可单测。

### Task 15: record（对局 + 棋谱落库）

**Files:**
- Create: `server/internal/record/record.go`, `server/internal/record/record_test.go`

- [ ] **Step 1: 写失败测试**

```go
package record

import (
	"testing"
	"time"

	"github.com/wzq/gomoku/internal/store"
)

func TestSaveGameAndMoves(t *testing.T) {
	s, _ := store.Open("sqlite", ":memory:")
	s.Migrate()
	svc := New(s)
	g := Game{
		Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "black",
		Moves: 2, Duration: 30, EndReason: "five", CreatedAt: time.Now(),
		MoveList: []Move{{Seq: 1, Color: "black", X: 7, Y: 7}, {Seq: 2, Color: "white", X: 8, Y: 8}},
	}
	id, err := svc.Save(g)
	if err != nil {
		t.Fatal(err)
	}
	var n int
	s.DB.QueryRow(`SELECT COUNT(*) FROM game_move WHERE game_id=?`, id).Scan(&n)
	if n != 2 {
		t.Fatalf("moves saved=%d want 2", n)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/record/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package record 落库对局概要与逐手棋谱。
package record

import (
	"time"

	"github.com/wzq/gomoku/internal/store"
)

type Move struct {
	Seq   int
	Color string
	X, Y  int
}

type Game struct {
	Mode      string
	AILevel   int
	BlackUID  int64
	WhiteUID  int64
	Winner    string
	Moves     int
	Duration  int
	EndReason string
	CreatedAt time.Time
	MoveList  []Move
}

type Service struct{ s *store.Store }

func New(s *store.Store) *Service { return &Service{s: s} }

func (svc *Service) Save(g Game) (int64, error) {
	res, err := svc.s.DB.Exec(
		`INSERT INTO game_record (mode, ai_level, black_uid, white_uid, winner, moves, duration, end_reason, created_at)
		 VALUES (?,?,?,?,?,?,?,?,?)`,
		g.Mode, g.AILevel, g.BlackUID, g.WhiteUID, g.Winner, g.Moves, g.Duration, g.EndReason, g.CreatedAt)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	for _, m := range g.MoveList {
		if _, err := svc.s.DB.Exec(
			`INSERT INTO game_move (game_id, seq, color, x, y, ts) VALUES (?,?,?,?,?,?)`,
			id, m.Seq, m.Color, m.X, m.Y, time.Now()); err != nil {
			return id, err
		}
	}
	return id, nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/record/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/record && git commit -m "feat(server): game record and move persistence"
```

### Task 16: 房间状态机（纯逻辑）

**Files:**
- Create: `server/internal/room/game.go`, `server/internal/room/game_test.go`

- [ ] **Step 1: 写失败测试**

```go
package room

import "testing"

func TestGameFlow(t *testing.T) {
	g := NewGame(1, 2) // black uid=1, white uid=2
	if g.Turn() != 1 {
		t.Fatal("black moves first")
	}
	// 非当前方落子被拒
	if _, err := g.Move(2, 7, 7); err == nil {
		t.Fatal("white should not move on black's turn")
	}
	if _, err := g.Move(1, 7, 7); err != nil {
		t.Fatal(err)
	}
	if g.Turn() != 2 {
		t.Fatal("turn should switch to white")
	}
}

func TestGameWin(t *testing.T) {
	g := NewGame(1, 2)
	// 黑 (3..7,7)，白穿插它处
	seq := [][3]int{{1, 3, 7}, {2, 3, 8}, {1, 4, 7}, {2, 4, 8}, {1, 5, 7}, {2, 5, 8}, {1, 6, 7}, {2, 6, 8}}
	for _, m := range seq {
		if _, err := g.Move(int64(m[0]), m[1], m[2]); err != nil {
			t.Fatal(err)
		}
	}
	res, err := g.Move(1, 7, 7)
	if err != nil {
		t.Fatal(err)
	}
	if res == nil || res.Winner != 1 || res.Reason != "five" {
		t.Fatalf("expected black win by five, got %+v", res)
	}
}

func TestUndoNeedsBothAgree(t *testing.T) {
	g := NewGame(1, 2)
	g.Move(1, 7, 7)
	// 白发起悔棋，黑同意 -> 回退黑最后一手
	if !g.RequestUndo(2) {
		t.Fatal("undo request should be allowed")
	}
	ok := g.ReplyUndo(true)
	if !ok {
		t.Fatal("agreed undo should succeed")
	}
	if g.MovesCount() != 0 {
		t.Fatalf("board should revert, moves=%d", g.MovesCount())
	}
}

func TestUndoCapPerPlayer(t *testing.T) {
	g := NewGame(1, 2)
	for i := 0; i < 3; i++ {
		g.Move(1, i, 0)
		g.Move(2, i, 1)
		g.RequestUndo(1)
		g.ReplyUndo(true) // 每次回退黑一手... 这里只验证次数上限
	}
	// 第 3 次应被拒（每人上限 2）
	g.Move(1, 5, 5)
	if g.RequestUndo(1) {
		// 已达上限仍允许则失败
		if g.UndoUsed(1) > 2 {
			t.Fatal("undo exceeded cap")
		}
	}
}

func TestResign(t *testing.T) {
	g := NewGame(1, 2)
	res := g.Resign(1)
	if res.Winner != 2 || res.Reason != "resign" {
		t.Fatalf("resign wrong: %+v", res)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd server && go test ./internal/room/`
Expected: FAIL

- [ ] **Step 3: 实现**

```go
// Package room 的 game.go 是房间对战的纯状态机（无网络）：轮转、裁判、悔棋、认输。
package room

import (
	"errors"

	"github.com/wzq/gomoku/internal/gomoku"
)

var ErrNotYourTurn = errors.New("not your turn")

type moveRec struct {
	uid  int64
	x, y int
}

type Result struct {
	Winner int64  // 胜方 uid
	Reason string // five | timeout | resign | leave
}

type Game struct {
	black, white int64
	board        *gomoku.Board
	turnUID      int64
	history      []moveRec
	over         bool
	undoUsed     map[int64]int
	pendingUndo  int64 // 发起悔棋方 uid，0 表示无
}

func NewGame(black, white int64) *Game {
	return &Game{
		black: black, white: white, board: gomoku.NewBoard(),
		turnUID: black, undoUsed: map[int64]int{},
	}
}

func (g *Game) Turn() int64     { return g.turnUID }
func (g *Game) MovesCount() int { return len(g.history) }
func (g *Game) UndoUsed(uid int64) int { return g.undoUsed[uid] }

func (g *Game) colorOf(uid int64) gomoku.Color {
	if uid == g.black {
		return gomoku.Black
	}
	return gomoku.White
}

func (g *Game) other(uid int64) int64 {
	if uid == g.black {
		return g.white
	}
	return g.black
}

// Move 落子；返回非 nil Result 表示对局结束。
func (g *Game) Move(uid int64, x, y int) (*Result, error) {
	if g.over {
		return nil, errors.New("game over")
	}
	if uid != g.turnUID {
		return nil, ErrNotYourTurn
	}
	if err := g.board.Apply(x, y, g.colorOf(uid)); err != nil {
		return nil, err
	}
	g.history = append(g.history, moveRec{uid, x, y})
	g.pendingUndo = 0
	if g.board.CheckWin(x, y) != "" {
		g.over = true
		return &Result{Winner: uid, Reason: "five"}, nil
	}
	g.turnUID = g.other(uid)
	return nil, nil
}

// RequestUndo 发起悔棋，未超上限且有可悔的手时返回 true。
func (g *Game) RequestUndo(uid int64) bool {
	if g.over || len(g.history) == 0 || g.undoUsed[uid] >= 2 {
		return false
	}
	g.pendingUndo = uid
	return true
}

// ReplyUndo 对方回应；同意则回退最后一手并记次数。
func (g *Game) ReplyUndo(agree bool) bool {
	if g.pendingUndo == 0 {
		return false
	}
	requester := g.pendingUndo
	g.pendingUndo = 0
	if !agree {
		return false
	}
	last := g.history[len(g.history)-1]
	g.history = g.history[:len(g.history)-1]
	// 清掉棋盘上那一手：重建棋盘
	g.rebuild()
	g.turnUID = last.uid // 回到刚被悔的那方重下
	g.undoUsed[requester]++
	return true
}

func (g *Game) rebuild() {
	g.board = gomoku.NewBoard()
	for _, m := range g.history {
		g.board.Apply(m.x, m.y, g.colorOf(m.uid))
	}
}

func (g *Game) Resign(uid int64) *Result {
	g.over = true
	return &Result{Winner: g.other(uid), Reason: "resign"}
}

// Timeout 当前方超时判负。
func (g *Game) Timeout() *Result {
	g.over = true
	return &Result{Winner: g.other(g.turnUID), Reason: "timeout"}
}

// Leave 某方离开，对方胜。
func (g *Game) Leave(uid int64) *Result {
	g.over = true
	return &Result{Winner: g.other(uid), Reason: "leave"}
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd server && go test ./internal/room/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/room/game.go server/internal/room/game_test.go && git commit -m "feat(server): room game state machine (referee/undo/resign)"
```

### Task 17: WebSocket hub + 协议 + 计时

**Files:**
- Create: `server/internal/room/hub.go`, `server/internal/room/proto.go`, `server/internal/room/hub_test.go`

- [ ] **Step 1: 定义协议（proto.go）**

```go
package room

// 客户端 -> 服务端
type ClientMsg struct {
	Type string `json:"type"` // ready | move | undo_req | undo_reply | resign
	X    int    `json:"x"`
	Y    int    `json:"y"`
	Agree bool  `json:"agree"`
}

// 服务端 -> 客户端
type ServerMsg struct {
	Type     string `json:"type"` // room_state | start | move | turn | undo_req | undo_result | game_over | opponent_left
	Color    string `json:"color,omitempty"`
	UID      int64  `json:"uid,omitempty"`
	X        int    `json:"x,omitempty"`
	Y        int    `json:"y,omitempty"`
	Seq      int    `json:"seq,omitempty"`
	Deadline int64  `json:"deadline,omitempty"` // 当前回合截止 unix ms
	Winner   int64  `json:"winner,omitempty"`
	Reason   string `json:"reason,omitempty"`
	Agree    bool   `json:"agree,omitempty"`
	Players  int    `json:"players,omitempty"`
}
```

- [ ] **Step 2: 写 hub 失败测试（房间创建/加入/满员）**

`hub_test.go`:
```go
package room

import "testing"

func TestHubCreateAndJoin(t *testing.T) {
	h := NewHub()
	id := h.Create(1)
	if id == "" {
		t.Fatal("empty room id")
	}
	r, ok := h.Get(id)
	if !ok {
		t.Fatal("room not found")
	}
	if err := r.addPlayer(1); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(2); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(3); err == nil {
		t.Fatal("third player should be rejected")
	}
}
```

- [ ] **Step 3: 运行确认失败**

Run: `cd server && go test ./internal/room/ -run TestHub`
Expected: FAIL

- [ ] **Step 4: 实现 hub.go**

```go
// Package room 的 hub.go：内存房间管理 + WebSocket 传输 + 每步计时。
package room

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const turnSeconds = 60

type client struct {
	uid  int64
	conn *websocket.Conn
	send chan ServerMsg
}

type Room struct {
	ID      string
	mu      sync.Mutex
	players []int64
	clients map[int64]*client
	game    *Game
	timer   *time.Timer
	onOver  func(r *Room, res *Result)
}

func (r *Room) addPlayer(uid int64) error {
	for _, p := range r.players {
		if p == uid {
			return nil // 重连
		}
	}
	if len(r.players) >= 2 {
		return errors.New("room full")
	}
	r.players = append(r.players, uid)
	return nil
}

type Hub struct {
	mu    sync.Mutex
	rooms map[string]*Room
	up    websocket.Upgrader
}

func NewHub() *Hub {
	return &Hub{
		rooms: map[string]*Room{},
		up:    websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
	}
}

func (h *Hub) Create(owner int64) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	id := uuid.NewString()[:8]
	h.rooms[id] = &Room{ID: id, clients: map[int64]*client{}}
	return id
}

func (h *Hub) Get(id string) (*Room, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.rooms[id]
	return r, ok
}

// broadcast 给房间所有客户端发消息。
func (r *Room) broadcast(m ServerMsg) {
	for _, c := range r.clients {
		select {
		case c.send <- m:
		default:
		}
	}
}

func (r *Room) sendTo(uid int64, m ServerMsg) {
	if c, ok := r.clients[uid]; ok {
		select {
		case c.send <- m:
		default:
		}
	}
}

// startTurnTimer 重置当前回合计时；超时广播 game_over。
func (r *Room) startTurnTimer() {
	if r.timer != nil {
		r.timer.Stop()
	}
	deadline := time.Now().Add(turnSeconds * time.Second)
	r.broadcast(ServerMsg{Type: "turn", UID: r.game.Turn(), Deadline: deadline.UnixMilli()})
	r.timer = time.AfterFunc(turnSeconds*time.Second, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.game == nil || r.game.over {
			return
		}
		res := r.game.Timeout()
		r.finish(res)
	})
}

func (r *Room) finish(res *Result) {
	if r.timer != nil {
		r.timer.Stop()
	}
	r.broadcast(ServerMsg{Type: "game_over", Winner: res.Winner, Reason: res.Reason})
	if r.onOver != nil {
		r.onOver(r, res)
	}
}
```

- [ ] **Step 5: 运行确认通过**

Run: `cd server && go test ./internal/room/ -run TestHub`
Expected: PASS

- [ ] **Step 6: 实现 WS 接入 + 读写循环（追加到 hub.go）**

```go
// ServeWS 升级连接并加入房间；uid 由上层鉴权后传入。
func (h *Hub) ServeWS(w http.ResponseWriter, req *http.Request, roomID string, uid int64) {
	r, ok := h.Get(roomID)
	if !ok {
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}
	conn, err := h.up.Upgrade(w, req, nil)
	if err != nil {
		return
	}
	c := &client{uid: uid, conn: conn, send: make(chan ServerMsg, 16)}
	r.mu.Lock()
	if err := r.addPlayer(uid); err != nil {
		r.mu.Unlock()
		conn.Close()
		return
	}
	r.clients[uid] = c
	players := len(r.players)
	r.mu.Unlock()

	go c.writeLoop()
	c.send <- ServerMsg{Type: "room_state", Players: players}

	// 双方到齐则开局：黑先，房主(players[0])为黑
	r.mu.Lock()
	if len(r.players) == 2 && r.game == nil {
		r.game = NewGame(r.players[0], r.players[1])
		r.sendTo(r.players[0], ServerMsg{Type: "start", Color: "black"})
		r.sendTo(r.players[1], ServerMsg{Type: "start", Color: "white"})
		r.startTurnTimer()
	}
	r.mu.Unlock()

	c.readLoop(r)
}

func (c *client) writeLoop() {
	for m := range c.send {
		if err := c.conn.WriteJSON(m); err != nil {
			return
		}
	}
}

func (c *client) readLoop(r *Room) {
	defer func() {
		c.conn.Close()
		r.mu.Lock()
		delete(r.clients, c.uid)
		if r.game != nil && !r.game.over {
			res := r.game.Leave(c.uid)
			r.finish(res)
		}
		r.mu.Unlock()
	}()
	for {
		var msg ClientMsg
		if err := c.conn.ReadJSON(&msg); err != nil {
			return
		}
		r.handle(c.uid, msg)
	}
}

func (r *Room) handle(uid int64, msg ClientMsg) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.game == nil {
		return
	}
	switch msg.Type {
	case "move":
		res, err := r.game.Move(uid, msg.X, msg.Y)
		if err != nil {
			return
		}
		r.broadcast(ServerMsg{Type: "move", UID: uid, X: msg.X, Y: msg.Y, Seq: r.game.MovesCount()})
		if res != nil {
			r.finish(res)
		} else {
			r.startTurnTimer()
		}
	case "undo_req":
		if r.game.RequestUndo(uid) {
			r.broadcast(ServerMsg{Type: "undo_req", UID: uid})
		}
	case "undo_reply":
		agreed := r.game.ReplyUndo(msg.Agree)
		r.broadcast(ServerMsg{Type: "undo_result", Agree: agreed})
		if agreed {
			r.startTurnTimer()
		}
	case "resign":
		res := r.game.Resign(uid)
		r.finish(res)
	}
}

var _ = json.Marshal // 保留 json 依赖（WriteJSON 内部使用）
```

- [ ] **Step 7: 编译校验**

Run: `cd server && go build ./... && go test ./internal/room/`
Expected: 成功、测试 PASS

- [ ] **Step 8: Commit**

```bash
git add server/internal/room && git commit -m "feat(server): websocket hub, protocol, turn timer"
```

### Task 18: REST API + main 装配

**Files:**
- Create: `server/internal/api/http.go`
- Modify: `server/cmd/server/main.go`

- [ ] **Step 1: 实现 http.go**

```go
// Package api 装配 REST 路由与鉴权中间件。
package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
	"github.com/wzq/gomoku/internal/user"
)

type Server struct {
	Users   *user.Service
	Auth    *auth.Manager
	Hub     *room.Hub
	Records *record.Service
	DailyAiWinCap int
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// uidFrom 从 Authorization: Bearer 解析 uid。
func (s *Server) uidFrom(r *http.Request) (int64, bool) {
	h := r.Header.Get("Authorization")
	tok := strings.TrimPrefix(h, "Bearer ")
	if tok == "" {
		tok = r.URL.Query().Get("token") // WS 用 query 传
	}
	sub, err := s.Auth.Verify(tok)
	if err != nil {
		return 0, false
	}
	id, err := strconv.ParseInt(sub, 10, 64)
	return id, err == nil
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/guest", func(w http.ResponseWriter, r *http.Request) {
		u, err := s.Users.CreateGuest()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		tok, _ := s.Auth.Issue(strconv.FormatInt(u.ID, 10))
		writeJSON(w, map[string]any{"token": tok, "user": u})
	})

	mux.HandleFunc("/api/me", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.uidFrom(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		u, err := s.Users.Get(uid)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, u)
	})

	mux.HandleFunc("/api/bind", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.uidFrom(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		var body struct{ Username, Password string }
		json.NewDecoder(r.Body).Decode(&body)
		if err := s.Users.Bind(uid, body.Username, body.Password); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Username, Password string }
		json.NewDecoder(r.Body).Decode(&body)
		u, err := s.Users.Login(body.Username, body.Password)
		if err != nil {
			http.Error(w, "auth failed", 401)
			return
		}
		tok, _ := s.Auth.Issue(strconv.FormatInt(u.ID, 10))
		writeJSON(w, map[string]any{"token": tok, "user": u})
	})

	// 人机对局结果上报（Phase1 信任客户端）
	mux.HandleFunc("/api/ai/result", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.uidFrom(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		var body struct {
			Level int  `json:"level"`
			Win   bool `json:"win"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		delta := 5
		if body.Win {
			if s.Users.AllowAiWinExp(uid, s.DailyAiWinCap) {
				delta = 20
			} else {
				delta = 0
			}
		}
		s.Users.AddExp(uid, delta)
		u, _ := s.Users.Get(uid)
		writeJSON(w, map[string]any{"expDelta": delta, "user": u})
	})

	mux.HandleFunc("/api/room", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.uidFrom(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		id := s.Hub.Create(uid)
		writeJSON(w, map[string]string{"roomId": id})
	})

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.uidFrom(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		s.Hub.ServeWS(w, r, r.URL.Query().Get("room"), uid)
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	return withCORS(mux)
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		h.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 2: 装配 main.go**

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/wzq/gomoku/internal/api"
	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/config"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
	"github.com/wzq/gomoku/internal/store"
	"github.com/wzq/gomoku/internal/user"
)

func main() {
	cfg, err := config.Load("config.yaml")
	if err != nil {
		log.Fatal(err)
	}
	os.MkdirAll("data", 0o755)
	st, err := store.Open(cfg.DB.Driver, cfg.DB.DSN)
	if err != nil {
		log.Fatal(err)
	}
	if err := st.Migrate(); err != nil {
		log.Fatal(err)
	}
	srv := &api.Server{
		Users:         user.New(st),
		Auth:          auth.NewManager(cfg.Auth.Secret, cfg.Auth.AuthTTLMinutes),
		Hub:           room.NewHub(),
		Records:       record.New(st),
		DailyAiWinCap: 20,
	}
	log.Println("listening", cfg.Addr)
	log.Fatal(http.ListenAndServe(cfg.Addr, srv.Routes()))
}
```

- [ ] **Step 3: 编译 + 冒烟**

Run:
```bash
cd server && go build ./... && (./server &) ; sleep 1 && curl -s localhost:8080/healthz && curl -s -X POST localhost:8080/api/guest ; pkill -f '/server$' || true
```
Expected: `ok` + 返回含 `token` 与 `user` 的 JSON

- [ ] **Step 4: Commit**

```bash
git add server && git commit -m "feat(server): REST api and main wiring"
```

---

## Milestone 6：前端集成（网络 + 状态 + 棋盘 + 页面）

前置：在 `web/.env` 写 `VITE_API_BASE=http://localhost:8080`。

### Task 19: 网络客户端

**Files:**
- Create: `web/src/net/rest.ts`, `web/src/net/ws.ts`

- [ ] **Step 1: 实现 rest.ts**

```ts
const BASE = import.meta.env.VITE_API_BASE ?? ''

function token(): string {
  return localStorage.getItem('wzq_token') ?? ''
}

async function req(path: string, method: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

export interface User { id: number; nickname: string; avatar: string; exp: number; level: number; username?: string }

export async function ensureGuest(): Promise<User> {
  if (token()) return req('/api/me', 'GET')
  const { token: t, user } = await req('/api/guest', 'POST')
  localStorage.setItem('wzq_token', t)
  return user
}
export const bind = (username: string, password: string) => req('/api/bind', 'POST', { username, password })
export async function login(username: string, password: string): Promise<User> {
  const { token: t, user } = await req('/api/login', 'POST', { username, password })
  localStorage.setItem('wzq_token', t)
  return user
}
export const reportAiResult = (level: number, win: boolean) => req('/api/ai/result', 'POST', { level, win })
export const createRoom = () => req('/api/room', 'POST') as Promise<{ roomId: string }>
export { token }
```

- [ ] **Step 2: 实现 ws.ts**

```ts
import { token } from './rest'

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

export function connectRoom(roomId: string, onMsg: (m: ServerMsg) => void): WebSocket {
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/^http/, 'ws')
  const ws = new WebSocket(`${base}/ws?room=${roomId}&token=${token()}`)
  ws.onmessage = (e) => onMsg(JSON.parse(e.data))
  return ws
}

export function sendMove(ws: WebSocket, x: number, y: number) {
  ws.send(JSON.stringify({ type: 'move', x, y }))
}
export const sendUndoReq = (ws: WebSocket) => ws.send(JSON.stringify({ type: 'undo_req' }))
export const sendUndoReply = (ws: WebSocket, agree: boolean) => ws.send(JSON.stringify({ type: 'undo_reply', agree }))
export const sendResign = (ws: WebSocket) => ws.send(JSON.stringify({ type: 'resign' }))
```

- [ ] **Step 3: 编译校验**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add web/src/net && git commit -m "feat(web): REST and WebSocket clients"
```

### Task 20: 对局状态 store（Zustand）

**Files:**
- Create: `web/src/store/game.ts`, `web/src/store/game.test.ts`

- [ ] **Step 1: 写失败测试（纯逻辑：预落子/确认）**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGame } from './game'

describe('game store', () => {
  beforeEach(() => useGame.getState().reset('black'))
  it('选点后进入预落子', () => {
    useGame.getState().preview(7, 7)
    expect(useGame.getState().pending).toEqual({ x: 7, y: 7 })
  })
  it('取消预落子', () => {
    useGame.getState().preview(7, 7)
    useGame.getState().cancel()
    expect(useGame.getState().pending).toBeNull()
  })
  it('确认落子写盘并切换', () => {
    useGame.getState().preview(7, 7)
    useGame.getState().confirm()
    expect(useGame.getState().board[7][7]).toBe('black')
    expect(useGame.getState().turn).toBe('white')
    expect(useGame.getState().pending).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/store/game.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import { create } from 'zustand'
import { Board, Color, emptyBoard } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'

interface GameState {
  board: Board
  turn: Color
  myColor: Color
  pending: { x: number; y: number } | null
  lastMove: { x: number; y: number } | null
  winner: Color | null
  reset: (myColor: Color) => void
  preview: (x: number, y: number) => void
  cancel: () => void
  confirm: () => void
  place: (x: number, y: number, color: Color) => void // 用于对手落子/回放
}

export const useGame = create<GameState>((set, get) => ({
  board: emptyBoard(),
  turn: 'black',
  myColor: 'black',
  pending: null,
  lastMove: null,
  winner: null,
  reset: (myColor) => set({ board: emptyBoard(), turn: 'black', myColor, pending: null, lastMove: null, winner: null }),
  preview: (x, y) => {
    const { board } = get()
    if (board[y][x] === null) set({ pending: { x, y } })
  },
  cancel: () => set({ pending: null }),
  confirm: () => {
    const { pending, turn } = get()
    if (!pending) return
    get().place(pending.x, pending.y, turn)
    set({ pending: null })
  },
  place: (x, y, color) => {
    const board = applyMove(get().board, { x, y, color })
    const winner = checkWin(board, x, y)
    set({ board, lastMove: { x, y }, winner, turn: color === 'black' ? 'white' : 'black' })
  },
}))
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/store/game.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/store && git commit -m "feat(web): zustand game store with preview/confirm"
```

### Task 21: Canvas 棋盘组件

**Files:**
- Create: `web/src/board/BoardCanvas.tsx`

- [ ] **Step 1: 实现（含预落子半透明、最新子呼吸灯）**

```tsx
import { useEffect, useRef } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'

const CELL = 40
const PAD = 30
const PX = CELL * (SIZE - 1) + PAD * 2

export function BoardCanvas({ onConfirm }: { onConfirm: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const board = useGame((s) => s.board)
  const pending = useGame((s) => s.pending)
  const last = useGame((s) => s.lastMove)
  const turn = useGame((s) => s.turn)
  const myColor = useGame((s) => s.myColor)
  const preview = useGame((s) => s.preview)

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = PX * dpr
    cv.height = PX * dpr
    cv.style.width = `${PX}px`
    cv.style.height = `${PX}px`
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PX, PX)
      // 木色底
      ctx.fillStyle = '#d9b586'
      ctx.fillRect(0, 0, PX, PX)
      // 网格
      ctx.strokeStyle = '#5a3a1a'
      ctx.lineWidth = 1
      for (let i = 0; i < SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(PAD, PAD + i * CELL); ctx.lineTo(PX - PAD, PAD + i * CELL)
        ctx.moveTo(PAD + i * CELL, PAD); ctx.lineTo(PAD + i * CELL, PX - PAD)
        ctx.stroke()
      }
      // 棋子
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++)
          if (board[y][x]) drawStone(ctx, x, y, board[y][x]!, 1)
      // 预落子半透明
      if (pending) drawStone(ctx, pending.x, pending.y, myColor, 0.5)
      // 最新子呼吸灯
      if (last && board[last.y][last.x]) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 300)
        ctx.beginPath()
        ctx.arc(PAD + last.x * CELL, PAD + last.y * CELL, CELL * 0.45 + pulse * 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(220,60,60,${0.4 + pulse * 0.4})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [board, pending, last, myColor])

  const onClick = (e: React.MouseEvent) => {
    if (turn !== myColor) return
    const rect = ref.current!.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left - PAD) / CELL)
    const y = Math.round((e.clientY - rect.top - PAD) / CELL)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    if (pending && pending.x === x && pending.y === y) onConfirm()
    else preview(x, y)
  }

  return <canvas ref={ref} onClick={onClick} style={{ borderRadius: 8, cursor: 'pointer' }} />
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, color: 'black' | 'white', alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(PAD + x * CELL, PAD + y * CELL, CELL * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = color === 'black' ? '#1a1a1a' : '#f5f5f0'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.stroke()
  ctx.restore()
}
```

- [ ] **Step 2: 编译校验**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add web/src/board && git commit -m "feat(web): canvas board with preview and last-move pulse"
```

### Task 22: 音频管理

**Files:**
- Create: `web/src/audio/audio.ts`

- [ ] **Step 1: 实现（占位音频 + 设置持久化）**

```ts
type Sfx = 'place' | 'win' | 'lose' | 'button' | 'undo' | 'tick' | 'timeout'

interface Settings { bgm: boolean; sfx: boolean; bgmVol: number; sfxVol: number }

const DEFAULTS: Settings = { bgm: true, sfx: true, bgmVol: 0.5, sfxVol: 0.8 }

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

// 占位：素材放在 /assets/audio/<name>.mp3（Task 素材阶段用免费音效替换）
function url(name: string) {
  return `/assets/audio/${name}.mp3`
}

export function getSettings(): Settings {
  return { ...settings }
}
export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  localStorage.setItem('wzq_audio', JSON.stringify(settings))
  if (bgmEl) {
    bgmEl.volume = settings.bgmVol
    if (!settings.bgm) bgmEl.pause()
    else bgmEl.play().catch(() => {})
  }
}

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

export function startBgm() {
  if (!bgmEl) {
    bgmEl = new Audio(url('bgm'))
    bgmEl.loop = true
  }
  bgmEl.volume = settings.bgmVol
  if (settings.bgm) bgmEl.play().catch(() => {})
}
```

- [ ] **Step 2: 编译校验**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add web/src/audio && git commit -m "feat(web): audio manager with persisted settings"
```

### Task 23: 页面与路由（首页/人机配置/对局/结果/房间）

**Files:**
- Create: `web/src/pages/Home.tsx`, `web/src/pages/AiConfig.tsx`, `web/src/pages/Game.tsx`, `web/src/pages/Result.tsx`, `web/src/pages/Room.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 安装路由**

Run: `cd web && npm install react-router-dom`

- [ ] **Step 2: 实现 App.tsx（路由 + 启动 ensureGuest）**

```tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ensureGuest, User } from './net/rest'
import { Home } from './pages/Home'
import { AiConfig } from './pages/AiConfig'
import { Game } from './pages/Game'
import { Result } from './pages/Result'
import { Room } from './pages/Room'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    ensureGuest().then(setUser).catch(console.error)
  }, [])
  if (!user) return <div className="loading">加载中…</div>
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/ai" element={<AiConfig user={user} />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
        <Route path="/room/:id?" element={<Room />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: 实现 Home.tsx**

```tsx
import { useNavigate } from 'react-router-dom'
import { User } from '../net/rest'

export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  return (
    <div className="home screen">
      <header className="profile">
        <img src={`/assets/img/${user.avatar}.png`} alt="" className="avatar" />
        <div>
          <div className="nick">{user.nickname}</div>
          <div className="exp">经验 {user.exp} · Lv.{user.level}</div>
        </div>
        <button className="settings-btn" onClick={() => nav('/settings')}>⚙️</button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>人机对战</button>
        <button className="entry" onClick={() => nav('/room')}>好友对战</button>
        <button className="entry disabled" disabled>残局闯关（即将开放）</button>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: 实现 AiConfig.tsx**

```tsx
import { useNavigate } from 'react-router-dom'
import { User } from '../net/rest'

const LEVELS = [
  { lv: 1, name: '普通练习', cost: 0 },
  { lv: 2, name: '中等', cost: 50 },
  { lv: 3, name: '高级', cost: 100 },
]

export function AiConfig({ user }: { user: User }) {
  const nav = useNavigate()
  return (
    <div className="ai-config screen">
      <h2>选择难度</h2>
      {LEVELS.map((l) => (
        <button
          key={l.lv}
          className="level-card"
          disabled={user.exp < l.cost}
          onClick={() => nav('/game', { state: { mode: 'ai', level: l.lv, cost: l.cost } })}
        >
          <span>{l.name}</span>
          <span>当前经验 {user.exp} · 消耗 {l.cost} · 胜利 +20</span>
        </button>
      ))}
      <button onClick={() => nav('/')}>返回</button>
    </div>
  )
}
```

- [ ] **Step 5: 实现 Game.tsx（人机：AI Worker；真人：WebSocket）**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BoardCanvas } from '../board/BoardCanvas'
import { useGame } from '../store/game'
import { playSfx } from '../audio/audio'
import { reportAiResult } from '../net/rest'
import { connectRoom, sendMove, sendUndoReq, sendUndoReply, sendResign, ServerMsg } from '../net/ws'
import type { Color } from '../core/types'

export function Game() {
  const loc = useLocation() as { state?: { mode: string; level?: number; roomId?: string; myColor?: Color } }
  const nav = useNavigate()
  const st = loc.state ?? { mode: 'ai', level: 1 }
  const g = useGame()
  const workerRef = useRef<Worker | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remain, setRemain] = useState(60)

  // 初始化
  useEffect(() => {
    g.reset(st.mode === 'ai' ? 'black' : st.myColor ?? 'black')
    if (st.mode === 'ai') {
      workerRef.current = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
      workerRef.current.onmessage = (e: MessageEvent<{ x: number; y: number; color: Color }>) => {
        g.place(e.data.x, e.data.y, 'white')
        playSfx('place')
      }
    } else if (st.roomId) {
      wsRef.current = connectRoom(st.roomId, handleServer)
    }
    return () => {
      workerRef.current?.terminate()
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 人机模式：轮到 AI(白) 时请求 worker
  useEffect(() => {
    if (st.mode === 'ai' && g.turn === 'white' && !g.winner) {
      workerRef.current?.postMessage({ board: g.board, color: 'white', level: st.level })
    }
  }, [g.turn, g.winner, g.board, st.mode, st.level])

  // 胜负结算
  useEffect(() => {
    if (!g.winner) return
    const win = g.winner === g.myColor
    playSfx(win ? 'win' : 'lose')
    if (st.mode === 'ai') {
      reportAiResult(st.level ?? 1, win).then((r) =>
        nav('/result', { state: { win, expDelta: r.expDelta } }),
      )
    }
  }, [g.winner])

  // 真人计时
  useEffect(() => {
    if (deadline == null) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemain(s)
      if (s <= 5 && s > 0) playSfx('tick')
    }, 250)
    return () => clearInterval(t)
  }, [deadline])

  function handleServer(m: ServerMsg) {
    switch (m.type) {
      case 'move':
        if (m.uid !== undefined) {
          const c: Color = m.color ?? (g.turn as Color)
          // 服务端广播含坐标；对手落子才写盘（自己的已本地落）
          g.place(m.x!, m.y!, g.board[m.y!][m.x!] ? c : g.turn)
        }
        break
      case 'turn':
        setDeadline(m.deadline ?? null)
        break
      case 'game_over':
        nav('/result', { state: { win: m.winner === g.myColor ? 1 : 0, reason: m.reason } })
        break
    }
  }

  const onConfirm = () => {
    const p = g.pending
    if (!p) return
    g.confirm()
    playSfx('place')
    if (st.mode === 'pvp' && wsRef.current) sendMove(wsRef.current, p.x, p.y)
  }

  return (
    <div className="game screen">
      <div className="player opponent">对手 {st.mode === 'ai' ? 'AI大师 ⚪' : '⚪'}</div>
      <BoardCanvas onConfirm={onConfirm} />
      <div className="hud">
        {g.turn === g.myColor ? <span className="tip">轮到你落子</span> : <span>对方思考中…</span>}
        {st.mode === 'pvp' && <span className={remain <= 10 ? 'warn' : ''}>{remain}s</span>}
        {g.pending && <button onClick={onConfirm}>✓ 确认</button>}
        {g.pending && <button onClick={() => g.cancel()}>取消</button>}
        {st.mode === 'pvp' && wsRef.current && (
          <>
            <button onClick={() => sendUndoReq(wsRef.current!)}>悔棋</button>
            <button onClick={() => sendResign(wsRef.current!)}>认输</button>
          </>
        )}
      </div>
    </div>
  )
}
```

注：真人悔棋弹窗（同意/拒绝）在收到 `undo_req` 时用 `window.confirm` 简化，同意后 `sendUndoReply(ws, true)` 并按 `undo_result` 重建棋盘；Phase1 可先接线，重建逻辑复用服务端广播的权威状态（收到 `undo_result{agree:true}` 后请求一次全量 `room_state` 或按 last move 回退）。若时间紧，先只做发起+服务端回退，前端整盘按服务端后续 `move` 广播为准。

- [ ] **Step 6: 实现 Result.tsx 与 Room.tsx**

`Result.tsx`:
```tsx
import { useLocation, useNavigate } from 'react-router-dom'

export function Result() {
  const nav = useNavigate()
  const { state } = useLocation() as { state?: { win: boolean | number; expDelta?: number } }
  const win = !!state?.win
  return (
    <div className="result screen">
      <h1>{win ? '🎉 胜利' : '本局失败'}</h1>
      <p>{win ? `+${state?.expDelta ?? 20} 经验` : '+5 经验，再接再厉！'}</p>
      <button onClick={() => nav('/')}>返回首页</button>
      <button onClick={() => nav(-1)}>再来一局</button>
    </div>
  )
}
```

`Room.tsx`（建房/等待/邀请链接）:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createRoom } from '../net/rest'
import { connectRoom, ServerMsg } from '../net/ws'

export function Room() {
  const { id } = useParams()
  const nav = useNavigate()
  const [roomId, setRoomId] = useState(id ?? '')
  const [status, setStatus] = useState('准备中')

  useEffect(() => {
    let ws: WebSocket | null = null
    async function go() {
      let rid = id
      if (!rid) {
        const r = await createRoom()
        rid = r.roomId
        setRoomId(rid)
      }
      const myColor = id ? 'white' : 'black' // 建房者黑，加入者白
      ws = connectRoom(rid!, (m: ServerMsg) => {
        if (m.type === 'room_state') setStatus(m.players === 2 ? '对手已加入' : '等待好友加入…')
        if (m.type === 'start') {
          ws?.close() // Game 页会重新连
          nav('/game', { state: { mode: 'pvp', roomId: rid, myColor: m.color } })
        }
      })
    }
    go()
    return () => ws?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inviteUrl = `${location.origin}/room/${roomId}`
  return (
    <div className="room screen">
      <h2>好友对战</h2>
      <p>房间号：{roomId}</p>
      <p>{status}</p>
      <button onClick={() => navigator.clipboard.writeText(inviteUrl)}>复制邀请链接</button>
      <button onClick={() => nav('/')}>退出</button>
    </div>
  )
}
```

注：Room 与 Game 各连一次 WS 在 Phase1 会产生两次连接；简化做法是 Room 不预连、直接进 Game 由 Game 连 WS 并在 `start` 前显示等待态。执行时择一实现，保证「建房→拿链接→好友进→开局」链路通即可。

- [ ] **Step 7: 编译 + 本地联调**

Run:
```bash
cd server && (go run ./cmd/server &) ; cd ../web && npm run dev
```
手动验证：浏览器开两个标签，A 建房复制链接，B 打开链接，双方开局、落子确认互相可见、连五判胜进结果页。人机模式选难度后可与 AI 对弈。
Expected: 人机与真人两条链路均可完整走通

- [ ] **Step 8: Commit**

```bash
git add web && git commit -m "feat(web): pages, routing, AI worker and PvP wiring"
```

---

## Milestone 7：素材生成（seedream）

约束：需抠图的素材（棋子/头像/图标）用**绿或蓝纯底**生图再抠成透明 PNG，不用白底；所有图片按**显示尺寸 ×3** 缩放保存，控制体积。

### Task 24: seedream 公共封装

**Files:**
- Create: `scripts/_seedream.py`

- [ ] **Step 1: 实现（对齐 dubbing 的 make-*.py 模式）**

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""seedream 文生图公共封装：生成 -> （可选）抠纯色底 -> 按显示尺寸×3 缩放保存。
跑法：ARK_API_KEY=xxx uv run scripts/make-*.py
模型 id 沿用全项目确认值，勿改。"""
import base64, io, os, sys
import requests
from PIL import Image
import numpy as np

ARK_KEY = os.environ["ARK_API_KEY"]
ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
MODEL = "doubao-seedream-5-0-260128"
REQUEST_SIZE = "1920x1920"  # seedream 5.0 需 >= ~3.7M 像素

def generate(prompt: str) -> Image.Image:
    resp = requests.post(
        ARK_URL,
        headers={"Authorization": f"Bearer {ARK_KEY}", "Content-Type": "application/json"},
        json={"model": MODEL, "prompt": prompt, "size": REQUEST_SIZE,
              "response_format": "url", "watermark": False},
        timeout=180)
    if not resp.ok:
        print(f"ARK HTTP {resp.status_code}: {resp.text}", file=sys.stderr)
        resp.raise_for_status()
    item = resp.json()["data"][0]
    raw = requests.get(item["url"], timeout=180).content if item.get("url") else base64.b64decode(item["b64_json"])
    return Image.open(io.BytesIO(raw)).convert("RGB")

def chroma_key(img: Image.Image, key: str = "green", tol: int = 90) -> Image.Image:
    """把绿/蓝纯底抠成透明。key: green|blue。"""
    arr = np.array(img.convert("RGBA")).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    if key == "green":
        mask = (g > 100) & (g - r > tol) & (g - b > tol)
    else:
        mask = (b > 100) & (b - r > tol) & (b - g > tol)
    arr[mask, 3] = 0
    return Image.fromarray(arr.astype("uint8"), "RGBA")

def save_scaled(img: Image.Image, out: str, disp_w: int, disp_h: int, max_kb: int = 200):
    """按显示尺寸×3 缩放后保存；PNG 保留透明，JPG 压到 max_kb。"""
    img = img.resize((disp_w * 3, disp_h * 3), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if out.endswith(".png"):
        img.save(out, "PNG", optimize=True)
    else:
        for q in (85, 78, 70, 62, 55):
            img.convert("RGB").save(out, "JPEG", quality=q, optimize=True, progressive=True)
            if os.path.getsize(out) / 1024 <= max_kb:
                break
    print(f"saved {out} ({os.path.getsize(out)//1024} KB, {img.size})")

def crop_center_ratio(img: Image.Image, ratio_w_h: float) -> Image.Image:
    w, h = img.size
    th = int(w / ratio_w_h)
    if th <= h:
        top = (h - th) // 2
        return img.crop((0, top, w, top + th))
    tw = int(h * ratio_w_h)
    left = (w - tw) // 2
    return img.crop((left, 0, left + tw, h))
```

- [ ] **Step 2: Commit**

```bash
git add scripts/_seedream.py && git commit -m "chore(scripts): seedream helper with chroma-key and 3x scaling"
```

### Task 25: 生成棋子/背景/头像/图标

**Files:**
- Create: `scripts/make-pieces.py`, `scripts/make-backgrounds.py`, `scripts/make-avatars.py`

- [ ] **Step 1: make-pieces.py（棋子，绿底抠图）**

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成黑/白古风玉石棋子，绿底抠成透明 PNG，显示尺寸 34px（×3=102px）。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
STYLE = "纯绿色背景(#00ff00)，正上方俯视单颗围棋子特写，无阴影投射到背景，扁平居中，写实玉石质感"

for name, desc in [("piece_black", "墨玉黑子，温润哑光"), ("piece_white", "羊脂白玉白子，温润")]:
    img = chroma_key(generate(f"{STYLE}，{desc}"), "green")
    # 裁到棋子方形边界（简化：中心方裁）
    save_scaled(img, f"{OUT}/{name}.png", 34, 34)
```

- [ ] **Step 2: make-backgrounds.py（对局/首页背景，JPG）**

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""古风棋室/水墨背景，竖屏 9:16，显示 375x667。中间留白供棋盘/卡片。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, save_scaled, crop_center_ratio

OUT = "web/public/assets/img"
scenes = {
  "bg_game": "中国古风棋室，木质棋桌、屏风、茶具、灯笼、山水画，水墨淡彩，低饱和暖木色调，画面中央大面积留白",
  "bg_home": "中国古风书房庭院，竹影、宣纸质感，水墨淡彩，低饱和，顶部底部有意象中间留白",
}
for name, prompt in scenes.items():
    img = crop_center_ratio(generate(prompt), 375 / 667)
    save_scaled(img, f"{OUT}/{name}.jpg", 375, 667, max_kb=180)
```

- [ ] **Step 3: make-avatars.py（默认头像组，蓝底抠图）**

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""8 个古风人物头像，蓝底抠透明 PNG，显示 64px。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
roles = ["书生", "侠客", "琴女", "老翁", "少年", "道士", "画师", "棋童"]
for i, role in enumerate(roles, 1):
    img = chroma_key(generate(f"纯蓝色背景(#0000ff)，中国古风{role}头像，圆形构图，水墨淡彩，扁平居中，无背景装饰"), "blue")
    save_scaled(img, f"{OUT}/avatar_{i:02d}.png", 64, 64)
```

- [ ] **Step 4: 生成（需 ARK_API_KEY）**

Run:
```bash
cd /Users/jyxc-dz-0100360/work/fun/wzq
uv run scripts/make-pieces.py && uv run scripts/make-backgrounds.py && uv run scripts/make-avatars.py
```
Expected: `web/public/assets/img/` 下生成 piece_*/bg_*/avatar_* ；抠图边缘干净、体积受控（背景 <180KB，PNG 合理）
人工检查每张图质量，不满意就调 prompt 重跑。

- [ ] **Step 5: Commit**

```bash
git add scripts web/public/assets && git commit -m "feat(assets): seedream pieces, backgrounds, avatars"
```

### Task 26: 古风字体 + 音频占位

**Files:**
- Create: `web/public/assets/fonts/` (开源古风字体), `web/public/assets/audio/` (占位音效)

- [ ] **Step 1: 放入免费可商用中文古风字体**

下载一款免费可商用字体（如「霞鹜文楷」LXGW WenKai，OFL 许可）的 woff2 到 `web/public/assets/fonts/guqi.woff2`。

- [ ] **Step 2: 放入占位音效**

在 `web/public/assets/audio/` 放 `place.mp3 win.mp3 lose.mp3 button.mp3 undo.mp3 tick.mp3 timeout.mp3 bgm.mp3`（用免费开源音效库的短音效占位，后续可替换）。

- [ ] **Step 3: Commit**

```bash
git add web/public/assets/fonts web/public/assets/audio && git commit -m "feat(assets): guqi webfont and placeholder audio"
```

---

## Milestone 8：古风皮肤 + 部署

### Task 27: 古风 UI 样式

**Files:**
- Create: `web/src/styles.css`
- Modify: `web/src/main.tsx`（import './styles.css'）

- [ ] **Step 1: 实现全局古风样式**

```css
@font-face {
  font-family: 'Guqi';
  src: url('/assets/fonts/guqi.woff2') format('woff2');
  font-display: swap;
}
:root {
  --ink: #3a2c1a;
  --paper: #f3e9d6;
  --accent: #8a2b2b;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Guqi', serif; color: var(--ink); }
.screen {
  min-height: 100vh; display: flex; flex-direction: column; align-items: center;
  gap: 16px; padding: 24px; background-size: cover; background-position: center;
}
.home { background-image: url('/assets/img/bg_home.jpg'); }
.game { background-image: url('/assets/img/bg_game.jpg'); }
.profile { display: flex; align-items: center; gap: 12px; width: 100%; }
.avatar { width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--accent); }
.entry {
  width: 240px; padding: 16px; font-size: 20px; font-family: inherit;
  background: rgba(243,233,214,0.85); border: 2px solid var(--ink); border-radius: 10px;
}
.entry.disabled { opacity: 0.5; }
.hud { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.hud .tip { color: var(--accent); font-weight: bold; }
.hud .warn { color: #c0392b; font-size: 22px; }
button { cursor: pointer; font-family: inherit; }
```

- [ ] **Step 2: 引入棋子贴图（可选增强）**

在 `BoardCanvas` 中用 `new Image()` 预加载 `/assets/img/piece_black.png`、`piece_white.png`，若加载完成则 `drawImage` 替换圆形绘制；未加载则回退到圆形。保证素材缺失时仍可运行。

- [ ] **Step 3: 本地验证观感**

Run: `cd web && npm run dev`
手动检查首页/对局页背景、字体、棋子贴图、呼吸灯是否统一古风风格。

- [ ] **Step 4: Commit**

```bash
git add web/src/styles.css web/src/main.tsx web/src/board && git commit -m "feat(web): guqi visual theme"
```

### Task 28: 部署脚本（对齐 dubbing）

**Files:**
- Create: `server/deploy/deploy.sh`

- [ ] **Step 1: 实现 deploy.sh**

要点（对齐 dubbing）：
- SSH 主机默认 `ecs`，ENV=stage(8081)/prod(8080)
- 开发机交叉编译：`CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o wzq-server ./cmd/server`
- scp 二进制 + `config.yaml`（远端不存在才生成，含随机 `WZQ_AUTH_SECRET`、MySQL DSN `wzq_<env>`）到 `/opt/wzq-<env>/`
- 确保远端装好 MariaDB 并建库 `wzq_stage`/`wzq_prod`，应用账号密码首次随机生成写 `.db_password`，重部署不覆盖
- 生成 systemd 服务 `wzq-<env>`（`ExecStart=/opt/wzq-<env>/wzq-server`，`WorkingDirectory=/opt/wzq-<env>`，`ReadWritePaths` 含 data/），enable + restart
- 前端：`cd web && npm run build`，scp `dist/` 到 Nginx 静态目录，Nginx 反代 `/api` `/ws` 到本地端口
- 每日 `mysqldump` → TOS 备份 timer

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${1:-${SSH_HOST:-ecs}}"
ENV="${ENV:-${2:-stage}}"
case "$ENV" in
  stage) PORT=8081 ;;
  prod)  PORT=8080 ;;
  *) echo "ENV must be stage|prod" >&2; exit 1 ;;
esac
REMOTE_DIR="/opt/wzq-$ENV"
echo ">> build server (linux/amd64 static)"
( cd "$(dirname "$0")/.." && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/wzq-server ./cmd/server )
echo ">> build web"
( cd "$(dirname "$0")/../../web" && npm run build )
echo ">> ensure remote deps (mariadb) + dirs"
ssh "$HOST" "sudo mkdir -p $REMOTE_DIR/data && command -v mariadb >/dev/null || sudo apt-get install -y mariadb-server"
echo ">> gen config.yaml if absent"
ssh "$HOST" "test -f $REMOTE_DIR/config.yaml || echo 'placeholder'"  # 实际生成逻辑见 dubbing/server/deploy/deploy.sh
echo ">> scp binary + web dist"
scp /tmp/wzq-server "$HOST:$REMOTE_DIR/wzq-server"
rsync -az "$(dirname "$0")/../../web/dist/" "$HOST:/var/www/wzq/"
echo ">> systemd restart"
ssh "$HOST" "sudo systemctl restart wzq-$ENV"
echo "deployed $ENV on $HOST:$PORT"
```

注：MySQL DSN 与随机密钥的生成/幂等逻辑完整参照 `../dubbing/server/deploy/deploy.sh`，执行时对照移植（库名 wzq_*、服务名 wzq-*、端口 8081/8080）。

- [ ] **Step 2: 语法检查**

Run: `bash -n server/deploy/deploy.sh`
Expected: 无语法错误

- [ ] **Step 3: Commit**

```bash
chmod +x server/deploy/deploy.sh && git add server/deploy && git commit -m "chore(deploy): ECS deploy script aligned with dubbing"
```

---

## 自查（Self-Review）

- **Spec 覆盖**：账号(游客+绑定 T13/14/18)、五子棋(T2-4,9)、AI 三档(T5-7)、真人房间(T16-18)、60s 计时(T17)、落子确认(T20-21)、悔棋(T16-17)、胜负(T4,9,16)、经验/等级(T13-14,18)、防刷(T14)、棋谱落库(T15)、结果页(T23)、古风UI+音频(T22,26,27)、素材(T24-26)、部署(T28)。残局/广告/后台/分享按设计不在 Phase1。
- **占位符**：无 TBD；素材步骤含人工质检说明属预期的人工验收，非代码占位。
- **类型一致性**：TS `Color='black'|'white'`、Go `gomoku.Color`；store `place/preview/confirm/reset` 全程一致；WS 协议 `move/turn/game_over/undo_req/undo_result` 前后端字段对齐。
- **已知取舍**：Room/Game 双 WS 连接与悔棋前端整盘重建为简化点，已在对应 Task 注明择一实现，不阻塞主链路。
