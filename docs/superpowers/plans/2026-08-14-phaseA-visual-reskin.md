# 阶段 A：视觉换肤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把主页 / 对局页 / 胜负弹窗 / 段位进阶界面按参考图换肤，段位与金币/卷轴先占位展示，不接后端。

**Architecture:** 新增一批展示型 React 组件（对阵条、罗盘倒计时、开局倒计时、木牌横幅、头像、底部菜单、结算/段位进阶覆盖层）与两个纯函数模块（段位名镜像、倒计时状态），改造 `Home.tsx`/`Game.tsx` 接入；用 seedream 脚本重生成背景并新增 UI 素材；`themes.ts`/`BoardCanvas.tsx` 增强棋盘立体底座与棋子高光。纯逻辑走 TDD，纯视觉给实现要点 + 浏览器手动验收。

**Tech Stack:** React 19 + TS + Vite；Zustand；Canvas/SVG；vitest + @testing-library/react（jsdom）；seedream 文生图（uv + pillow）。

**参考设计书:** `docs/superpowers/specs/2026-08-14-guofeng-gomoku-reskin-design.md`（§7 画面、§8 素材）。

**阶段 A 占位约定:** 段位标签、段位进度、金币/卷轴数值一律前端静态占位（或由现有 `me()` 的 `level/exp` 粗略映射），组件通过 props 接收，B/C 阶段再接真实数据。看广告双倍/分享/商店入口做出按钮与视觉，点击暂为 `console.log` 或 `alert` 占位。

---

## 文件结构

**新增：**
- `web/src/theme/ranks.ts` — 段位阶梯镜像 + `rankLabel(tier)`、`rankGroup(tier)`（纯函数）
- `web/src/theme/ranks.test.ts`
- `web/src/lib/countdown.ts` — `countdownState(deadlineMs, nowMs)` 纯函数
- `web/src/lib/countdown.test.ts`
- `web/src/components/Banner.tsx` — 木牌横幅（胜利/失败/段位进阶等复用），毛笔字 + 金/银渐变
- `web/src/components/Avatar.tsx` — 头像 + 外框容器（阶段 A 只默认框，预留 `frame` prop）
- `web/src/components/PlayerBar.tsx` — 对局顶部对阵条（左右玩家 + 中间罗盘）
- `web/src/components/CompassTimer.tsx` — 罗盘倒计时圆盘（SVG）
- `web/src/components/StartCountdown.tsx` — 3-2-1 开局倒计时覆盖层
- `web/src/components/StartCountdown.test.tsx`
- `web/src/components/GameMenu.tsx` — 底部菜单/设置木牌按钮 + 菜单聚合
- `web/src/components/GameMenu.test.tsx`
- `web/src/components/ResultOverlay.tsx` — 胜利/失败结算视觉（占位数据）
- `web/src/components/RankUpOverlay.tsx` — 段位进阶界面（占位数据）
- `scripts/make-ui-assets.py` — 生成 logo/横幅底/奖章/货币图标（透明 PNG）

**修改：**
- `scripts/make-backgrounds.py` — bg_home 改绿色水墨(参考图7)、bg_game 改蓝调水墨(参考图8)
- `web/src/pages/Home.tsx` — 换肤 + 段位/货币占位条 + 商店/签到/转盘入口占位
- `web/src/pages/Game.tsx` — 接入 PlayerBar/CompassTimer/StartCountdown/GameMenu；结算改用 ResultOverlay/RankUpOverlay
- `web/src/board/themes.ts` — 新增 `gold` 主题 + 立体底座参数
- `web/src/board/BoardCanvas.tsx` — 棋盘底部立体底座 + 棋子金色高光增强
- `web/src/styles.css` — 新增各组件类

**验证命令：**
- 单测：`cd web && npx vitest run`
- 类型/构建：`cd web && npm run build`
- 手动：`cd web && npm run dev`，浏览器逐屏走查

---

## Task 1: 段位名镜像纯函数 `ranks.ts`

**Files:**
- Create: `web/src/theme/ranks.ts`
- Test: `web/src/theme/ranks.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// web/src/theme/ranks.test.ts
import { describe, it, expect } from 'vitest'
import { rankLabel, rankGroup, RANK_COUNT } from './ranks'

describe('ranks 镜像', () => {
  it('19 阶总数', () => {
    expect(RANK_COUNT).toBe(19)
  })
  it('业余级：索引 0..8 -> 业余1级..业余9级', () => {
    expect(rankLabel(0)).toBe('业余1级')
    expect(rankLabel(8)).toBe('业余9级')
  })
  it('业余段：索引 9..17 -> 业余1段..业余9段', () => {
    expect(rankLabel(9)).toBe('业余1段')
    expect(rankLabel(17)).toBe('业余9段')
  })
  it('索引 18 -> 大师', () => {
    expect(rankLabel(18)).toBe('大师')
  })
  it('越界夹紧', () => {
    expect(rankLabel(-5)).toBe('业余1级')
    expect(rankLabel(999)).toBe('大师')
  })
  it('rankGroup 分档用于选奖章素材', () => {
    expect(rankGroup(0)).toBe('ji')
    expect(rankGroup(9)).toBe('duan')
    expect(rankGroup(18)).toBe('master')
  })
})
```

- [ ] **Step 2: 运行验证失败**

Run: `cd web && npx vitest run src/theme/ranks.test.ts`
Expected: FAIL（模块不存在 / 未导出）

- [ ] **Step 3: 实现**

```ts
// web/src/theme/ranks.ts
// 段位阶梯「展示用镜像」：与后端 internal/rank 的阶名保持一致（阶段 B 落地权威计算）。
// 索引 0..8 业余1级..业余9级；9..17 业余1段..业余9段；18 大师。共 19 阶。
export const RANK_COUNT = 19

// 夹紧到合法索引，避免越界。
function clampTier(tier: number): number {
  if (tier < 0) return 0
  if (tier > RANK_COUNT - 1) return RANK_COUNT - 1
  return Math.floor(tier)
}

// 段位中文名。
export function rankLabel(tier: number): string {
  const t = clampTier(tier)
  if (t === 18) return '大师'
  if (t < 9) return `业余${t + 1}级`
  return `业余${t - 9 + 1}段`
}

// 段位分档（选奖章素材用）：ji=业余级，duan=业余段，master=大师。
export function rankGroup(tier: number): 'ji' | 'duan' | 'master' {
  const t = clampTier(tier)
  if (t === 18) return 'master'
  return t < 9 ? 'ji' : 'duan'
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd web && npx vitest run src/theme/ranks.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 提交**

```bash
git add web/src/theme/ranks.ts web/src/theme/ranks.test.ts
git commit -m "feat(web): 段位名展示镜像 rankLabel/rankGroup (阶段A)"
```

---

## Task 2: 倒计时状态纯函数 `countdown.ts` 并替换 Game 内联计算

**Files:**
- Create: `web/src/lib/countdown.ts`
- Test: `web/src/lib/countdown.test.ts`
- Modify: `web/src/pages/Game.tsx`（倒计时 effect 使用该函数）

- [ ] **Step 1: 写失败测试**

```ts
// web/src/lib/countdown.test.ts
import { describe, it, expect } from 'vitest'
import { countdownState } from './countdown'

describe('countdownState', () => {
  it('剩余秒四舍五入到 0..total', () => {
    const now = 1_000_000
    expect(countdownState(now + 30_000, now, 30).remain).toBe(30)
    expect(countdownState(now + 4_400, now, 30).remain).toBe(4)
  })
  it('归零不为负', () => {
    const now = 1_000_000
    expect(countdownState(now - 5_000, now, 30).remain).toBe(0)
  })
  it('分级：>10 normal，(5,10] warn，(0,5] danger', () => {
    const now = 0
    expect(countdownState(20_000, now, 30).level).toBe('normal')
    expect(countdownState(8_000, now, 30).level).toBe('warn')
    expect(countdownState(3_000, now, 30).level).toBe('danger')
  })
  it('progress 为剩余比例 0..1', () => {
    const now = 0
    expect(countdownState(15_000, now, 30).progress).toBeCloseTo(0.5, 2)
  })
})
```

- [ ] **Step 2: 运行验证失败**

Run: `cd web && npx vitest run src/lib/countdown.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// web/src/lib/countdown.ts
// 回合倒计时的纯计算：由截止时刻与当前时刻算出剩余秒、紧迫等级、进度比例。
// 供 Game 计时 effect 与 CompassTimer 罗盘共用，避免各处重复取整/分级逻辑。
export type CountdownLevel = 'normal' | 'warn' | 'danger'

export interface CountdownState {
  remain: number // 剩余整秒，0..total
  level: CountdownLevel // >10 normal；(5,10] warn；(0,5] danger（0 归 danger）
  progress: number // 剩余比例 0..1，用于罗盘弧
}

export function countdownState(deadlineMs: number, nowMs: number, total = 30): CountdownState {
  const remain = Math.max(0, Math.min(total, Math.round((deadlineMs - nowMs) / 1000)))
  const level: CountdownLevel = remain > 10 ? 'normal' : remain > 5 ? 'warn' : 'danger'
  const progress = total > 0 ? remain / total : 0
  return { remain, level, progress }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd web && npx vitest run src/lib/countdown.test.ts`
Expected: PASS

- [ ] **Step 5: 接入 Game.tsx 倒计时 effect**

在 `web/src/pages/Game.tsx` 顶部加导入：

```ts
import { countdownState } from '../lib/countdown'
```

把原倒计时 `setInterval` 里的剩余秒计算替换为该函数（保留原有 tick 音效与超时结算逻辑）。定位 `web/src/pages/Game.tsx` 现有片段：

```ts
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemain(s)
      if (s <= 5 && s > 0) playSfx('tick')
```

改为：

```ts
    const t = setInterval(() => {
      const { remain: s } = countdownState(deadline, Date.now(), 30)
      setRemain(s)
      if (s <= 5 && s > 0) playSfx('tick')
```

- [ ] **Step 6: 运行全部单测 + 构建**

Run: `cd web && npx vitest run && npm run build`
Expected: 全绿；构建成功

- [ ] **Step 7: 提交**

```bash
git add web/src/lib/countdown.ts web/src/lib/countdown.test.ts web/src/pages/Game.tsx
git commit -m "feat(web): 倒计时状态纯函数并接入 Game (阶段A)"
```

---

## Task 3: 重生成背景素材（bg_home 绿色水墨 / bg_game 蓝调）

**Files:**
- Modify: `scripts/make-backgrounds.py`
- 产物：`web/public/assets/img/bg_home.jpg`、`web/public/assets/img/bg_game.jpg`

> 纯视觉素材，验收靠人工看图，prompt 可能需迭代 1–3 次。ARK_API_KEY 已在环境中。

- [ ] **Step 1: 更新 prompt**

把 `scripts/make-backgrounds.py` 的 `scenes` 改为（贴合参考图7绿色水墨主页 / 参考图8蓝调对局）：

```python
scenes = {
  "bg_home": "中国古风水墨山水，青绿色调，远山云雾、江面小舟、飞鸟，宣纸质感，顶部与底部有山水意象，画面中央大面积留白供标题与按钮，低饱和淡彩",
  "bg_game": "中国古风水墨背景，青蓝色调，淡云与远山，宣纸质感，低饱和，画面中央大面积留白供棋盘",
}
```

- [ ] **Step 2: 运行生成**

Run: `ARK_API_KEY=$ARK_API_KEY uv run scripts/make-backgrounds.py`
Expected: 打印 `saved .../bg_home.jpg` 与 `bg_game.jpg`（各 ≤180KB）

- [ ] **Step 3: 人工验收**

Run: `cd web && npm run dev`，浏览器打开首页与对局页。
验收：主页背景为青绿水墨、中部留白足够放标题/按钮不糊；对局页背景青蓝、棋盘区留白干净。若不满意，微调 prompt 重跑 Step 2。

- [ ] **Step 4: 提交**

```bash
git add scripts/make-backgrounds.py web/public/assets/img/bg_home.jpg web/public/assets/img/bg_game.jpg
git commit -m "assets: 绿色水墨主页背景 + 蓝调对局背景 (阶段A)"
```

---

## Task 4: 生成 UI 素材（LOGO / 木牌横幅底 / 段位奖章 / 货币图标）

**Files:**
- Create: `scripts/make-ui-assets.py`
- 产物：`web/public/assets/img/` 下 `logo_title.png`、`banner_wood.png`、`medal_ji.png`、`medal_duan.png`、`medal_master.png`、`icon_coin.png`、`icon_scroll.png`

> 透明 PNG 用绿底抠图（`chroma_key`）。验收靠人工看图。

- [ ] **Step 1: 写生成脚本**

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成古风 UI 素材：标题 LOGO / 木牌横幅底 / 段位奖章 / 货币图标。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，扁平居中，无投影到背景"

items = [
    # (文件名, 显示宽, 显示高, 提示)
    ("logo_title", 220, 96, f"{GREEN}，毛笔书法「五子棋」三个大字，青绿描金，古风"),
    ("banner_wood", 240, 72, f"{GREEN}，古风木质横匾牌匾，空白无字，两端有雕花卷角，暖棕木色"),
    ("medal_ji", 96, 96, f"{GREEN}，古风圆形奖章徽章，青铜色莲花纹，无文字"),
    ("medal_duan", 96, 96, f"{GREEN}，古风圆形奖章徽章，白银色云纹，无文字"),
    ("medal_master", 96, 96, f"{GREEN}，古风圆形奖章徽章，金色玉石祥云，无文字，华贵"),
    ("icon_coin", 40, 40, f"{GREEN}，古风金色铜钱金币图标，正面俯视，单枚"),
    ("icon_scroll", 40, 40, f"{GREEN}，古风红色卷轴书卷图标，单个"),
]
for name, w, h, prompt in items:
    img = chroma_key(generate(prompt), "green")
    save_scaled(img, f"{OUT}/{name}.png", w, h)
```

- [ ] **Step 2: 运行生成**

Run: `ARK_API_KEY=$ARK_API_KEY uv run scripts/make-ui-assets.py`
Expected: 打印 7 个 `saved .../*.png`

- [ ] **Step 3: 人工验收**

用 Read 工具或图片查看器逐个查看 7 张 PNG：抠图边缘干净、主体居中、无绿边残留。若某张不佳，微调该项 prompt 重跑。

- [ ] **Step 4: 提交**

```bash
git add scripts/make-ui-assets.py web/public/assets/img/logo_title.png web/public/assets/img/banner_wood.png web/public/assets/img/medal_ji.png web/public/assets/img/medal_duan.png web/public/assets/img/medal_master.png web/public/assets/img/icon_coin.png web/public/assets/img/icon_scroll.png
git commit -m "assets: 生成 LOGO/木牌横幅/段位奖章/货币图标 (阶段A)"
```

---

## Task 5: 通用组件 Banner + Avatar（含 CSS）

**Files:**
- Create: `web/src/components/Banner.tsx`、`web/src/components/Avatar.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Banner 组件**

```tsx
// web/src/components/Banner.tsx
// 木牌横幅：木匾底图 + 毛笔字（guqi 字体），tone 控制金/银/墨渐变。
// 复用于 胜利/失败/段位进阶/商店/签到/转盘 等标题。
export type BannerTone = 'gold' | 'silver' | 'ink'

export function Banner({ text, tone = 'gold' }: { text: string; tone?: BannerTone }) {
  return (
    <div className={`banner banner-${tone}`}>
      <span className="banner-text">{text}</span>
    </div>
  )
}
```

- [ ] **Step 2: Avatar 组件**

```tsx
// web/src/components/Avatar.tsx
// 头像 + 外框容器。阶段 A 只用默认框；frame 预留给阶段 C 的头像框皮肤。
export function Avatar({
  src,
  size = 56,
  frame = 'none',
}: {
  src: string
  size?: number
  frame?: string
}) {
  return (
    <div className={`avatar-box frame-${frame}`} style={{ width: size, height: size }}>
      <img src={src} alt="" className="avatar-img" />
    </div>
  )
}
```

- [ ] **Step 3: 追加 CSS**

在 `web/src/styles.css` 末尾追加：

```css
/* 木牌横幅：木匾底图上叠毛笔字，tone 控制字色渐变。 */
.banner {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  height: 64px;
  padding: 0 40px;
  background: url('/assets/img/banner_wood.png') center/100% 100% no-repeat;
}
.banner-text {
  font-family: 'Guqi', 'STKaiti', serif;
  font-size: 34px;
  letter-spacing: 4px;
  font-weight: 700;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-stroke: 0.5px rgba(60, 40, 10, 0.5);
  filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.35));
}
.banner-gold .banner-text {
  background-image: linear-gradient(180deg, #fff2b0, #f5c542 45%, #b8791b);
}
.banner-silver .banner-text {
  background-image: linear-gradient(180deg, #ffffff, #d8dde3 45%, #9aa3ad);
}
.banner-ink .banner-text {
  background-image: linear-gradient(180deg, #6b7280, #2a2f36 60%, #14171b);
}

/* 头像框容器。阶段 A frame-none 为素圆框，frame-* 阶段 C 叠环形贴图。 */
.avatar-box {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--gold);
  background: var(--paper);
  flex: none;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 4: 冒烟测试（渲染不崩 + 文案）**

```tsx
// web/src/components/Banner.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Banner } from './Banner'

describe('Banner', () => {
  it('渲染文案且带 tone 类', () => {
    const { container } = render(<Banner text="胜利" tone="gold" />)
    expect(screen.getByText('胜利')).toBeTruthy()
    expect(container.querySelector('.banner-gold')).toBeTruthy()
  })
})
```

Run: `cd web && npx vitest run src/components/Banner.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/components/Banner.tsx web/src/components/Banner.test.tsx web/src/components/Avatar.tsx web/src/styles.css
git commit -m "feat(web): 通用木牌横幅 Banner + 头像框 Avatar 组件 (阶段A)"
```

---

## Task 6: 主页换肤

**Files:**
- Modify: `web/src/pages/Home.tsx`、`web/src/styles.css`

> 视觉为主：LOGO、货币占位条、古风入口按钮、新增 商店/签到/转盘 入口占位。段位标签由 `rankLabel` 展示，占位 tier 由 `level` 粗映射。

- [ ] **Step 1: 改写 Home.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, matchJoin } from '../net/rest'
import type { User } from '../net/rest'
import { rankLabel } from '../theme/ranks'
import { Avatar } from '../components/Avatar'

// 首页：LOGO + 资料/货币占位条 + 对战入口 + 运营入口（商店/签到/转盘占位）。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  const [u, setU] = useState<User>(user)
  useEffect(() => {
    me().then(setU).catch(() => {})
  }, [])
  // 阶段 A 占位：用 level 粗映射一个段位索引展示（B 阶段接真实 rank_tier）。
  const placeholderTier = Math.min(18, (u.level ?? 1) - 1)
  return (
    <div className="home screen">
      <img src="/assets/img/logo_title.png" alt="五子棋" className="home-logo" />
      <header className="profile">
        <Avatar src={`/assets/img/${u.avatar}.png`} size={60} />
        <div>
          <div className="nick">{u.nickname}</div>
          <div className="rank-tag">{rankLabel(placeholderTier)}</div>
        </div>
        <div className="currency">
          <span className="coin"><img src="/assets/img/icon_coin.png" alt="金币" />0</span>
          <span className="scroll"><img src="/assets/img/icon_scroll.png" alt="卷轴" />0</span>
        </div>
        <button className="settings-btn" onClick={() => nav('/settings')}>⚙️</button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>人机对战</button>
        <button
          className="entry primary"
          onClick={() =>
            matchJoin()
              .then((r) => nav('/game', { state: { mode: 'pvp', roomId: r.roomId } }))
              .catch(() => {})
          }
        >随机匹配</button>
        <button className="entry" onClick={() => nav('/room')}>好友对战</button>
        <button className="entry" onClick={() => nav('/endgame')}>残局闯关</button>
        <button className="entry" onClick={() => nav('/stats')}>我的战绩</button>
      </main>
      <nav className="ops-row">
        <button className="op-btn" onClick={() => alert('商店（阶段C）')}>商店</button>
        <button className="op-btn" onClick={() => alert('每日签到（阶段D）')}>签到</button>
        <button className="op-btn" onClick={() => alert('幸运转盘（阶段D）')}>转盘</button>
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: 追加 CSS**

在 `web/src/styles.css` 追加：

```css
.home-logo {
  width: min(60vw, 240px);
  height: auto;
  margin: 8px auto 0;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
}
.profile .rank-tag {
  color: var(--accent);
  font-size: 15px;
  font-weight: 700;
}
.profile .currency {
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: center;
}
.profile .currency span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: var(--ink);
}
.profile .currency img {
  width: 20px;
  height: 20px;
}
.ops-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.op-btn {
  padding: 10px 20px;
  font-size: 17px;
  border-radius: 12px;
}
```

> 注意：`.profile .settings-btn { margin-left: auto }` 与新加的 `.currency { margin-left: auto }` 冲突，需把 `settings-btn` 的 `margin-left:auto` 去掉（货币条已占据右侧）。定位 `web/src/styles.css` 中 `.profile .settings-btn` 规则，删除其 `margin-left: auto;` 行。

- [ ] **Step 3: 类型检查 + 手动验收**

Run: `cd web && npm run build`
Expected: 构建成功。
Run: `cd web && npm run dev`，首页应显示：顶部 LOGO、资料条（头像+昵称+段位标签+金币/卷轴占位）、五个对战入口、底部商店/签到/转盘三钮。

- [ ] **Step 4: 提交**

```bash
git add web/src/pages/Home.tsx web/src/styles.css
git commit -m "feat(web): 主页换肤（LOGO/段位标签/货币占位/运营入口） (阶段A)"
```

---

## Task 7: 对阵条 PlayerBar + 罗盘倒计时 CompassTimer

**Files:**
- Create: `web/src/components/CompassTimer.tsx`、`web/src/components/PlayerBar.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: CompassTimer（SVG 罗盘）**

```tsx
// web/src/components/CompassTimer.tsx
// 罗盘倒计时：圆盘中央显示剩余秒，外圈弧随剩余比例收缩；level 控制颜色。
// 纯展示，remain/progress/level 由父组件用 countdownState 计算后传入。
import type { CountdownLevel } from '../lib/countdown'

export function CompassTimer({
  remain,
  progress,
  level,
}: {
  remain: number
  progress: number
  level: CountdownLevel
}) {
  const R = 26
  const C = 2 * Math.PI * R
  const color = level === 'danger' ? '#c0392b' : level === 'warn' ? '#d97706' : '#c8912f'
  return (
    <div className={`compass compass-${level}`}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="rgba(58,44,26,0.85)" stroke="#c8912f" strokeWidth="3" />
        <circle
          cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
          transform="rotate(-90 32 32)" strokeLinecap="round"
        />
        <text x="32" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="#f6ecd8">
          {remain}
        </text>
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: PlayerBar（左右玩家 + 中间罗盘）**

```tsx
// web/src/components/PlayerBar.tsx
// 对局顶部对阵条：左右玩家（头像/昵称/段位/执子色），中间罗盘倒计时，▶ 指向当前手。
import { Avatar } from './Avatar'
import { CompassTimer } from './CompassTimer'
import type { CountdownLevel } from '../lib/countdown'

export interface PlayerInfo {
  nickname: string
  avatar: string // 图片文件名（不含扩展）
  rankLabel: string
  color: 'black' | 'white'
}

export function PlayerBar({
  me,
  opp,
  turn,
  timer,
}: {
  me: PlayerInfo
  opp: PlayerInfo
  turn: 'black' | 'white'
  timer: { remain: number; progress: number; level: CountdownLevel } | null
}) {
  return (
    <div className="player-bar">
      <PlayerSide p={me} active={turn === me.color} side="left" />
      <div className="player-bar-center">
        {turn === me.color ? <span className="turn-arrow">◀</span> : <span className="turn-arrow">▶</span>}
        {timer ? <CompassTimer {...timer} /> : <div className="compass-idle" />}
      </div>
      <PlayerSide p={opp} active={turn === opp.color} side="right" />
    </div>
  )
}

function PlayerSide({ p, active, side }: { p: PlayerInfo; active: boolean; side: 'left' | 'right' }) {
  return (
    <div className={`player-side ${side} ${active ? 'active' : ''}`}>
      <Avatar src={`/assets/img/${p.avatar}.png`} size={48} />
      <div className="player-meta">
        <div className="player-nick">{p.nickname}</div>
        <div className="player-rank">{p.rankLabel}</div>
      </div>
      <span className={`stone-chip ${p.color}`} />
    </div>
  )
}
```

- [ ] **Step 3: 追加 CSS**

```css
.player-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  max-width: min(94vw, 560px);
}
.player-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  background: var(--panel);
  border: 1.5px solid var(--ink);
  border-radius: 12px;
  padding: 6px 10px;
  box-shadow: var(--shadow);
}
.player-side.right {
  flex-direction: row-reverse;
}
.player-side.active {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(200, 145, 47, 0.5), var(--shadow);
}
.player-meta { min-width: 0; }
.player-nick { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px; }
.player-rank { font-size: 12px; color: var(--accent); }
.stone-chip { width: 16px; height: 16px; border-radius: 50%; flex: none; }
.stone-chip.black { background: radial-gradient(circle at 35% 35%, #555, #111); }
.stone-chip.white { background: radial-gradient(circle at 35% 35%, #fff, #cfc7b5); border: 1px solid #b3ada1; }
.player-bar-center { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: none; }
.turn-arrow { font-size: 14px; color: var(--gold); }
.compass-idle { width: 64px; height: 64px; }
```

- [ ] **Step 4: 冒烟测试**

```tsx
// web/src/components/PlayerBar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerBar } from './PlayerBar'

const p = (nickname: string, color: 'black' | 'white') => ({
  nickname, avatar: 'avatar_01', rankLabel: '业余2级', color,
})

describe('PlayerBar', () => {
  it('渲染双方昵称与段位，激活方高亮', () => {
    const { container } = render(
      <PlayerBar me={p('我', 'black')} opp={p('对手', 'white')} turn="black"
        timer={{ remain: 30, progress: 1, level: 'normal' }} />,
    )
    expect(screen.getByText('我')).toBeTruthy()
    expect(screen.getByText('对手')).toBeTruthy()
    expect(container.querySelectorAll('.player-rank').length).toBe(2)
    expect(container.querySelector('.player-side.left.active')).toBeTruthy()
  })
})
```

Run: `cd web && npx vitest run src/components/PlayerBar.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/components/CompassTimer.tsx web/src/components/PlayerBar.tsx web/src/components/PlayerBar.test.tsx web/src/styles.css
git commit -m "feat(web): 对阵条 PlayerBar + 罗盘倒计时 CompassTimer (阶段A)"
```

---

## Task 8: 3-2-1 开局倒计时 StartCountdown 并接入 Game

**Files:**
- Create: `web/src/components/StartCountdown.tsx`、`web/src/components/StartCountdown.test.tsx`
- Modify: `web/src/pages/Game.tsx`

- [ ] **Step 1: 写失败测试（fake timers 驱动 3→2→1→完成）**

```tsx
// web/src/components/StartCountdown.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { StartCountdown } from './StartCountdown'

describe('StartCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('依次显示 3,2,1 后触发 onDone', () => {
    const onDone = vi.fn()
    render(<StartCountdown onDone={onDone} />)
    expect(screen.getByText('3')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('2')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('1')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行验证失败**

Run: `cd web && npx vitest run src/components/StartCountdown.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

```tsx
// web/src/components/StartCountdown.tsx
// 开局 3-2-1 倒计时覆盖层：金色毛笔数字依次跳动，结束回调 onDone。
import { useEffect, useState } from 'react'

export function StartCountdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    if (n <= 0) {
      onDone()
      return
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [n, onDone])
  if (n <= 0) return null
  return (
    <div className="start-countdown">
      <span key={n} className="start-num">{n}</span>
    </div>
  )
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd web && npx vitest run src/components/StartCountdown.test.tsx`
Expected: PASS

- [ ] **Step 5: 追加 CSS**

```css
.start-countdown {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.start-num {
  font-family: 'Guqi', 'STKaiti', serif;
  font-size: 140px;
  font-weight: 700;
  background-image: linear-gradient(180deg, #fff2b0, #f5c542 45%, #b8791b);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(60, 40, 10, 0.5);
  filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.4));
  animation: start-pop 1s ease;
}
@keyframes start-pop {
  0% { transform: scale(0.4); opacity: 0; }
  30% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0.85; }
}
```

- [ ] **Step 6: 接入 Game.tsx**

在 `Game.tsx` 顶部导入：

```ts
import { StartCountdown } from '../components/StartCountdown'
```

新增状态门：开局倒计时进行中禁止落子。在组件内加：

```ts
// 开局 3-2-1 倒计时期间禁止落子（started 后才开始）。
const [introDone, setIntroDone] = useState(false)
```

把 `BoardCanvas` 的 `interactive` 改为同时要求 introDone：

```tsx
        interactive={!previewSteps && introDone}
```

在 `return` 的棋盘容器（`.game screen` 内、`BoardCanvas` 之后）加覆盖层（仅对局开始且尚未倒完时）：

```tsx
      {started && !introDone && <StartCountdown onDone={() => setIntroDone(true)} />}
```

> 说明：`.game.screen` 已是 `position: relative`（`.screen` 定义），覆盖层 `position:absolute; inset:0` 即铺满该屏。

- [ ] **Step 7: 全测 + 构建 + 手动验收**

Run: `cd web && npx vitest run && npm run build`
Expected: 全绿；构建成功。
手动：进入人机对局，开局出现 3→2→1 金字，倒完才能落子。

- [ ] **Step 8: 提交**

```bash
git add web/src/components/StartCountdown.tsx web/src/components/StartCountdown.test.tsx web/src/pages/Game.tsx web/src/styles.css
git commit -m "feat(web): 开局 3-2-1 倒计时并门控落子 (阶段A)"
```

---

## Task 9: 底部菜单/设置木牌按钮 GameMenu

**Files:**
- Create: `web/src/components/GameMenu.tsx`、`web/src/components/GameMenu.test.tsx`
- Modify: `web/src/pages/Game.tsx`、`web/src/styles.css`

> 把原 HUD 里的 提示/预演/悔棋/认输 聚合进「菜单」弹层；「设置」跳设置页。按钮做成圆形木牌。

- [ ] **Step 1: 写失败测试（点击菜单展开动作项）**

```tsx
// web/src/components/GameMenu.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameMenu } from './GameMenu'

describe('GameMenu', () => {
  it('点击菜单展开动作项，点动作触发回调并收起', () => {
    const onHint = vi.fn()
    render(
      <GameMenu
        actions={[{ label: '提示', onClick: onHint }]}
        onSettings={() => {}}
      />,
    )
    // 初始未展开
    expect(screen.queryByText('提示')).toBeNull()
    fireEvent.click(screen.getByText('菜单'))
    fireEvent.click(screen.getByText('提示'))
    expect(onHint).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('提示')).toBeNull() // 点后收起
  })
})
```

- [ ] **Step 2: 运行验证失败**

Run: `cd web && npx vitest run src/components/GameMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

```tsx
// web/src/components/GameMenu.tsx
// 底部操作条：圆形木牌「菜单」（展开 提示/预演/悔棋/认输 等动作）与「设置」。
import { useState } from 'react'

export interface MenuAction {
  label: string
  onClick: () => void
}

export function GameMenu({
  actions,
  onSettings,
}: {
  actions: MenuAction[]
  onSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="game-menu">
      <button className="wood-btn" onClick={() => setOpen((v) => !v)}>菜单</button>
      <button className="wood-btn" onClick={onSettings}>设置</button>
      {open && (
        <div className="game-menu-pop">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                a.onClick()
                setOpen(false)
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd web && npx vitest run src/components/GameMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: 追加 CSS**

```css
.game-menu {
  position: relative;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
}
.wood-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #d9a86a, #a86b32 70%, #7c4a1e);
  border: 2px solid #5c3a17;
  color: #3a240f;
  font-size: 18px;
  font-weight: 700;
  box-shadow: var(--shadow);
}
.game-menu-pop {
  position: absolute;
  bottom: 76px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  background: var(--panel);
  border: 1.5px solid var(--ink);
  border-radius: 12px;
  padding: 10px;
  box-shadow: var(--shadow);
  width: max-content;
  max-width: 90vw;
}
```

- [ ] **Step 6: 接入 Game.tsx（替换原 HUD 操作按钮）**

导入：

```ts
import { GameMenu } from '../components/GameMenu'
```

在 `Game.tsx` 的 `return` 中，把原 `.hud` 里 提示/预演/悔棋/认输 那组按钮替换为 `GameMenu`，按当前模式与状态拼装 `actions`（保留原有 `onHint`/`onPreview`/`endPreview`/`sendUndoReq`/`onResign` 逻辑）：

```tsx
      <GameMenu
        onSettings={() => nav('/settings')}
        actions={[
          ...(st.mode === 'ai' && !previewSteps
            ? [{ label: '提示', onClick: onHint }, { label: '预演', onClick: onPreview }]
            : []),
          ...(previewSteps ? [{ label: '结束预演', onClick: endPreview }] : []),
          ...(st.mode === 'pvp' && wsRef.current && !previewSteps
            ? [{ label: '悔棋', onClick: () => sendUndoReq(wsRef.current!) }]
            : []),
          ...(!previewSteps ? [{ label: '认输', onClick: onResign }] : []),
        ]}
      />
```

> 轮次提示「轮到你落子/对方思考中」与倒计时已移到 PlayerBar（Task 7/10），原 `.hud` 内这些可删除或保留一行文字提示，避免与顶部重复。

- [ ] **Step 7: 全测 + 构建 + 手动验收**

Run: `cd web && npx vitest run && npm run build`
Expected: 全绿；构建成功。
手动：对局底部两个圆木牌，菜单展开 提示/预演/认输，功能与原来一致。

- [ ] **Step 8: 提交**

```bash
git add web/src/components/GameMenu.tsx web/src/components/GameMenu.test.tsx web/src/pages/Game.tsx web/src/styles.css
git commit -m "feat(web): 底部菜单/设置木牌按钮，聚合对局操作 (阶段A)"
```

---

## Task 10: 立体棋盘底座 + 金色高光棋子 + 接入 PlayerBar

**Files:**
- Modify: `web/src/board/themes.ts`、`web/src/board/BoardCanvas.tsx`、`web/src/pages/Game.tsx`

> 纯视觉增强。棋盘底部加一段“底座厚度”，棋子高光增强；对局顶部接入 PlayerBar 展示真实轮次与倒计时。

- [ ] **Step 1: themes.ts 新增底座色 + gold 主题**

在 `web/src/board/themes.ts` 的 `Theme` 接口增加可选底座色：

```ts
  baseShadow?: string // 棋盘底部立体底座色（缺省用 frameDark 派生）
```

并在每个主题（wood/ink/stone/jade）可选补 `baseShadow`；新增 `gold` 主题（商店高阶皮肤，阶段 C 售卖，阶段 A 先注册以便切换预览）：

```ts
  gold: {
    id: 'gold',
    name: '流金岁月',
    boardFace: '#2b3a5c',
    frameBase: '#b8791b',
    frameLight: '#f5c542',
    frameDark: '#7c4a1e',
    line: '#d9b56a',
    star: '#f5e2a0',
    accent: '#f5c542',
    baseShadow: '#5c360f',
    useImage: false,
    black: { hi: '#5a5a62', body: '#1a1a22', edge: '#000006', rim: 'rgba(245,197,66,0.4)', specular: true },
    white: { hi: '#ffffff', body: '#f0e6c8', edge: '#c8b483', rim: 'rgba(120,74,30,0.4)', specular: true },
  },
```

- [ ] **Step 2: BoardCanvas 底座 + 高光增强**

在 `drawFrame` 末尾（棋盘面绘制后）追加底部“底座厚度”：一条比外框更深的横带画在棋盘下沿，营造立体基座。定位 `drawFrame` 函数，在其 `ctx.stroke()`（内凹阴影最后一行）后追加：

```ts
  // 底部立体底座：在棋盘下沿外侧压一条更深的厚度带，增强“坐在桌面上”的立体感。
  const baseColor = theme.baseShadow ?? theme.frameDark
  ctx.fillStyle = baseColor
  ctx.beginPath()
  ctx.moveTo(0, PX)
  ctx.lineTo(PX, PX)
  ctx.lineTo(PX - 6, PX - 6)
  ctx.lineTo(6, PX - 6)
  ctx.closePath()
  ctx.fill()
```

棋子金色高光增强：`drawStone` 的“统一玻璃高光”里，为 `specular` 主题额外点一处更亮的小高光。定位 `drawStone` 的高光段（`gh` 之后、`ctx.restore()` 之前）追加：

```ts
  // specular 主题（玉石/流金）追加一处细锐高光点，增强光泽。
  if ((color === 'black' ? theme.black : theme.white).specular) {
    const sx = cx - r * 0.42
    const sy = cy - r * 0.46
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.3)
    sg.addColorStop(0, 'rgba(255,255,255,0.9)')
    sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, PI2)
    ctx.fill()
  }
```

- [ ] **Step 3: Game.tsx 接入 PlayerBar**

导入：

```ts
import { PlayerBar, type PlayerInfo } from '../components/PlayerBar'
import { countdownState } from '../lib/countdown'
import { rankLabel } from '../theme/ranks'
```

在 `return` 顶部（`BoardCanvas` 之前）替换原 `.player.opponent` 行为 PlayerBar，双方信息阶段 A 占位：

```tsx
      <PlayerBar
        me={{ nickname: '我', avatar: 'avatar_01', rankLabel: rankLabel(1), color: g.myColor } as PlayerInfo}
        opp={{
          nickname: st.mode === 'ai' ? 'AI大师' : '对手',
          avatar: 'avatar_02',
          rankLabel: rankLabel(3),
          color: g.myColor === 'black' ? 'white' : 'black',
        } as PlayerInfo}
        turn={g.turn}
        timer={deadline != null ? { ...pick(countdownState(deadline, Date.now(), 30)) } : null}
      />
```

其中剩余秒随 `remain` 状态刷新即可；为让罗盘每秒更新，复用已有的 `remain` 状态：把 timer 改为基于 `remain` 直接构造，避免额外计时器：

```tsx
        timer={
          deadline != null
            ? {
                remain,
                progress: remain / 30,
                level: remain <= 5 ? 'danger' : remain <= 10 ? 'warn' : 'normal',
              }
            : null
        }
```

（删除上面用到的 `pick(...)` 那版，只保留基于 `remain` 的这版。）

- [ ] **Step 4: 类型检查 + 手动验收**

Run: `cd web && npm run build`
Expected: 构建成功。
手动：对局顶部为对阵条（左右玩家 + 中央罗盘随倒计时收缩变色），棋盘有底部底座厚度、玉石/流金棋子有明显高光。设置页切换主题到「流金岁月」预览 gold 皮肤。

- [ ] **Step 5: 提交**

```bash
git add web/src/board/themes.ts web/src/board/BoardCanvas.tsx web/src/pages/Game.tsx
git commit -m "feat(web): 棋盘立体底座 + 棋子高光增强 + 顶部对阵条 (阶段A)"
```

---

## Task 11: 胜负结算视觉 ResultOverlay（占位数据）

**Files:**
- Create: `web/src/components/ResultOverlay.tsx`
- Modify: `web/src/pages/Game.tsx`、`web/src/styles.css`

> 替换现有 `ResultModal` 在对局页的用法：胜利=金字横幅 + 双方段位 VS + 段位进度条(占位) + 金币 +120(占位) + 看广告双倍(占位) + 再来一盘；失败=左上 回首页/分享 + 银字横幅 + 再来一盘。原 `ResultModal` 组件保留（其他页面仍在用）。

- [ ] **Step 1: 实现 ResultOverlay**

```tsx
// web/src/components/ResultOverlay.tsx
// 对局结算覆盖层。win=true 胜利版（段位VS/进度/金币/双倍），false 失败版。
// 阶段 A：段位进度、金币均为占位数据（props 传入），双倍/分享点击占位。
import { Banner } from './Banner'
import { Avatar } from './Avatar'

export interface ResultPlayer {
  nickname: string
  avatar: string
  rankLabel: string
  points: number
  threshold: number
  delta: number // +10 / -10
}

export function ResultOverlay({
  win,
  me,
  opp,
  coins,
  onRematch,
  onHome,
  onShare,
  onDouble,
}: {
  win: boolean
  me: ResultPlayer
  opp: ResultPlayer
  coins: number
  onRematch: () => void
  onHome: () => void
  onShare: () => void
  onDouble: () => void
}) {
  return (
    <div className="result-overlay">
      <div className="result-top">
        <button className="round-btn" onClick={onHome} aria-label="回首页">🏠</button>
        <button className="round-btn" onClick={onShare} aria-label="分享">🔗</button>
      </div>
      <Banner text={win ? '胜利' : '失败'} tone={win ? 'gold' : 'silver'} />
      {win && (
        <>
          <div className="result-vs">
            <ResultSide p={me} />
            <span className="vs-mark">VS</span>
            <ResultSide p={opp} />
          </div>
          <div className="reward-row">
            <img src="/assets/img/icon_coin.png" alt="金币" />
            <span>+{coins}</span>
          </div>
          <button className="ad-double" onClick={onDouble}>看广告双倍领取</button>
        </>
      )}
      <button className="rematch" onClick={onRematch}>再来一盘</button>
    </div>
  )
}

function ResultSide({ p }: { p: ResultPlayer }) {
  const pct = Math.max(0, Math.min(100, (p.points / p.threshold) * 100))
  return (
    <div className="result-side">
      <Avatar src={`/assets/img/${p.avatar}.png`} size={64} />
      <div className="result-rank">{p.rankLabel}</div>
      <div className="result-nick">{p.nickname}</div>
      <div className="rank-bar">
        <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
        <span className="rank-bar-text">{p.points}/{p.threshold}</span>
      </div>
      <div className={p.delta >= 0 ? 'delta up' : 'delta down'}>
        {p.delta >= 0 ? `↑+${p.delta}` : `↓${p.delta}`}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 追加 CSS**

```css
.result-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: rgba(30, 20, 8, 0.6);
}
.result-top { position: absolute; top: 20px; left: 16px; display: flex; gap: 10px; }
.round-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #d9a86a, #a86b32 70%, #7c4a1e);
  border: 2px solid #5c3a17; font-size: 18px;
}
.result-vs { display: flex; align-items: center; gap: 18px; }
.vs-mark { font-size: 26px; font-weight: 700; color: var(--gold); }
.result-side { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.result-rank { color: var(--gold); font-size: 14px; font-weight: 700; }
.result-nick { color: #f6ecd8; font-size: 13px; }
.rank-bar { position: relative; width: 110px; height: 16px; border-radius: 8px; background: rgba(0,0,0,0.4); overflow: hidden; }
.rank-bar-fill { height: 100%; background: linear-gradient(90deg, #6fd08a, #2ecc71); }
.rank-bar-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; }
.delta.up { color: #2ecc71; font-weight: 700; }
.delta.down { color: #e74c3c; font-weight: 700; }
.reward-row { display: flex; align-items: center; gap: 6px; font-size: 22px; color: #f5c542; font-weight: 700; }
.reward-row img { width: 26px; height: 26px; }
.ad-double {
  background: linear-gradient(180deg, #ffd76a, #e0a52f);
  border: 2px solid #a86b32; color: #5c360f; font-weight: 700;
  padding: 10px 22px; border-radius: 22px;
}
.rematch {
  background: radial-gradient(circle at 50% 30%, #d9a86a, #a86b32 75%, #7c4a1e);
  border: 2px solid #5c3a17; color: #3a240f; font-weight: 700;
  padding: 12px 34px; border-radius: 26px; font-size: 20px;
}
```

- [ ] **Step 3: 接入 Game.tsx**

导入并替换对局页结算弹窗（原 `showModal && result && <ResultModal .../>` 块）为 `ResultOverlay`，段位/金币用占位：

```tsx
import { ResultOverlay } from '../components/ResultOverlay'
```

```tsx
      {showModal && result && (
        <ResultOverlay
          win={result.win}
          coins={result.win ? 120 : 0}
          me={{ nickname: '我', avatar: 'avatar_01', rankLabel: rankLabel(1), points: 10, threshold: 30, delta: result.win ? 10 : -10 }}
          opp={{ nickname: st.mode === 'ai' ? 'AI大师' : '对手', avatar: 'avatar_02', rankLabel: rankLabel(3), points: 20, threshold: 30, delta: result.win ? -10 : 10 }}
          onRematch={rematch}
          onHome={() => nav('/')}
          onShare={() => alert('分享（后续接入）')}
          onDouble={() => alert('看广告双倍（阶段C）')}
        />
      )}
```

> 保留 `import { ResultModal }` 与其他页面无关；若 Game 不再使用 ResultModal，删除 Game 内该 import 以免 lint 报未用。

- [ ] **Step 4: 构建 + 手动验收**

Run: `cd web && npm run build`
Expected: 构建成功。
手动：人机赢一局→金字「胜利」+ 双方段位 VS + 进度条 + 金币 +120 + 看广告双倍 + 再来一盘；输一局→银字「失败」+ 左上 回首页/分享 + 再来一盘。

- [ ] **Step 5: 提交**

```bash
git add web/src/components/ResultOverlay.tsx web/src/pages/Game.tsx web/src/styles.css
git commit -m "feat(web): 胜负结算视觉 ResultOverlay（占位数据） (阶段A)"
```

---

## Task 12: 段位进阶界面 RankUpOverlay（占位）

**Files:**
- Create: `web/src/components/RankUpOverlay.tsx`
- Modify: `web/src/pages/Game.tsx`、`web/src/styles.css`

> 阶段 A 用一个手动触发/占位条件展示（如占位 `promoted=false` 常关；提供组件与样式，接入点留给阶段 B 用真实 promoted 触发）。本任务交付组件 + 样式 + 在 Game 里以 `false` 占位接线（不实际弹出），保证阶段 B 只需把条件换成真实值。

- [ ] **Step 1: 实现 RankUpOverlay**

```tsx
// web/src/components/RankUpOverlay.tsx
// 段位进阶界面：旧段位 -> 新段位 + 奖章 + 金币，点任意处继续。
// group 决定奖章素材（ji/duan/master）。
import { Banner } from './Banner'
import type { rankGroup as RankGroupFn } from '../theme/ranks'

type Group = ReturnType<typeof RankGroupFn>

export function RankUpOverlay({
  fromLabel,
  toLabel,
  group,
  coins,
  onContinue,
}: {
  fromLabel: string
  toLabel: string
  group: Group
  coins: number
  onContinue: () => void
}) {
  return (
    <div className="rankup-overlay" onClick={onContinue}>
      <Banner text="段位进阶" tone="gold" />
      <div className="rankup-transit">
        <span className="rankup-from">{fromLabel}</span>
        <span className="rankup-arrow">➜</span>
        <span className="rankup-to">{toLabel}</span>
      </div>
      <img className="rankup-medal" src={`/assets/img/medal_${group}.png`} alt="" />
      <div className="reward-row">
        <img src="/assets/img/icon_coin.png" alt="金币" />
        <span>+{coins}</span>
      </div>
      <div className="rankup-hint">点击任意位置继续</div>
    </div>
  )
}
```

- [ ] **Step 2: 追加 CSS**

```css
.rankup-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: rgba(20, 14, 6, 0.85);
}
.rankup-transit { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 700; }
.rankup-from { color: #9aa3ad; }
.rankup-arrow { color: var(--gold); }
.rankup-to { color: #f5c542; }
.rankup-medal { width: 140px; height: 140px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5)); animation: start-pop 0.6s ease; }
.rankup-hint { color: #d8cfb8; font-size: 15px; margin-top: 8px; }
```

- [ ] **Step 3: 在 Game.tsx 占位接线（不实际弹出）**

导入 + 占位状态（阶段 B 会把 `promoted` 换成结算返回的真实值）：

```ts
import { RankUpOverlay } from '../components/RankUpOverlay'
import { rankGroup } from '../theme/ranks'
```

```tsx
      {/* 阶段A 占位：promoted 恒 false，不弹出；阶段B 用结算返回的 promoted 触发。 */}
      {false && (
        <RankUpOverlay
          fromLabel={rankLabel(1)}
          toLabel={rankLabel(2)}
          group={rankGroup(2)}
          coins={120}
          onContinue={() => {}}
        />
      )}
```

> 说明：`{false && ...}` 保证组件被类型检查与打包引用，但运行时不渲染，便于阶段 B 直接替换条件。

- [ ] **Step 4: 构建 + 组件冒烟测试**

```tsx
// web/src/components/RankUpOverlay.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RankUpOverlay } from './RankUpOverlay'

describe('RankUpOverlay', () => {
  it('显示旧->新段位并点击继续', () => {
    const onContinue = vi.fn()
    render(
      <RankUpOverlay fromLabel="业余2级" toLabel="业余3级" group="ji" coins={120} onContinue={onContinue} />,
    )
    expect(screen.getByText('业余2级')).toBeTruthy()
    expect(screen.getByText('业余3级')).toBeTruthy()
    fireEvent.click(screen.getByText('段位进阶'))
    expect(onContinue).toHaveBeenCalled()
  })
})
```

Run: `cd web && npx vitest run src/components/RankUpOverlay.test.tsx && npm run build`
Expected: PASS + 构建成功。

- [ ] **Step 5: 提交**

```bash
git add web/src/components/RankUpOverlay.tsx web/src/components/RankUpOverlay.test.tsx web/src/pages/Game.tsx web/src/styles.css
git commit -m "feat(web): 段位进阶界面 RankUpOverlay（占位接线） (阶段A)"
```

---

## Task 13: 全屏走查 + 回归 + 收尾

**Files:** 无（验证与文档）

- [ ] **Step 1: 全量单测**

Run: `cd web && npx vitest run`
Expected: 全绿（含新增 ranks/countdown/Banner/PlayerBar/StartCountdown/GameMenu/RankUpOverlay 用例与原有棋规/AI/store 用例）。

- [ ] **Step 2: 类型检查 + 生产构建**

Run: `cd web && npm run build`
Expected: `tsc -b` 无错误，`vite build` 产出 dist。

- [ ] **Step 3: lint**

Run: `cd web && npm run lint`
Expected: 无新增未用变量/导入告警（重点检查 Game.tsx 是否残留未用的 ResultModal/hud 变量）。

- [ ] **Step 4: 浏览器逐屏走查（golden path + 边界）**

Run: `cd web && npm run dev`
逐项确认：
1. 首页：绿色水墨背景 + LOGO + 段位标签 + 金币/卷轴占位 + 五入口 + 商店/签到/转盘三钮。
2. 人机对局：开局 3-2-1；顶部对阵条随轮次高亮、罗盘随倒计时收缩变色；棋盘立体底座 + 棋子高光；底部菜单（提示/预演/认输）+ 设置。
3. 赢：金字胜利结算（VS/进度/金币/双倍/再来一盘）；回首页/分享按钮。
4. 输：银字失败结算 + 再来一盘。
5. 真人/残局入口不回归报错（对阵条对手信息为占位「对手」）。
6. 窄屏（手机尺寸）下对阵条不溢出、按钮可点。

> 纯视觉部分以人工走查为准；如发现观感问题（素材偏色/布局溢出），回到对应 Task 微调后重跑该屏。

- [ ] **Step 5: 更新 README 一句话**

在 `README.md` 的 UI 相关段落补一句：阶段 A 已按参考图换肤（段位/金币为占位，B/C 接真实）。若无合适位置可跳过。

- [ ] **Step 6: 提交收尾**

```bash
git add -A
git commit -m "chore(web): 阶段A 视觉换肤走查与收尾"
```

---

## Self-Review 记录（写计划时自检）

- **Spec 覆盖（§7 画面）**：主页(T6)、对局对阵条+罗盘(T7,T10)、3-2-1(T8)、立体棋盘+高光(T10)、失败弹窗(T11)、胜利弹窗(T11)、段位进阶(T12)、底部菜单/设置(T9)、素材(T3,T4)。段位/金币/卷轴按阶段 A 约定为占位——已在各任务显式标注。
- **占位扫描**：无 TBD/TODO；每个代码步骤给出完整代码或精确定位的替换片段。
- **类型一致性**：`rankLabel/rankGroup`(T1) 全程一致；`countdownState` 返回 `{remain,level,progress}`(T2) 被 CompassTimer/PlayerBar/Game 一致使用；`PlayerInfo/ResultPlayer/MenuAction` 定义与使用一致。
- **阶段边界**：B（真实段位结算/RankUp 触发）、C（金币/卷轴/商店/看广告双倍/头像框皮肤）、D（签到/转盘）不在本计划，将各自出计划。
