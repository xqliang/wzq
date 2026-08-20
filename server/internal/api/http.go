// Package api 提供 HTTP REST 接口与 WebSocket 入口，装配用户、鉴权、房间与棋谱能力。
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/daily"
	"github.com/wzq/gomoku/internal/endgame"
	"github.com/wzq/gomoku/internal/rank"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
	"github.com/wzq/gomoku/internal/shop"
	"github.com/wzq/gomoku/internal/user"
)

// Server 聚合各业务服务，作为 HTTP 处理器的依赖容器。
type Server struct {
	Users         *user.Service
	Auth          *auth.Manager
	Hub           *room.Hub
	Records       *record.Service
	Endgame       *endgame.Service
	Shop          *shop.Service
	Daily         *daily.Service
	DailyAiWinCap int
	WebDir        string // 前端构建产物目录；为空则不托管前端（仅提供 API）。
	AdminPassword string // 运营后台登录口令。
}

// writeJSON 以 JSON 形式写出响应体。
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

// uidFrom 从请求解析用户 ID：优先 Authorization Bearer，其次 ?token= 查询参数。
func (s *Server) uidFrom(r *http.Request) (int64, error) {
	tok := ""
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		tok = strings.TrimPrefix(h, "Bearer ")
	}
	if tok == "" {
		tok = r.URL.Query().Get("token")
	}
	sub, err := s.Auth.Verify(tok)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(sub, 10, 64)
}

// cors 包裹处理器，允许任意来源并放行预检请求。
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Routes 注册全部路由并套上 CORS 中间件。
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/guest", s.handleGuest)
	mux.HandleFunc("/api/me", s.handleMe)
	mux.HandleFunc("/api/bind", s.handleBind)
	mux.HandleFunc("/api/login", s.handleLogin)
	mux.HandleFunc("/api/ai/result", s.handleAiResult)
	mux.HandleFunc("/api/me/stats", s.handleMyStats)
	mux.HandleFunc("/api/share", s.handleShare)
	mux.HandleFunc("/api/room", s.handleRoom)
	mux.HandleFunc("/api/match", s.handleMatch)
	mux.HandleFunc("/api/match/cancel", s.handleMatchCancel)
	mux.HandleFunc("/api/shop", s.handleShop)
	mux.HandleFunc("/api/shop/buy", s.handleShopBuy)
	mux.HandleFunc("/api/shop/equip", s.handleShopEquip)
	mux.HandleFunc("/api/shop/expired", s.handleShopExpired)
	mux.HandleFunc("/api/checkin", s.handleCheckin)
	mux.HandleFunc("/api/checkin/claim", s.handleCheckinClaim)
	mux.HandleFunc("/api/wheel", s.handleWheel)
	mux.HandleFunc("/api/wheel/spin", s.handleWheelSpin)
	mux.HandleFunc("/api/reward/adbonus", s.handleAdBonus)
	mux.HandleFunc("/api/endgame/levels", s.handleEndgameLevels)
	mux.HandleFunc("/api/endgame/level", s.handleEndgameLevel)
	mux.HandleFunc("/api/endgame/submit", s.handleEndgameSubmit)
	mux.HandleFunc("/api/endgame/complete", s.handleEndgameComplete)
	mux.HandleFunc("/api/endgame/hint", s.handleEndgameHint)
	mux.HandleFunc("/api/endgame/answer", s.handleEndgameAnswer)
	mux.HandleFunc("/api/admin/login", s.handleAdminLogin)
	mux.HandleFunc("/api/admin/overview", s.handleAdminOverview)
	mux.HandleFunc("/api/admin/users", s.handleAdminUsers)
	mux.HandleFunc("/api/admin/games", s.handleAdminGames)
	mux.HandleFunc("/ws", s.handleWS)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	// 托管前端：静态文件命中则直出，未命中回退 index.html（支持前端路由 /room/:id 等）。
	if s.WebDir != "" {
		mux.Handle("/", spaHandler(s.WebDir))
	}
	return cors(mux)
}

// spaHandler 服务单页应用：存在的静态文件按原样返回，其余路径回退到 index.html。
// 缓存策略：带 hash 的构建产物(js/css)长期不可变缓存；固定名素材(图片/音频/字体)与
// index.html 用 no-cache 每次校验，避免重新部署后浏览器/CDN 仍显示旧素材。
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			setStaticCache(w, r.URL.Path)
			fs.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	})
}

// setStaticCache 设置缓存头：除 index.html 外，前端资源均带内容 hash（Vite 产出），
// 可长期不可变缓存；html 用 no-cache 每次校验，从而始终拉到引用了最新 hash 的入口。
func setStaticCache(w http.ResponseWriter, path string) {
	if strings.HasSuffix(strings.ToLower(path), ".html") {
		w.Header().Set("Cache-Control", "no-cache")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
}

// handleGuest 创建游客并签发令牌。
func (s *Server) handleGuest(w http.ResponseWriter, r *http.Request) {
	u, err := s.Users.CreateGuest()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	tok, err := s.Auth.Issue(strconv.FormatInt(u.ID, 10))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": tok, "user": u})
}

// handleMe 返回当前登录用户信息。
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	u, err := s.Users.Get(uid)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// handleBind 为当前用户绑定用户名与密码。
func (s *Server) handleBind(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := s.Users.Bind(uid, body.Username, body.Password); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleLogin 按用户名密码登录并签发令牌。
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	u, err := s.Users.Login(body.Username, body.Password)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "auth failed"})
		return
	}
	tok, err := s.Auth.Issue(strconv.FormatInt(u.ID, 10))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": tok, "user": u})
}

// handleAiResult 结算与 AI 对局的经验：负局固定 +5；胜局在每日配额内 +20，超额 +0。
func (s *Server) handleAiResult(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Level int  `json:"level"`
		Win   bool `json:"win"`
		Moves int  `json:"moves"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	delta := 5
	if body.Win {
		if s.Users.AllowAiWinExp(uid, s.DailyAiWinCap) {
			delta = 20
		} else {
			delta = 0
		}
	}
	if err := s.Users.AddExp(uid, delta); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	// 落库人机战绩：玩家恒为黑方，胜则 winner=black，负则 white。落库失败不影响经验结算。
	winnerStr := "white"
	if body.Win {
		winnerStr = "black"
	}
	if _, err := s.Records.Save(record.Game{
		Mode: "ai", AILevel: body.Level, BlackUID: uid, WhiteUID: 0,
		Winner: winnerStr, Moves: body.Moves, EndReason: "ai", CreatedAt: time.Now(),
	}); err != nil {
		log.Printf("save ai record: %v", err)
	}
	// 段位结算（阶段B）：AI 对局同样计入段位（胜 +10 / 负 -10）。
	rankDelta := rank.LossDelta
	if body.Win {
		rankDelta = rank.WinDelta
	}
	rk, err := s.Users.SettleRank(uid, body.Win)
	if err != nil {
		log.Printf("settle ai rank: %v", err)
	}
	// 金币奖励（阶段C）：负 +5；胜按难度给金币（普通20 / 中级75 / 高级150）。
	coinDelta := 5
	if body.Win {
		switch body.Level {
		case 2:
			coinDelta = 75
		case 3:
			coinDelta = 150
		default:
			coinDelta = 20
		}
	}
	if err := s.Users.AddCoins(uid, coinDelta); err != nil {
		log.Printf("award ai coins: %v", err)
	}
	u, _ := s.Users.Get(uid)
	writeJSON(w, http.StatusOK, map[string]any{
		"expDelta":  delta,
		"coinDelta": coinDelta,
		"user":      u,
		"rank": map[string]any{
			"tier":      rk.Tier,
			"points":    rk.Points,
			"threshold": rank.Threshold(rk.Tier),
			"delta":     rankDelta,
			"promoted":  rk.Promoted,
			"demoted":   rk.Demoted,
		},
	})
}

// SettlePvP 结算一局真人对战：给胜者 +20、负者 +5 经验，并落库战绩。
// 平局或异常（Winner==0）时跳过。落库失败仅记录日志，不影响经验结算。
func (s *Server) SettlePvP(g room.GameOver) {
	if g.Winner == 0 {
		return
	}
	loser := g.Black
	if g.Winner == g.Black {
		loser = g.White
	}
	if err := s.Users.AddExp(g.Winner, 20); err != nil {
		log.Printf("settle pvp winner exp: %v", err)
	}
	if loser != 0 {
		if err := s.Users.AddExp(loser, 5); err != nil {
			log.Printf("settle pvp loser exp: %v", err)
		}
	}
	// 段位结算（阶段B）：胜者 +10、负者 -10。客户端在收到 game_over 后重新拉取 /api/me 获取新段位。
	if _, err := s.Users.SettleRank(g.Winner, true); err != nil {
		log.Printf("settle pvp winner rank: %v", err)
	}
	if loser != 0 {
		if _, err := s.Users.SettleRank(loser, false); err != nil {
			log.Printf("settle pvp loser rank: %v", err)
		}
	}
	// 金币奖励（阶段C）：真人对局胜 +60、负 +10。
	if err := s.Users.AddCoins(g.Winner, 60); err != nil {
		log.Printf("award pvp winner coins: %v", err)
	}
	if loser != 0 {
		if err := s.Users.AddCoins(loser, 10); err != nil {
			log.Printf("award pvp loser coins: %v", err)
		}
	}
	winnerStr := "white"
	if g.Winner == g.Black {
		winnerStr = "black"
	}
	if _, err := s.Records.Save(record.Game{
		Mode: "pvp", BlackUID: g.Black, WhiteUID: g.White,
		Winner: winnerStr, Moves: g.Moves, EndReason: g.Reason, CreatedAt: time.Now(),
	}); err != nil {
		log.Printf("save pvp record: %v", err)
	}
}

// handleMyStats 返回当前用户的战绩统计与用户信息（需鉴权）。
func (s *Server) handleMyStats(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	st, err := s.Records.StatsFor(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	u, err := s.Users.Get(uid)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stats": st, "user": u})
}

// handleShare 返回某用户的公开炫耀视图（无需鉴权）：昵称、等级、胜场、连胜、总局数。
func (s *Server) handleShare(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.ParseInt(r.URL.Query().Get("uid"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad uid"})
		return
	}
	u, err := s.Users.Get(uid)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	st, err := s.Records.StatsFor(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"nickname": u.Nickname,
		"level":    u.Level,
		"wins":     st.Wins,
		"streak":   st.Streak,
		"total":    st.Total,
	})
}

// handleRoom 创建房间并返回房间号。
func (s *Server) handleRoom(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	id := s.Hub.Create(uid)
	writeJSON(w, http.StatusOK, map[string]string{"roomId": id})
}

// handleMatch 随机匹配：将玩家投入匹配池（不为独自等待者预建房间）。
// 返回 {waiting:true, roomId:""} 表示尚未配到对手，前端应继续轮询本接口；
// 返回 {waiting:false, roomId:"xxxx"} 表示已与他人配对成功，连入该房间即可对局。
func (s *Server) handleMatch(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	rid, waiting := s.Hub.Match(uid)
	writeJSON(w, http.StatusOK, map[string]any{"roomId": rid, "waiting": waiting})
}

// handleMatchCancel 退出随机匹配池（用户离开匹配界面 / 点取消时调用）。
func (s *Server) handleMatchCancel(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	s.Hub.CancelMatch(uid)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleShop 返回商店状态：余额、已装备、带拥有/装备标记的商品列表。
func (s *Server) handleShop(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	st, err := s.Shop.State(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// handleShopBuy 购买商品（body: {slot,id}）。返回购买后的最新商店状态。
func (s *Server) handleShopBuy(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Slot string `json:"slot"`
		ID   string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := s.Shop.Buy(uid, body.Slot, body.ID); err != nil {
		writeJSON(w, shopErrStatus(err), map[string]string{"error": err.Error()})
		return
	}
	st, _ := s.Shop.State(uid)
	writeJSON(w, http.StatusOK, st)
}

// handleShopEquip 装备已拥有商品（body: {slot,id}）。返回最新商店状态。
func (s *Server) handleShopEquip(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Slot string `json:"slot"`
		ID   string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := s.Shop.Equip(uid, body.Slot, body.ID); err != nil {
		writeJSON(w, shopErrStatus(err), map[string]string{"error": err.Error()})
		return
	}
	st, _ := s.Shop.State(uid)
	writeJSON(w, http.StatusOK, st)
}

// handleShopExpired 检查当前用户已装备外观是否已超过 7 天有效期，并将失效项回退为基础款。
// 返回本次失效项列表 {slot,name}（为空表示无失效）；前端据此在打开游戏时弹窗提示。
func (s *Server) handleShopExpired(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	expired, err := s.Shop.ExpireEquipped(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	// 预置空切片，保证 JSON 为 [] 而非 null。
	if expired == nil {
		expired = []shop.ExpiredItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": expired})
}
func shopErrStatus(err error) int {
	switch err {
	case shop.ErrNotFound, shop.ErrBadSlot:
		return http.StatusNotFound
	case shop.ErrInsufficient, shop.ErrOwned, shop.ErrNotOwned:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

// handleCheckin 返回每日签到面板状态。
func (s *Server) handleCheckin(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, s.Daily.CheckinState(uid))
}

// handleCheckinClaim 领取今日签到（body: {double}）。返回奖励与最新余额。
func (s *Server) handleCheckinClaim(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Double bool `json:"double"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	reward, err := s.Daily.Claim(uid, body.Double)
	if err == daily.ErrClaimed {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "already claimed"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	u, _ := s.Users.Get(uid)
	writeJSON(w, http.StatusOK, map[string]any{"reward": reward, "coins": u.Coins, "scrolls": u.Scrolls, "state": s.Daily.CheckinState(uid)})
}

// handleWheel 返回转盘奖池、单次消耗与当前余额。
func (s *Server) handleWheel(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	u, _ := s.Users.Get(uid)
	writeJSON(w, http.StatusOK, map[string]any{"prizes": s.Daily.Prizes(), "cost": daily.WheelCost, "coins": u.Coins, "scrolls": u.Scrolls})
}

// handleWheelSpin 抽奖一次（扣金币、发奖），返回命中扇区与最新余额。
func (s *Server) handleWheelSpin(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	out, err := s.Daily.Spin(uid)
	if err == daily.ErrInsufficient {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "insufficient coins"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// handleAdBonus 模拟「看广告双倍」：发放一笔奖励金币并返回最新余额。
// 这是运营模拟（真实场景应由广告 SDK 回调校验）；此处对单次发放设上限防刷。
func (s *Server) handleAdBonus(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		Coins int `json:"coins"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	bonus := body.Coins
	if bonus < 0 {
		bonus = 0
	}
	if bonus > 60 { // 反作弊：单次看广告翻倍上限（不超过 PvP 胜局奖励）
		bonus = 60
	}
	if err := s.Users.AddCoins(uid, bonus); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	u, _ := s.Users.Get(uid)
	writeJSON(w, http.StatusOK, map[string]any{"granted": bonus, "coins": u.Coins})
}

// handleWS 升级为 WebSocket 并接入房间；令牌通过 ?token= 传入。
func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	s.Hub.ServeWS(w, r, r.URL.Query().Get("room"), uid)
}

// handleEndgameLevels 返回全部残局关卡及当前用户进度。
func (s *Server) handleEndgameLevels(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, s.Endgame.List(uid))
}

// handleEndgameLevel 返回单关详情（不含答案）；?id= 指定关卡。
func (s *Server) handleEndgameLevel(w http.ResponseWriter, r *http.Request) {
	if _, err := s.uidFrom(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	d, ok := s.Endgame.Detail(r.URL.Query().Get("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// handleEndgameSubmit 判定一次落子并返回是否正确。
func (s *Server) handleEndgameSubmit(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		ID string `json:"id"`
		X  int    `json:"x"`
		Y  int    `json:"y"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	correct, err := s.Endgame.Submit(uid, body.ID, body.X, body.Y)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"correct": correct})
}

// handleEndgameComplete 记录一次完整「接着下」闯关结果（胜/负），并结算经验与进度。
func (s *Server) handleEndgameComplete(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		ID  string `json:"id"`
		Win bool   `json:"win"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := s.Endgame.Complete(uid, body.ID, body.Win); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleEndgameHint 返回一个可接受落子并累加提示计数。
func (s *Server) handleEndgameHint(w http.ResponseWriter, r *http.Request) {
	uid, err := s.uidFrom(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	line, err := s.Endgame.Hint(uid, body.ID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if line == nil {
		writeJSON(w, http.StatusOK, map[string]any{"line": nil})
		return
	}
	// 返回完整逼杀线（执子方各手坐标），前端按序号标出。
	writeJSON(w, http.StatusOK, map[string]any{"line": line})
}

// handleEndgameAnswer 返回该关全部可接受落子（看答案）；?id= 指定关卡。
func (s *Server) handleEndgameAnswer(w http.ResponseWriter, r *http.Request) {
	if _, err := s.uidFrom(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"answers": s.Endgame.Answer(r.URL.Query().Get("id"))})
}

// isAdmin 判断请求是否携带有效的后台令牌（subject=="admin"）。
// 令牌复用 s.Auth，与用户令牌区分仅靠 subject。优先 Bearer，其次 ?token=。
func (s *Server) isAdmin(r *http.Request) bool {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if tok == "" {
		tok = r.URL.Query().Get("token")
	}
	sub, err := s.Auth.Verify(tok)
	return err == nil && sub == "admin"
}

// handleAdminLogin 校验后台口令并签发 subject=="admin" 的令牌。
func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if body.Password == "" || body.Password != s.AdminPassword {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	tok, err := s.Auth.Issue("admin")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": tok})
}

// handleAdminOverview 返回后台概览指标；单项查询失败按 0 处理（尽力而为，不整体 500）。
func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	users, _ := s.Users.Count()
	// 今日新增：以本地当日 00:00:00 为界。
	todayStart := time.Now().Format("2006-01-02") + " 00:00:00"
	todayNew, _ := s.Users.CountSince(todayStart)
	gamesAI, gamesPvP, _ := s.Records.TotalGames()
	passes, _ := s.Records.EndgamePasses()
	writeJSON(w, http.StatusOK, map[string]any{
		"users":         users,
		"todayNewUsers": todayNew,
		"gamesAI":       gamesAI,
		"gamesPvP":      gamesPvP,
		"endgamePasses": passes,
	})
}

// adminLimit 解析 ?limit= 查询参数，缺省 50，范围 [1,500]。
func adminLimit(r *http.Request) int {
	limit := 50
	if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > 500 {
		limit = 500
	}
	return limit
}

// handleAdminUsers 返回最近注册的用户列表（需后台令牌）。
func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	users, err := s.Users.Recent(adminLimit(r))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, users)
}

// handleAdminGames 返回最近的对局记录（需后台令牌）。
func (s *Server) handleAdminGames(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	games, err := s.Records.RecentGames(adminLimit(r))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, games)
}
