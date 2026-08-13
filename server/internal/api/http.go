// Package api 提供 HTTP REST 接口与 WebSocket 入口，装配用户、鉴权、房间与棋谱能力。
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/endgame"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
	"github.com/wzq/gomoku/internal/user"
)

// Server 聚合各业务服务，作为 HTTP 处理器的依赖容器。
type Server struct {
	Users         *user.Service
	Auth          *auth.Manager
	Hub           *room.Hub
	Records       *record.Service
	Endgame       *endgame.Service
	DailyAiWinCap int
	WebDir        string // 前端构建产物目录；为空则不托管前端（仅提供 API）。
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
	mux.HandleFunc("/api/room", s.handleRoom)
	mux.HandleFunc("/api/endgame/levels", s.handleEndgameLevels)
	mux.HandleFunc("/api/endgame/level", s.handleEndgameLevel)
	mux.HandleFunc("/api/endgame/submit", s.handleEndgameSubmit)
	mux.HandleFunc("/api/endgame/hint", s.handleEndgameHint)
	mux.HandleFunc("/api/endgame/answer", s.handleEndgameAnswer)
	mux.HandleFunc("/ws", s.handleWS)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	// 托管前端：静态文件命中则直出，未命中回退 index.html（支持前端路由 /room/:id 等）。
	if s.WebDir != "" {
		mux.Handle("/", spaHandler(s.WebDir))
	}
	return cors(mux)
}

// spaHandler 服务单页应用：存在的静态文件按原样返回，其余路径回退到 index.html。
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, index)
	})
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
	u, _ := s.Users.Get(uid)
	writeJSON(w, http.StatusOK, map[string]any{"expDelta": delta, "user": u})
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
	cell, err := s.Endgame.Hint(uid, body.ID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if cell == nil {
		writeJSON(w, http.StatusOK, map[string]any{"cell": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cell": cell, "x": cell[0], "y": cell[1]})
}

// handleEndgameAnswer 返回该关全部可接受落子（看答案）；?id= 指定关卡。
func (s *Server) handleEndgameAnswer(w http.ResponseWriter, r *http.Request) {
	if _, err := s.uidFrom(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"answers": s.Endgame.Answer(r.URL.Query().Get("id"))})
}
