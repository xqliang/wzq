import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createRoom } from '../net/rest'

// 好友对战房间页：建房者创建房间号并展示邀请链接；点击进入对局。
// 注意：本页不建立 WebSocket 连接，实际连线由 Game 页统一负责（避免双连接）。
// 建房者与加入者都进入 /game，服务端按连接先后分配黑/白，Game 页通过 start 消息获知颜色。
export function Room() {
  const { id } = useParams()
  const nav = useNavigate()
  const [roomId, setRoomId] = useState(id ?? '')
  const [err, setErr] = useState('')

  useEffect(() => {
    // 无 :id 说明是发起方，创建新房间；带 :id 则是通过邀请链接加入。
    if (id) {
      setRoomId(id)
      return
    }
    createRoom()
      .then((r) => setRoomId(r.roomId))
      .catch((e) => setErr(String(e)))
  }, [id])

  const inviteUrl = roomId ? `${location.origin}/room/${roomId}` : ''

  return (
    <div className="room screen">
      <h2>好友对战</h2>
      {err && <p className="warn">创建房间失败：{err}</p>}
      <p>房间号：{roomId || '创建中…'}</p>
      {inviteUrl && <p className="invite">邀请链接：{inviteUrl}</p>}
      <button disabled={!inviteUrl} onClick={() => navigator.clipboard?.writeText(inviteUrl)}>
        复制邀请链接
      </button>
      <button
        disabled={!roomId}
        onClick={() => nav('/game', { state: { mode: 'pvp', roomId } })}
      >
        进入对局
      </button>
      <button onClick={() => nav('/')}>退出</button>
    </div>
  )
}
