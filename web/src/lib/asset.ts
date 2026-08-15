// 素材解析：把 src/assets/img 下的图片交给 Vite 打包（构建期生成带内容 hash 的文件名，
// 彻底避免固定文件名的浏览器/CDN 缓存问题）。用 import.meta.glob 收集，支持按名字动态取用
// （如头像 avatar_01、奖章 medal_ji、棋盘皮肤 board_wood 等运行时拼接的名字）。
const modules = import.meta.glob('../assets/img/*.{png,jpg}', { eager: true, import: 'default' }) as Record<
  string,
  string
>

const byName: Record<string, string> = {}
for (const path in modules) {
  const base = path.split('/').pop()!.replace(/\.(png|jpg)$/, '')
  byName[base] = modules[path]
}

// 按素材名（不含扩展名）返回打包后的 URL；找不到返回空串。
export function img(name: string): string {
  return byName[name] ?? ''
}
