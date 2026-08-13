# 古风五子棋网页对战游戏 — 设计文档（Phase 1）

- 日期：2026-08-13
- 范围：Phase 1「核心玩法 + 轻后端」。不含残局闯关、IAA 广告、运营后台、数据分析（这些留给 Phase 2 / Phase 3）。
- 参考实现：`../dubbing`（Go 服务端的部署/配置/WebSocket/JWT/素材生成脚本模式全面对齐）。

## 1. 目标与范围

做一款**浏览器端**的中国古风五子棋对战游戏，第一版覆盖：

- 游客账号自动创建 + 可升级绑定用户名/密码
- 五子棋对局（15×15，标准无禁手）
- 人机对战：AI 三档（普通/中等/高级），AI 引擎跑在**前端浏览器本地**
- 好友真人对战：房间制（邀请链接/房间号），WebSocket 实时对战，服务端裁判
- 每步 60 秒倒计时，超时判负
- 落子二次确认（预落子半透明 → ✓确认/取消）、最新子呼吸灯
- 悔棋協商（双方同意才回退，每人每局最多 2 次）
- 胜负判定、结果页
- 经验/等级体系（云端存储）+ 简单防刷
- 对局落库（含逐手棋谱），为 Phase 3 后台预留
- 古风 UI + 占位音效
- 部署到 ECS，数据库 MySQL

**明确不做（Phase 1）**：微信登录/分享/小游戏生命周期、IAA 广告、残局闯关、AI 提示/三步预演、运营后台、数据统计、随机匹配（只有好友房间）。

## 2. 关键技术决策与取舍

| 决策 | 选择 | 理由 |
|---|---|---|
| 前端 | React + TypeScript + Vite | 生态成熟、易招人，后续接后台/改小游戏方便 |
| 后端 | Go（对齐 dubbing） | 纯静态交叉编译、部署简单；gorilla/websocket 成熟 |
| 数据库 | 本地 sqlite / 线上 MySQL（config 驱动） | 对齐 dubbing：本地零依赖开发，线上 MySQL |
| 后端结构 | **模块化单体**，非微服务 | 文档的服务拆分是远期理想；MVP 一个二进制分模块最快 |
| 房间状态 | **单实例内存房间**，Phase 1 不引入 Redis | 单台 ECS 用内存 map 足够；留接口，将来加 Redis bus 扩容 |
| 棋规核心 | **TS + Go 各写一份** | 前端做渲染/AI/离线判定；Go 做真人对战服务端裁判防作弊。规则简单，两份成本低 |
| AI 位置 | 前端浏览器本地（Web Worker） | 零服务端负载、无网络往返；文档"暂时相信客户端" |
| 账号 | 游客自动 + 可升级绑定 | 开局即玩，又能跨设备找回 |

## 3. 仓库结构（monorepo）

```
wzq/
  web/                 # React + TS + Vite 前端
    src/
      core/            # gomoku-core: 棋盘状态 / 落子合法性 / 五连判定（纯 TS，无 UI）
      ai/              # gomoku-ai: minimax + α-β + 启发评估，运行于 Web Worker
      pages/           # 首页 / 人机配置 / 对局 / 结果 / 房间等待 / 设置
      board/           # Canvas 棋盘渲染组件
      net/             # WebSocket 客户端 + REST 客户端
      store/           # 轻量状态（Zustand）
      audio/           # 音频管理 + 设置持久化
      assets/          # seedream 生成的图片、字体、占位音频
  server/              # Go 服务端（对齐 dubbing）
    cmd/server/        # main
    internal/
      config/          # config.yaml + .env 加载（对齐 dubbing）
      auth/            # 游客注册 / JWT / 升级绑定
      user/            # 用户 + 经验 + 等级
      room/            # WebSocket 房间 + 服务端裁判
      gomoku/          # Go 版棋规核心（裁判用）
      record/          # 对局 + 棋谱落库
      store/           # DB 访问（sqlite/mysql）
    config.yaml
    deploy/deploy.sh   # 对齐 dubbing：交叉编译静态二进制 scp + systemd + 备份
  scripts/             # seedream 素材生成（uv + requests + pillow）
  docs/                # 设计文档
```

## 4. 前端设计

### 4.1 页面 / 路由
- **首页**：头像、昵称、当前经验、等级、设置入口；三入口「人机对战 / 好友对战 / 残局闯关（Phase1 置灰）」
- **人机配置页**：选难度（Lv1 免费 / Lv2 −50 / Lv3 −100），展示「当前经验 XXX ｜ 本局消耗 ｜ 胜利可获得 20」，确认后进入对局
- **对局页**：棋盘居中，上下（或左右）双方信息区（头像/昵称/颜色/思考时间），当前行动方「轮到你落子」提示
- **结果页**：胜/负、比分区、+经验、用时、落子数；按钮「再来一局 / 邀请好友 / 返回首页」
- **房间等待页**：房间号、状态、邀请链接、重新邀请、房主退出
- **设置弹层**：背景音乐开关+音量、音效开关+音量；localStorage 持久化

### 4.2 gomoku-core（TS，纯逻辑）
- 15×15 棋盘，坐标 (x,y)，值 empty/black/white
- `applyMove`、`isLegal`、`checkWin`（横/竖/斜四方向连五检测）
- 无 UI、无副作用，便于单测与被 AI 复用

### 4.3 gomoku-ai（TS，Web Worker）
- 极大极小 + α-β 剪枝 + 启发式评估（活二/活三/冲四/连五打分）
- 候选点只取已有棋子邻域，缩小搜索空间
- 三档区分：搜索深度 + 评估精度 + 是否加入随机扰动
  - Lv1 普通：浅搜索/加噪声，会漏防
  - Lv2 中等：中等深度，基本攻防
  - Lv3 高级：更深搜索 + 完整评估
- 跑在 Web Worker，避免阻塞 UI；返回推荐落子

### 4.4 棋盘渲染（Canvas）
- 15×15 木纹棋盘（seedream 素材），黑白棋子贴图
- 落子交互：点击 → 半透明预落子（80%）+ ✓确认/取消 → 确认后 100% 不透明 + 落子音效 + 记录 + 切换行动方
- 最新子呼吸灯：外圈轻微放大 + 透明度循环，持续 1~2s
- 重新点击其他位置 = 改选；点取消 = 撤销预落

### 4.5 计时
- 真人对战：每步 60s，轮到己方开始倒计时
- 最后 10s 视觉提示，最后 5s 音效，0s 触发判负 + 失败动画
- 人机对战：Phase 1 不做硬性超时（本地对手无需计时压力），仅显示己方思考计时

### 4.6 音频
- 占位音效：落子、倒计时、超时、胜利、失败、按钮、悔棋
- 占位 BGM：古风背景音乐
- 全部通过 `audio/` 管理，尊重设置开关/音量

## 5. 后端设计（Go）

### 5.1 auth 模块
- 首次进入：`POST /api/guest` → 服务端建游客账号（随机古风昵称 + 默认头像），返回 JWT
- 前端存 JWT 于 localStorage，后续请求带 `Authorization: Bearer`
- 升级绑定：`POST /api/bind`（需登录）→ 设置 username + password（bcrypt），账号从游客升为正式
- 登录：`POST /api/login`（username/password）→ JWT
- JWT 密钥与 dubbing 一致：config 里随机生成、部署时不覆盖

### 5.2 user 模块（用户 + 经验 + 等级）
- 查询/更新用户资料、经验、等级
- 经验结算入口（见 §7）
- 等级由经验累计换算（Lv1~Lv5 阈值表，配置化）

### 5.3 room 模块（WebSocket 房间 + 服务端裁判）
- 建房：`POST /api/room` → roomId + 邀请链接
- 连接：`GET /ws?room=<id>`（带 JWT）
- 房间生命周期：等待 → 双方 ready → 进行中 → 结束
- 服务端持有权威棋盘（用 `internal/gomoku` 裁判）：
  - 校验落子合法性（是否轮到该玩家、位置是否空）
  - 每步 60s 计时，超时判该方负
  - 连五判胜
  - 悔棋協商：转发请求，双方同意才回退一手（每人每局 ≤2 次）
  - 房主退出 / 掉线 → 对方判胜或房间关闭
- Phase 1 单实例：房间存内存 map（`map[roomId]*Room`），加锁保证并发安全
- 结束时调用 user 结算经验 + record 落库

### 5.4 gomoku 模块（Go 棋规核心）
- 与 TS core 等价的落子合法性 + 连五判定，供服务端裁判使用

### 5.5 record 模块（对局 + 棋谱落库）
- 对局结束写 `game_record` + 逐手 `game_move`
- 人机对局：客户端上报结果（含棋谱），Phase 1 信任客户端后落库

## 6. 数据模型（MySQL / sqlite 兼容）

```sql
-- 用户（游客与正式账号共用一张表）
user(
  id            BIGINT PK,
  guest_id      VARCHAR UNIQUE,        -- 游客设备/匿名标识
  username      VARCHAR UNIQUE NULL,   -- 绑定后才有
  password_hash VARCHAR NULL,          -- bcrypt，绑定后才有
  nickname      VARCHAR,
  avatar        VARCHAR,               -- 头像素材键
  exp           INT DEFAULT 0,
  level         INT DEFAULT 1,
  created_at    DATETIME,
  last_login    DATETIME
)

-- 对局概要
game_record(
  id          BIGINT PK,
  mode        ENUM('ai','pvp'),
  ai_level    TINYINT NULL,            -- 人机时 1/2/3
  black_uid   BIGINT,
  white_uid   BIGINT NULL,             -- 人机时对手为 AI，可空
  winner      ENUM('black','white','draw'),
  moves       INT,
  duration    INT,                     -- 秒
  end_reason  ENUM('five','timeout','resign','leave'),
  created_at  DATETIME
)

-- 逐手棋谱
game_move(
  id       BIGINT PK,
  game_id  BIGINT FK -> game_record.id,
  seq      INT,                        -- 第几手
  color    ENUM('black','white'),
  x        TINYINT,
  y        TINYINT,
  ts       DATETIME
)
```

Phase 1 不建：残局、广告、分享表。

## 7. 经验与防刷

**经验规则**
- 真人对战：胜 +20 / 负 +5
- 人机对战：胜 +20 / 负 +5；AI Lv1 免费、Lv2 开局扣 50、Lv3 开局扣 100（经验不足则禁止进入）
- 等级：经验累计换算，配置化阈值表（Lv1 初学者 … Lv5 大师）

**结算权威性**
- 真人对战：服务端裁判判定胜负后由 user 模块结算（权威）
- 人机对战：客户端上报结果，Phase 1「暂时相信客户端」

**简单防刷（Phase 1 就做）**
- 人机每日「胜利发经验」次数上限（超出后胜利不再发经验，可继续玩）
- 同一对手 + 短时间重复真人对战冷却（冷却内胜负不发经验）
- 阈值配置化，记录在 user / 独立计数表

## 8. WebSocket 协议（JSON）

客户端 → 服务端：`ready` / `place`（预落，仅本地，不发）实际发 `move{x,y}` / `undo_req` / `undo_reply{agree}` / `resign`
服务端 → 客户端：`room_state` / `start{color, first}` / `move{uid,x,y,seq}` / `turn{uid, deadline}` / `undo_req{from}` / `undo_result{agree, revert_to}` / `timeout{loser}` / `game_over{winner, reason, exp_delta}` / `opponent_left`

- 每条消息含 `type` 字段
- 服务端下发 `turn` 带绝对截止时间戳，前端据此渲染倒计时（避免时钟漂移）

## 9. 素材生成（seedream）

- 模型：`doubao-seedream-5-0-260128`（全项目固定，勿改）
- 接口：`https://ark.cn-beijing.volces.com/api/v3/images/generations`，`ARK_API_KEY` 读环境变量
- 脚本模式对齐 dubbing：`uv run scripts/make-*.py`，inline deps（requests + pillow）
- **生图约束（本项目特有）**：
  - 需要抠图的素材（棋子、图标、头像等）**用绿色或蓝色纯底生图，再抠图成透明 PNG**，不用白底（白底易与画面冲突）
  - **图片按显示尺寸 ×3 缩放保存**，控制体积，不存超大原图；jpeg/png 压缩到合理 KB
- 需生成的素材：对局背景（古风棋室 / 水墨）、棋盘木纹、黑/白棋子、默认头像组、结果页背景、按钮、图标
- 统一风格：低饱和水墨 + 暖木色调
- 音频：占位（免费开源或后续替换）
- 字体：免费可商用开源中文古风字体

## 10. 部署（对齐 dubbing）

- 本地开发：`go run ./cmd/server`，sqlite，零外部依赖；前端 `vite dev`
- 线上：交叉编译 Linux/amd64 纯静态二进制（CGO_ENABLED=0），scp 到 ECS
- `deploy/deploy.sh` 幂等：stage(8081) / prod(8080)，systemd 服务，MySQL 库 `wzq_stage` / `wzq_prod`
- config.yaml 仅在远端不存在时生成（含随机 JWT secret / admin 密码 / MySQL DSN），已存在不覆盖
- 每日 mysqldump → TOS 备份（对齐 dubbing）
- 前端构建产物静态托管（Nginx 或服务端 static）

## 11. 测试策略

- **gomoku-core（TS）**：连五四方向、边界、非法落子的单测
- **gomoku（Go）**：与 TS 等价的裁判单测
- **AI（TS）**：给定「一步连五」「必须防冲四」等局面，断言 AI 落子正确
- **server（Go）**：对齐 dubbing 用 sqlite 跑集成测试——游客注册/绑定/登录、房间完整流程（建房→ready→对弈→判胜→结算）、经验结算与防刷、超时判负
- **前端交互**：落子确认、倒计时、悔棋協商用可测的纯函数 + 组件测试

## 12. 里程碑拆分（供后续 writing-plans 参考）

1. 棋规核心（TS + Go）+ 单测
2. 前端对局页 + Canvas 渲染 + 落子确认 + 本地人机（AI Worker）
3. 后端 auth + user + 经验/等级 + MySQL/sqlite
4. 后端 room（WebSocket + 裁判 + 计时 + 悔棋）+ 前端接入真人对战
5. record 落库 + 防刷 + 结果页
6. seedream 素材 + 古风 UI 皮肤 + 音频占位
7. 部署脚本（deploy.sh / config / 备份）
