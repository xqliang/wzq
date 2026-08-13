#!/usr/bin/env bash
#
# deploy.sh — 从开发机一键部署 wzq(五子棋)到 Debian 云服务器。
#
# 环境:本脚本部署 stage / prod 两套(默认 prod)。二者同机共存、互不干扰:
#   - 目录 /opt/wzq-<env>、端口 prod=8090 / stage=8091、systemd 服务 wzq-<env>。
#   - DB 用 MariaDB,同实例不同库:wzq_prod / wzq_stage。
#   - test 环境用本地 sqlite,不经本脚本(本地 go run 即可)。
#
# 架构要点:
#   1. 服务器不装 Go。开发机交叉编译 linux/amd64 纯静态二进制(CGO_ENABLED=0)scp 上去。
#   2. 前端由 Go 二进制同源托管(config.yaml 的 web.dir 指向 dist),无需 Nginx、无跨域。
#      前端用空 VITE_API_BASE 构建 -> 走相对 /api 与同源 ws,天然适配任意域名/端口。
#   3. MariaDB 是硬依赖(内存房间不需要 Redis)。应用账号密码首次随机生成写入
#      $REMOTE_DIR/.db_password,重新部署不覆盖(避免线上连不上库)。
#   4. auth 密钥经 EnvironmentFile($REMOTE_DIR/.env, chmod600)注入 WZQ_AUTH_SECRET;
#      config.yaml(chmod600)含 addr + mysql DSN + web.dir。二者仅首次生成,重部署不覆盖。
#   5. 幂等:可反复执行做"重新部署"。每次重编译、传二进制与前端、重启服务,
#      但保留 config.yaml / .env / .db_password / data /。每日 mysqldump 本地备份 timer 一并装好。
#
# 用法:
#   ./server/deploy/deploy.sh                  # 默认 SSH 主机 ecs、默认环境 prod(8090)
#   ENV=stage ./server/deploy/deploy.sh        # 部署 stage(8091,库 wzq_stage)
#   ENV=stage ./server/deploy/deploy.sh myhost # 指定 SSH 主机 + 环境
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. 参数 & 路径解析
# ---------------------------------------------------------------------------
HOST="${1:-${SSH_HOST:-ecs}}"
ENV="${ENV:-${2:-prod}}"
case "$ENV" in
  prod)  PORT=8090 ;;
  stage) PORT=8091 ;;
  test)
    echo "错误: test 环境用本地 sqlite,不经本脚本。请本地 go run ./cmd/server。" >&2
    exit 1 ;;
  *)
    echo "错误: ENV 只能是 prod 或 stage(当前: '$ENV')。" >&2
    exit 1 ;;
esac

SSH_OPTS=(-o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=3)
ssh() { command ssh "${SSH_OPTS[@]}" "$@"; }
scp() { command scp "${SSH_OPTS[@]}" "$@"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$(cd "$SERVER_DIR/../web" && pwd)"

command -v go >/dev/null 2>&1 || { echo "错误: 本机未安装 Go,无法交叉编译。" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "错误: 本机未安装 npm,无法构建前端。" >&2; exit 1; }

echo "==> 探测 SSH 连接 $HOST ..."
ssh -o BatchMode=yes "$HOST" 'true' 2>/dev/null || {
  echo "错误: 无法 SSH 连接 '$HOST'。检查 ~/.ssh/config 别名、开机状态、安全组 22 端口。" >&2
  exit 1
}

echo "==> 解析服务器对外 IP ..."
SERVER_IP="$(ssh "$HOST" '
  ip="$(echo "$SSH_CONNECTION" | awk "{print \$3}")"
  case "$ip" in
    ""|10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*|127.*)
      pub="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
      [ -n "$pub" ] && echo "$pub" || echo "$ip" ;;
    *) echo "$ip" ;;
  esac' 2>/dev/null || true)"
DISPLAY_IP="${SERVER_IP:-<服务器IP>}"
echo "    服务器 IP: $DISPLAY_IP"

REMOTE_DIR="/opt/wzq-$ENV"
REMOTE_DATA="$REMOTE_DIR/data"
REMOTE_WEB="$REMOTE_DIR/web"
REMOTE_BIN="$REMOTE_DIR/wzq-server"
REMOTE_CONFIG="$REMOTE_DIR/config.yaml"
REMOTE_ENVFILE="$REMOTE_DIR/.env"
SERVICE="wzq-$ENV"
DB_NAME="wzq_$ENV"
DB_USER="wzq_$ENV"
DB_SECRET_FILE="$REMOTE_DIR/.db_password"
LOCAL_BIN="/tmp/wzq-server-linux"

echo "==> 部署目标: $HOST  (环境: $ENV, 端口: $PORT, 目录: $REMOTE_DIR, 库: $DB_NAME)"

# ---------------------------------------------------------------------------
# 1. 交叉编译 Linux/amd64 纯静态二进制
# ---------------------------------------------------------------------------
echo "==> [1/7] 交叉编译 wzq-server (linux/amd64, CGO_ENABLED=0) ..."
( cd "$SERVER_DIR" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "$LOCAL_BIN" ./cmd/server )
echo "    编译完成: $LOCAL_BIN ($(du -h "$LOCAL_BIN" | cut -f1))"

# ---------------------------------------------------------------------------
# 2. 构建前端(空 VITE_API_BASE -> 相对 /api + 同源 ws)
# ---------------------------------------------------------------------------
echo "==> [2/7] 构建前端 (VITE_API_BASE='') ..."
( cd "$WEB_DIR" && VITE_API_BASE= npm run build >/dev/null )
echo "    前端产物: $WEB_DIR/dist ($(du -sh "$WEB_DIR/dist" | cut -f1))"

# ---------------------------------------------------------------------------
# 3. 确保远端 MariaDB 就绪 + 建库建账号
# ---------------------------------------------------------------------------
echo "==> [3/7] 确保远端 MariaDB 已安装并运行 ..."
ssh "$HOST" 'command -v mariadbd >/dev/null 2>&1 || command -v mysqld >/dev/null 2>&1 || \
  (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server); \
  systemctl enable --now mariadb'

echo "==> [3/7] 确保数据库 $DB_NAME 与账号 $DB_USER 存在 ..."
ssh "$HOST" "mkdir -p '$REMOTE_DIR'"
ssh "$HOST" "
  set -e
  mysql -uroot -e \"CREATE DATABASE IF NOT EXISTS \\\`$DB_NAME\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\"
  if [ ! -f '$DB_SECRET_FILE' ]; then
    PW=\$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
    mysql -uroot -e \"CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '\$PW'; GRANT ALL PRIVILEGES ON \\\`$DB_NAME\\\`.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;\"
    umask 077; printf '%s' \"\$PW\" > '$DB_SECRET_FILE'
    echo '    已生成 DB 账号密码并写入 $DB_SECRET_FILE(仅此一次)。'
  else
    echo '    DB 账号密码已存在,保持不动。'
  fi
"
DB_PW="$(ssh "$HOST" "cat '$DB_SECRET_FILE'")"

# ---------------------------------------------------------------------------
# 4. 专用用户 + 目录 + 上传二进制与前端
# ---------------------------------------------------------------------------
echo "==> [4/7] 创建专用用户 wzq 和目录,上传二进制与前端 ..."
ssh "$HOST" "
  id wzq >/dev/null 2>&1 || useradd --system --home-dir '$REMOTE_DIR' --shell /usr/sbin/nologin wzq
  mkdir -p '$REMOTE_DATA' '$REMOTE_WEB'
"
scp "$LOCAL_BIN" "$HOST:$REMOTE_BIN.new"
ssh "$HOST" "mv '$REMOTE_BIN.new' '$REMOTE_BIN' && chmod +x '$REMOTE_BIN'"
# 前端整目录同步(先清空旧产物避免残留)。用 tar 传输,免依赖 rsync。
ssh "$HOST" "rm -rf '$REMOTE_WEB'/* && mkdir -p '$REMOTE_WEB'"
tar -C "$WEB_DIR/dist" -czf - . | ssh "$HOST" "tar -C '$REMOTE_WEB' -xzf -"
echo "    二进制与前端已上传。"

# ---------------------------------------------------------------------------
# 5. 生成 / 保留 config.yaml 与 .env(仅首次生成,重部署不覆盖)
# ---------------------------------------------------------------------------
echo "==> [5/7] 处理 config.yaml 与 .env ..."
if ssh "$HOST" "test -f '$REMOTE_CONFIG'"; then
  echo "    远端已存在 config.yaml,保持不动(不轮换密钥/DSN)。"
else
  echo "    生成新 config.yaml + .env(随机 auth secret)..."
  GEN_SECRET="$(openssl rand -hex 32)"
  ssh "$HOST" "cat > '$REMOTE_CONFIG'" <<EOF
# wzq $ENV 配置 —— 由 deploy.sh 首次部署生成,重部署不覆盖。
# 如需轮换密钥/DSN,手动编辑后 systemctl restart ${SERVICE}。
addr: ":$PORT"
db:
  driver: mysql
  dsn: "$DB_USER:$DB_PW@tcp(127.0.0.1:3306)/$DB_NAME?charset=utf8mb4&parseTime=true&multiStatements=true"
web:
  dir: "$REMOTE_WEB"
auth:
  authTtlMinutes: 43200
EOF
  ssh "$HOST" "cat > '$REMOTE_ENVFILE'" <<EOF
WZQ_AUTH_SECRET=$GEN_SECRET
EOF
  echo ""
  echo "    ========================================================"
  echo "    !! $ENV 环境首次部署,密钥已生成并写入服务器 !!"
  echo "    auth secret : (已写入 $REMOTE_ENVFILE, chmod600)"
  echo "    DB 账号密码 : (已写入 $DB_SECRET_FILE)"
  echo "    ========================================================"
  echo ""
fi

# ---------------------------------------------------------------------------
# 6. systemd unit + 每日备份 timer,启动服务
# ---------------------------------------------------------------------------
echo "==> [6/7] 安装 systemd unit 并启动 ..."
ssh "$HOST" "cat > /etc/systemd/system/$SERVICE.service" <<EOF
# wzq systemd unit ($ENV) —— 由 deploy.sh 生成。以低权限用户 wzq 运行。
[Unit]
Description=Gomoku (Wuziqi) Server ($ENV)
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=wzq
Group=wzq
WorkingDirectory=$REMOTE_DIR
EnvironmentFile=$REMOTE_ENVFILE
ExecStart=$REMOTE_BIN
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$REMOTE_DIR
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# 每日备份脚本(本地滚动保留 14 天),写到远端 deploy/ 下。
ssh "$HOST" "mkdir -p '$REMOTE_DIR/deploy' '$REMOTE_DIR/backups'"
ssh "$HOST" "cat > '$REMOTE_DIR/deploy/backup-mysql.sh'" <<EOF
#!/usr/bin/env bash
# 每日备份 wzq 数据库到本地(滚动保留 14 天)。由 wzq-backup@$ENV.timer 调用。
set -euo pipefail
DB="$DB_NAME"
OUT="$REMOTE_DIR/backups"
TS="\$(date +%Y%m%d-%H%M%S)"
mysqldump --single-transaction --routines --databases "\$DB" | gzip > "\$OUT/\${DB}-\${TS}.sql.gz"
find "\$OUT" -name "\${DB}-*.sql.gz" -mtime +14 -delete
echo "backup done: \$OUT/\${DB}-\${TS}.sql.gz"
EOF
ssh "$HOST" "chmod +x '$REMOTE_DIR/deploy/backup-mysql.sh'"

ssh "$HOST" "cat > /etc/systemd/system/wzq-backup@.service" <<EOF
# wzq 每日备份(模板,%i=环境名)。
[Unit]
Description=wzq MySQL backup (%i)
After=mariadb.service

[Service]
Type=oneshot
ExecStart=/opt/wzq-%i/deploy/backup-mysql.sh
EOF
ssh "$HOST" "cat > /etc/systemd/system/wzq-backup@.timer" <<EOF
[Unit]
Description=Daily wzq MySQL backup (%i)

[Timer]
OnCalendar=*-*-* 04:17:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 归属 + 权限:config/.env 仅 wzq 可读。
ssh "$HOST" "chown -R wzq:wzq '$REMOTE_DIR'; chmod 600 '$REMOTE_CONFIG' '$REMOTE_ENVFILE' '$DB_SECRET_FILE'"
ssh "$HOST" "systemctl daemon-reload && systemctl enable --now '$SERVICE' && systemctl restart '$SERVICE' && systemctl enable --now 'wzq-backup@$ENV.timer'"

echo "==> 尝试放行主机防火墙 $PORT(若启用 ufw/firewalld)..."
ssh "$HOST" "
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
    ufw allow $PORT/tcp && echo '    ufw 已放行 $PORT';
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port=$PORT/tcp && firewall-cmd --reload && echo '    firewalld 已放行 $PORT';
  else
    echo '    未检测到启用的主机防火墙;请确认云厂商安全组已放行 TCP ${PORT}。';
  fi"

# ---------------------------------------------------------------------------
# 7. 状态 + 自检
# ---------------------------------------------------------------------------
echo "==> [7/7] 服务状态:"
ssh "$HOST" "systemctl status '$SERVICE' --no-pager | head -n 6"
echo ""
echo "==> 部署完成!($ENV 环境)"
echo "    游戏首页   : http://$DISPLAY_IP:$PORT/"
echo "    健康检查   : http://$DISPLAY_IP:$PORT/healthz   (应返回 ok)"
echo "    实时日志   : ssh $HOST 'journalctl -u $SERVICE -f'"
echo "    备份状态   : ssh $HOST 'systemctl list-timers wzq-backup@$ENV.timer'"
echo ""
echo "    别忘了在云厂商安全组放行 TCP $PORT 端口。"
