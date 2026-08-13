#!/usr/bin/env bash
#
# deploy.sh — 从开发机一键部署 wzq 古风五子棋到 ECS。
#
# 本脚本镜像自 ../dubbing/server/deploy/deploy.sh：整体流程、SSH/scp 加固、
# 交叉编译、幂等生成 config.yaml、systemd unit、每日备份 timer 等设计与其一致。
# 下列「实际生产逻辑」应从 dubbing 版对照移植（本文件先落主链路，标注 TODO 处待补齐）：
#   - MySQL/MariaDB 建库建账号：库名 wzq_stage / wzq_prod，应用账号仅 localhost，
#     首次随机生成密码写入 $REMOTE_DIR/.db_password，重部署不覆盖（避免锁库）。
#   - config.yaml「远端不存在才生成」：含随机 WZQ_AUTH_SECRET(openssl rand -hex 32)
#     与 MySQL DSN "wzq_<env>:<pw>@tcp(127.0.0.1:3306)/wzq_<env>?..."，已存在则绝不覆盖。
#   - 每日 mysqldump → TOS 备份 timer（对照 dubbing 的 backup-mysql.sh + @.service/@.timer）。
#
# 环境：stage / prod 两套，同机共存互不干扰：
#   - 目录 /opt/wzq-<env>、端口 stage=8081 / prod=8080、systemd 服务 wzq-<env>。
#   - DB 用 MariaDB，同实例不同库：wzq_stage / wzq_prod。
#   - 服务器不装 Go：开发机交叉编译 Linux/amd64 纯静态二进制（CGO_ENABLED=0，
#     sqlite 用 modernc 纯 Go、mysql 用 go-sql-driver 纯 Go）scp 上去。
#
# 用法：
#   ./server/deploy/deploy.sh                  # 默认 SSH 主机 ecs、默认环境 stage
#   ENV=prod ./server/deploy/deploy.sh          # 部署 prod（端口 8080，库 wzq_prod）
#   ENV=prod ./server/deploy/deploy.sh myhost   # 指定 SSH 主机 + 环境
#   ./server/deploy/deploy.sh myhost stage      # 位置参数：$1=主机 $2=环境
#
set -euo pipefail

# SSH 目标主机：位置参数1 > 环境变量 SSH_HOST > 默认 ecs。
HOST="${1:-${SSH_HOST:-ecs}}"

# 部署环境：环境变量 ENV > 位置参数2 > 默认 stage。端口按环境隔离。
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
# TODO(port from dubbing): 首次生成含随机 WZQ_AUTH_SECRET 与 wzq_<env> 的 MySQL DSN；已存在绝不覆盖。
ssh "$HOST" "test -f $REMOTE_DIR/config.yaml || echo 'placeholder'"  # 实际生成逻辑见 ../dubbing/server/deploy/deploy.sh

echo ">> scp binary + web dist"
scp /tmp/wzq-server "$HOST:$REMOTE_DIR/wzq-server"
rsync -az "$(dirname "$0")/../../web/dist/" "$HOST:/var/www/wzq/"

echo ">> systemd restart"
ssh "$HOST" "sudo systemctl restart wzq-$ENV"

echo "deployed $ENV on $HOST:$PORT"
