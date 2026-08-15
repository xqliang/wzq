package room

// ClientMsg 是客户端 -> 服务端的消息（落子/悔棋请求/悔棋应答/认输）。
type ClientMsg struct {
	Type  string `json:"type"`
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Agree bool   `json:"agree"`
}

// ServerMsg 是服务端 -> 客户端的消息（房间状态/开局/落子/回合/结束/悔棋结果）。
type ServerMsg struct {
	Type     string `json:"type"`
	Color    string `json:"color,omitempty"`
	UID      int64  `json:"uid,omitempty"`
	X        int    `json:"x,omitempty"`
	Y        int    `json:"y,omitempty"`
	Seq      int    `json:"seq,omitempty"`
	Deadline int64  `json:"deadline,omitempty"`
	Winner   int64  `json:"winner,omitempty"`
	Reason   string `json:"reason,omitempty"`
	Agree    bool   `json:"agree,omitempty"`
	N        int    `json:"n,omitempty"` // 悔棋撤销的手数（客户端据此回退同步）
	Players  int    `json:"players,omitempty"`
}
