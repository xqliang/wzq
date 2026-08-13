# 古风五子棋（wzq）

一款中国古风风格的五子棋对战网页游戏：人机对战、好友实时对战、五子棋残局闯关，配合 AI 提示 / 三步预演、经验等级、战绩分享与轻量运营后台。

- 在线体验：http://124.221.105.4:8090/
- 前端：React + TypeScript + Vite（棋盘 Canvas、AI 跑在 Web Worker）
- 后端：Go（单二进制，同源托管前端 + REST + WebSocket），本地 SQLite / 线上 MySQL
- 素材：火山方舟 seedream 文生图（古风背景/棋子/头像）+ Web Audio 合成音效

---

## 一、玩法介绍

### 1. 人机对战
- 三档难度：**普通练习（Lv1，免费）/ 中等（Lv2，−50 经验）/ 高级（Lv3，−100 经验）**。
- AI 采用极大极小 + α-β 剪枝 + 启发式评估，跑在浏览器 Web Worker 中；难度越高搜索越深（Lv1/2/3 分别为 2/4/6 层），会主动封堵活三、活四。
- AI「思考」总时长控制在 1~2 秒随机（含真实运算耗时），手感更自然。
- 胜 +20 经验、负 +5 经验；每日胜利发经验有次数上限（防刷）。

### 2. 好友对战（实时）
- 「好友对战」创建房间，复制邀请链接发给好友；好友打开链接进入同一房间，双方到齐自动开局。
- 每步 **60 秒倒计时**，剩 5 秒强提示，超时判负；等待好友最多 5 分钟，超时提示并返回首页。
- 支持**悔棋协商**（对方同意才回退）、**认输**、**再来一局**（双方点击后在原房间直接开新局）。
- 服务端做落子裁判（校验合法性、判定胜负、计时），胜 +20 / 负 +5 经验。

### 3. 残局闯关
- 全部为**真正意义的必胜残局**（执黑可在 2~5 步内通过连续冲四逼死对手），按难度从易到难排列。
- 玩家从残局局面**接着和 AI 对弈**，实际走出杀法取胜即通关；被翻盘可重试。
- 支持 **💡 提示**（高亮一个正确首着）；首次通关按难度奖励经验。
- 关卡答案与「N 步可胜」由服务端 **VCF（连续冲四）解算器**实时推导，保证每关可解且答案不作假。

### 4. 落子交互与手感
- 点击棋盘先出现半透明**预落子**，点棋子旁的 **✓** 或再次点击该点才真正落子，避免误触。
- 落子有「落下」重量动画 + 触地冲击环 + 木质落子音效；最近一手有呼吸灯提示。

### 5. AI 辅助（人机模式）
- **提示**：AI 给出推荐落子并高亮。
- **三步预演**：推演双方各 3 步（共 6 手），用绿/蓝/紫标注顺序，仅展示不改变棋盘。

### 6. 成长与社交
- **经验 / 等级**：Lv1 初学者 … Lv5 大师，按累计经验升级。
- **战绩页**：对局数、胜负、胜率、当前连胜等，可生成**分享链接**（他人打开看到你的战绩卡片）。
- **设置**：背景音乐 / 音效开关与音量，本地持久化。

### 7. 运营后台
- 路径 `/admin`（口令登录，默认 `wzq-admin-888`，可用环境变量覆盖）。
- 看板：用户总数、今日新增、人机/真人对局数、残局通关数；最近用户、最近对局列表。

---

## 二、技术架构

```
                 浏览器 (React SPA + Canvas + Web Worker AI)
                        │  同源 HTTP / WebSocket
                        ▼
        ┌───────────────────────────────────────────┐
        │            Go 单二进制 wzq-server            │
        │  api(REST + /ws + 静态托管前端 dist)         │
        │  auth(JWT)  user(经验/等级/防刷)             │
        │  room(内存房间 + WebSocket 裁判 + 计时)       │
        │  endgame(残局 + VCF 解算器)  record(棋谱/战绩)│
        │  store(SQLite 本地 / MySQL 线上)             │
        └───────────────────────────────────────────┘
                        │
                     MariaDB / MySQL（线上）
```

设计要点：
- **同源单体**：Go 二进制同时提供 API、WebSocket 与前端静态资源（`config.web.dir` 指向前端构建产物），无需 Nginx、无跨域。
- **前端构建**用空 `VITE_API_BASE`，走相对 `/api` 与同源 `ws`，天然适配任意域名/端口。
- **棋规两份**：前端 TS（渲染/AI/离线判定）与后端 Go（真人对战权威裁判）各一份。
- **房间**：Phase 1 单实例内存房间（`map[roomId]*Room`），并发加锁；对局结束可重连原房间开新局。
- **残局解算器**：后端 VCF（连续冲四）搜索判定「N 步内必胜」并推导可行首着，用于出题校验与提示。
- **纯静态部署**：`CGO_ENABLED=0` 交叉编译（SQLite 用纯 Go 的 modernc、MySQL 用 go-sql-driver），单文件 scp 上线。

### 目录结构
```
wzq/
  web/                     # 前端
    src/
      core/                # 棋规核心（types/board/win）
      ai/                  # AI：evaluate / search(minimax+αβ) / worker
      board/BoardCanvas.tsx# Canvas 棋盘（预落子/呼吸灯/落下动画/内联✓）
      net/                 # rest.ts / ws.ts
      store/game.ts        # zustand 对局状态
      pages/               # Home/AiConfig/Game/Result/Room/Endgame/EndgamePlay/Stats/Share/Admin/Settings
      audio/audio.ts       # Web Audio 合成音效 + 设置
      styles.css
  server/                  # 后端（Go, module github.com/wzq/gomoku）
    cmd/server/main.go
    internal/
      config/  auth/  store/  user/  room/  record/  endgame/  api/  gomoku/
    config.yaml
    deploy/deploy.sh        # 一键部署脚本
  scripts/                  # seedream 素材生成（uv + pillow）
  docs/superpowers/         # 设计文档与实现计划
```

---

## 三、本地开发

前置：Node ≥ 20、Go ≥ 1.25、（可选）用于生成素材的 `uv`。

```bash
# 后端（本地默认 SQLite，无需数据库）
cd server && go run ./cmd/server          # 监听 :8090，读取 ./config.yaml

# 前端（另开终端）
cd web
echo 'VITE_API_BASE=http://localhost:8090' > .env   # 开发时前端指向本地后端
npm install
npm run dev                                # Vite 开发服务器 :5173
```

- 前端开发用 `npm run dev`（:5173），API 指向 `:8090`。
- 也可整体同源预览：`cd web && VITE_API_BASE= npm run build`，再让后端 `config.yaml` 的 `web.dir` 指向 `web/dist`，只跑后端即可在 `:8090` 同时访问前端与 API。

### 测试
```bash
cd server && go test ./...        # 后端：棋规/裁判/残局解算器/经验/房间 等
cd web && npx vitest run          # 前端：棋规核心 / AI（含防守与计时）/ 对局 store
```

### 生成素材（可选）
```bash
export ARK_API_KEY=<火山方舟密钥>
uv run scripts/make-backgrounds.py     # 背景
uv run scripts/make-pieces.py          # 棋子（绿底抠图→透明 PNG）
uv run scripts/make-avatars.py         # 头像（蓝底抠图→透明 PNG）
```
约定：需要透明的素材用**绿/蓝纯底**生图再抠图（不用白底）；图片按显示尺寸 ×3 缩放保存，控制体积。

---

## 四、部署说明

线上为一台 Debian 云服务器（SSH 别名 `ecs`），同机可共存 **prod（:8090）** 与 **stage（:8091）** 两套隔离实例，数据库为同实例不同库 `wzq_prod` / `wzq_stage`。

### 一键部署
```bash
# 部署 prod（默认）
ENV=prod ./server/deploy/deploy.sh
# 或部署 stage
ENV=stage ./server/deploy/deploy.sh
# 指定 SSH 主机
ENV=prod ./server/deploy/deploy.sh myhost
```

脚本会自动完成：
1. 开发机交叉编译 `linux/amd64` 纯静态二进制（`CGO_ENABLED=0`）。
2. 前端 `VITE_API_BASE= npm run build` 构建，随二进制一起上传到 `/opt/wzq-<env>/`。
3. 确保远端 MariaDB 安装运行，创建库 `wzq_<env>` 与应用账号（首次随机生成密码写入 `.db_password`，重部署不覆盖）。
4. 首次生成 `config.yaml`（含 MySQL DSN、`web.dir`）与 `.env`（随机 `WZQ_AUTH_SECRET`），**已存在则不覆盖**（避免轮换密钥把自己锁在外）。
5. 安装 systemd 服务 `wzq-<env>`（专用低权限用户 `wzq`、开机自启），并装好每日 `mysqldump` 本地备份 timer。
6. 尽力放行主机防火墙端口（云厂商安全组需自行放行 TCP 8090/8091）。

幂等：重复执行即「重新部署」，仅重编译、传二进制与前端、重启服务，保留 `config.yaml/.env/.db_password/data/`。

### 配置与环境变量
`server/config.yaml`（线上由部署脚本生成）：
```yaml
addr: ":8090"
db: { driver: mysql, dsn: "wzq_prod:***@tcp(127.0.0.1:3306)/wzq_prod?..." }
web: { dir: "/opt/wzq-prod/web" }   # 指向前端 dist，则同源托管前端
auth: { authTtlMinutes: 43200 }
```
环境变量（覆盖配置）：
- `WZQ_AUTH_SECRET`：JWT 签名密钥（线上经 systemd EnvironmentFile 注入，勿明文入库）。
- `WZQ_DB_DRIVER` / `WZQ_DB_DSN`：数据库驱动与连接串（`sqlite` 或 `mysql`）。
- `WZQ_WEB_DIR`：前端 dist 目录（为空则只提供 API）。
- `WZQ_ADMIN_PASSWORD`：运营后台口令（默认 `wzq-admin-888`，线上务必覆盖）。

### 运维
```bash
ssh ecs 'journalctl -u wzq-prod -f'                 # 实时日志
ssh ecs 'systemctl list-timers wzq-backup@prod.timer'# 备份 timer
```

---

## 五、说明与边界
- Phase 1「暂时相信客户端」：人机结果由客户端上报并结算经验；真人对战为服务端权威裁判。
- 未实现（网页不适用）：微信登录/分享/小游戏生命周期、IAA 广告。
- 「残局必胜」以内置 VCF 解算器的定义为准；玩家若偏离杀法，防守 AI 可能翻盘（可重试或看提示）。
