package endgame

import (
	"database/sql"

	"github.com/wzq/gomoku/internal/store"
	"github.com/wzq/gomoku/internal/user"
)

// Service 提供残局闯关的查询、判定与进度记录能力。
type Service struct {
	s     *store.Store
	users *user.Service
}

// New 构造残局服务。
func New(s *store.Store, users *user.Service) *Service {
	return &Service{s: s, users: users}
}

// LevelMeta 是关卡列表项，合并了该用户的进度信息（不含局面细节与答案）。
type LevelMeta struct {
	ID         string `json:"id"`
	Chapter    int    `json:"chapter"`
	Name       string `json:"name"`
	Difficulty int    `json:"difficulty"`
	Passed     bool   `json:"passed"`
	Attempts   int    `json:"attempts"`
}

// LevelDetail 是单关的可展示详情（含初始局面，但不含答案）。
type LevelDetail struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Difficulty int     `json:"difficulty"`
	Stones     []Stone `json:"stones"`
	ToMove     string  `json:"toMove"`
	Kind       string  `json:"kind"`
}

// findLevel 按 ID 线性查找关卡。
func findLevel(id string) (*Level, bool) {
	for i := range Levels {
		if Levels[i].ID == id {
			return &Levels[i], true
		}
	}
	return nil, false
}

// List 返回全部关卡元信息，合并该用户的进度（通关状态与尝试次数）。
func (svc *Service) List(uid int64) []LevelMeta {
	out := make([]LevelMeta, 0, len(Levels))
	for i := range Levels {
		l := &Levels[i]
		m := LevelMeta{ID: l.ID, Chapter: l.Chapter, Name: l.Name, Difficulty: l.Difficulty}
		var passed, attempts int
		err := svc.s.DB.QueryRow(
			`SELECT passed, attempts FROM endgame_progress WHERE uid=? AND level_id=?`, uid, l.ID).
			Scan(&passed, &attempts)
		if err == nil {
			m.Passed = passed != 0
			m.Attempts = attempts
		}
		out = append(out, m)
	}
	return out
}

// Detail 返回指定关卡的可展示详情；不存在则返回 false。
func (svc *Service) Detail(id string) (*LevelDetail, bool) {
	l, ok := findLevel(id)
	if !ok {
		return nil, false
	}
	return &LevelDetail{
		ID:         l.ID,
		Name:       l.Name,
		Difficulty: l.Difficulty,
		Stones:     l.Stones,
		ToMove:     string(l.ToMove),
		Kind:       l.Kind,
	}, true
}

// Answer 返回指定关卡全部可接受落子（看答案）。
func (svc *Service) Answer(id string) [][2]int {
	l, ok := findLevel(id)
	if !ok {
		return nil
	}
	return l.AcceptedAnswers()
}

// readProgress 读取某用户某关的进度行；不存在时返回 exists=false。
func (svc *Service) readProgress(uid int64, id string) (passed, attempts, hints int, exists bool, err error) {
	err = svc.s.DB.QueryRow(
		`SELECT passed, attempts, hints FROM endgame_progress WHERE uid=? AND level_id=?`, uid, id).
		Scan(&passed, &attempts, &hints)
	if err == sql.ErrNoRows {
		return 0, 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, 0, false, err
	}
	return passed, attempts, hints, true, nil
}

// Submit 判定 (x,y) 是否为该关可接受落子；记录 attempts；首次通关置 passed 并奖励经验(+10)。
func (svc *Service) Submit(uid int64, id string, x, y int) (correct bool, err error) {
	l, ok := findLevel(id)
	if !ok {
		return false, sql.ErrNoRows
	}
	// 判定正确性。
	for _, a := range l.AcceptedAnswers() {
		if a[0] == x && a[1] == y {
			correct = true
			break
		}
	}
	// 读-改-写进度，兼容 sqlite 与 mysql。
	passed, attempts, hints, exists, err := svc.readProgress(uid, id)
	if err != nil {
		return correct, err
	}
	firstPass := correct && passed == 0 // 本次是否为首次通关。
	newPassed := passed
	if correct {
		newPassed = 1
	}
	if !exists {
		_, err = svc.s.DB.Exec(
			`INSERT INTO endgame_progress (uid, level_id, passed, attempts, hints) VALUES (?,?,?,?,?)`,
			uid, id, newPassed, 1, 0)
	} else {
		_, err = svc.s.DB.Exec(
			`UPDATE endgame_progress SET passed=?, attempts=? WHERE uid=? AND level_id=?`,
			newPassed, attempts+1, uid, id)
	}
	if err != nil {
		return correct, err
	}
	_ = hints
	// 首次通关奖励经验。
	if firstPass {
		if err = svc.users.AddExp(uid, 10); err != nil {
			return correct, err
		}
	}
	return correct, nil
}

// Hint 返回一个可接受落子并累加该用户该关的 hints 计数；无可接受落子时返回 nil。
func (svc *Service) Hint(uid int64, id string) (*[2]int, error) {
	l, ok := findLevel(id)
	if !ok {
		return nil, sql.ErrNoRows
	}
	answers := l.AcceptedAnswers()
	// 读-改-写 hints 计数。
	_, attempts, hints, exists, err := svc.readProgress(uid, id)
	if err != nil {
		return nil, err
	}
	if !exists {
		_, err = svc.s.DB.Exec(
			`INSERT INTO endgame_progress (uid, level_id, passed, attempts, hints) VALUES (?,?,?,?,?)`,
			uid, id, 0, 0, 1)
	} else {
		_, err = svc.s.DB.Exec(
			`UPDATE endgame_progress SET hints=? WHERE uid=? AND level_id=?`,
			hints+1, uid, id)
	}
	if err != nil {
		return nil, err
	}
	_ = attempts
	if len(answers) == 0 {
		return nil, nil
	}
	cell := answers[0]
	return &cell, nil
}
