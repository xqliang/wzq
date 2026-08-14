// 回合倒计时的纯计算：由截止时刻与当前时刻算出剩余秒、紧迫等级、进度比例。
// 供 Game 计时 effect 与 CompassTimer 罗盘共用，避免各处重复取整/分级逻辑。
export type CountdownLevel = 'normal' | 'warn' | 'danger'

export interface CountdownState {
  remain: number // 剩余整秒（四舍五入后钳制到 0..total）
  level: CountdownLevel // >10 normal；(5,10] warn；(0,5] danger（0 归 danger）
  progress: number // 剩余比例 0..1，用于罗盘弧
}

export function countdownState(deadlineMs: number, nowMs: number, total = 30): CountdownState {
  // 与 Game 原有 setInterval 内的取整方式保持一致（四舍五入），再钳制到 0..total 区间。
  const remain = Math.max(0, Math.min(total, Math.round((deadlineMs - nowMs) / 1000)))
  const level: CountdownLevel = remain > 10 ? 'normal' : remain > 5 ? 'warn' : 'danger'
  const progress = total > 0 ? remain / total : 0
  return { remain, level, progress }
}
