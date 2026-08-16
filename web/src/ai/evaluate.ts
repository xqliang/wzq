import type { Board, Color } from '../core/types'
import { SIZE } from '../core/types'

// 四个基本方向：水平、垂直、正斜、反斜（拆成两个平行数组以省去取 `[dx, dy]` 的开销）
const DXS = [1, 0, 1, 1]
const DYS = [0, 1, 1, -1]

// 棋型分值：拉开量级，让“先手连杀 / 封堵关键威胁”的优先级远高于普通出子。
// 五连 > 活四 > 冲四 > 活三 > 眠三 > 活二 > 眠二
const SCORE = {
  FIVE: 10_000_000, // 连五（已胜/一步可胜）
  LIVE_FOUR: 500_000, // 活四：双端皆空，对手无法阻止
  RUSH_FOUR: 100_000, // 冲四：仅一端可成五，逼对手应
  LIVE_THREE: 5_000, // 活三：可发展为活四
  SLEEP_THREE: 1_000, // 眠三：仅一端可发展
  DEAD_FOUR: 500, // 两端堵死的四，基本无价值
  LIVE_TWO: 500, // 活二
  SLEEP_TWO: 100, // 眠二
  SINGLE: 10, // 孤立一子（避免空盘时全零、无法排序）
} as const

// 分叉加成：同一方同时存在 ≥2 个“活威胁”（三/四/五）时，说明对手一次只能堵一个，
// 是必胜的连杀结构（双三、四三、双四…），价值直逼活四。
const FORK = 250_000

// 防御加权：对方威胁略高估，让 AI 偏向防守（可调）。
// 注意：必须保持 1.0——任何 >1 的偏置都会让 Lv3(深度6) 在镜像对局里退化成互相封堵、
// 拖到填盘（既成和棋又让搜索在满盘时节点爆炸、奇慢）。深层搜索本身已能自然处理防守。
const DEFENSE = 1.0

// 统计 color 全盘的威胁总分。
//
// 方法：沿四个方向滑动长度 5 的窗口；只统计“窗口起点恰好是该色棋子、且起点前一格不是同色”的窗口，
// 即以每段棋型的左端为锚点，避免同一条线上的同一棋型被重复计分。
// 窗口内的空位天然支持跳三/跳四等带间隔棋型；两端开放性按该色棋子的实际首末子外侧一格计算，
// 据此区分活/眠（冲四 `X_XXX`、活三 `_XXX_`、跳三 `_X_XX_` 等均能被正确识别）。
//
// 注意：本函数在搜索里会被调用数十万次（多数用于走法排序），
// 因此完全内联（不做子函数调用、尽量少做数组/乘法运算），是整盘棋的性能热点。
function colorScore(board: Board, color: Color): number {
  const S = SIZE
  const b = board
  let score = 0
  let threats = 0 // 活威胁（三/四/五）数量，用于分叉加成
  for (let y = 0; y < S; y++) {
    const row = b[y]
    for (let x = 0; x < S; x++) {
      if (row[x] !== color) continue
      for (let d = 0; d < 4; d++) {
        const dx = DXS[d], dy = DYS[d]
        // 锚点：起点前一格不是同色，否则交由更靠左的起点统计
        const px = x - dx, py = y - dy
        if (px >= 0 && py >= 0 && px < S && py < S && b[py][px] === color) continue
        // 窗口必须完整落在棋盘内（窗口内五格已保证不越界）
        const ex = x + dx * 4, ey = y + dy * 4
        if (ex < 0 || ey < 0 || ex >= S || ey >= S) continue
        // 扫描窗口：cnt(同色数)、opp(对方数)、ls(最后一个同色子的相对位置)
        let cnt = 1, opp = 0, ls = 0
        let nx = x + dx, ny = y + dy
        for (let k = 1; k < 5; k++) {
          const c = b[ny][nx]
          if (c === color) {
            cnt++
            ls = k
          } else if (c !== null) {
            opp++
          }
          nx += dx
          ny += dy
        }
        // 窗口内混入对方棋子 => 不可能连成五，跳过
        if (opp > 0) continue
        // 两端开放性：起点前一格（必非同色，只可能是空/被堵）与末子后一格
        const openL = px >= 0 && py >= 0 && px < S && py < S && b[py][px] === null
        const rx = x + (ls + 1) * dx, ry = y + (ls + 1) * dy
        const openR = rx >= 0 && ry >= 0 && rx < S && ry < S && b[ry][rx] === null
        // 棋型分值（内联分类）
        if (cnt >= 5) {
          score += SCORE.FIVE
          threats++
        } else if (cnt === 4) {
          // 只有“连四”（ls===3，4 子紧邻）才可能是活四；跳四（ls===4，如 X_XXX、
          // XX_XX、XXX_X）中间有一个缺口，无论两端开合都只有“补缺口”一个成五点，
          // 是冲四而非活四——对手一手即可封死，不能按活四计分。
          if (ls === 3) {
            if (openL && openR) {
              score += SCORE.LIVE_FOUR
              threats++
            } else if (openL || openR) {
              score += SCORE.RUSH_FOUR
              threats++
            } else {
              score += SCORE.DEAD_FOUR
            }
          } else {
            score += SCORE.RUSH_FOUR
            threats++
          }
        } else if (cnt === 3) {
          // 只有“连三”（ls===2）或“单缺口三”（ls===3，如 XX_X / X_XX，补缺口即成活四）
          // 才是真正的活三；双缺口三（ls===4，如 X_X_X / X__XX）补任一缺口只得到可被
          // 一手堵死的冲四，并非必须应的活威胁，按眠三计且不计入分叉。
          if (ls === 4) {
            score += SCORE.SLEEP_THREE
          } else if (openL && openR) {
            score += SCORE.LIVE_THREE
            threats++
          } else if (openL || openR) {
            // 眠三不构成“必须应”的威胁，不计入分叉
            score += SCORE.SLEEP_THREE
          }
        } else if (cnt === 2) {
          if (openL && openR) score += SCORE.LIVE_TWO
          else if (openL || openR) score += SCORE.SLEEP_TWO
        } else if (openL && openR) {
          score += SCORE.SINGLE
        }
      }
    }
  }
  // 分叉加成：两个及以上活威胁 => 连杀结构
  if (threats >= 2) score += FORK * (threats - 1)
  return score
}

// 站在 color 的视角评估整个棋盘：己方得分 - 对方得分（对方加权以偏向防守）
export function evaluate(board: Board, color: Color): number {
  return colorScore(board, color) - colorScore(board, color === 'black' ? 'white' : 'black') * DEFENSE
}
