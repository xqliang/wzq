package room

// ClientMsg 是客户端 -> 服务端的消息（落子/悔棋请求/悔棋应答/认输）。
type ClientMsg struct {
	Type  string `json:"type"`
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Agree bool   `json:"agree"`
	Steps int    `json:"steps"` // 悔棋请求：撤销手数
	Text  string `json:"text"`  // 表情/快捷语：预制文本或表情符号
}

// ServerMsg 是服务端 -> 客户端的消息（房间状态/开局/落子/回合/结束/悔棋结果/表情）。
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
	Text     string `json:"text,omitempty"` // 表情/快捷语内容（客户端据此在发送者头像下方展示）
	// 开局下发对手资料，供对阵条/结算展示真实段位/头像/头像框，以及按落子方渲染对手落子特效。
	OppTier   int    `json:"oppTier,omitempty"`
	OppAvatar string `json:"oppAvatar,omitempty"`
	OppFrame  string `json:"oppFrame,omitempty"`
	OppEffect string `json:"oppEffect,omitempty"`
}
