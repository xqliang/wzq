// 棋盘主题定义：棋盘面/立体边框/网格/星位配色 + 棋子渲染样式。
// wood 主题使用玉石 PNG 贴图；其余主题用径向渐变程序化绘制棋子（无需新素材）。

// 单色棋子的径向渐变规格：hi=高光中心色，body=主体色，edge=外缘色，
// rim=描边色（可选），specular=是否叠加高光亮点（玉石光泽）。
export interface StoneSpec {
  hi: string
  body: string
  edge: string
  rim?: string
  specular?: boolean
}

export interface Theme {
  id: string
  name: string // 中文名（设置页展示）
  boardFace: string // 棋盘面（网格区）底色
  frameBase: string // 立体外框主色（厚度）
  frameLight: string // 外框受光高光边
  frameDark: string // 外框背光暗边
  line: string // 网格线颜色
  star: string // 星位点颜色
  accent: string // 准心/预落子准星强调色
  useImage: boolean // true=玉石 PNG（仅 wood）；false=程序化渐变棋子
  black: StoneSpec
  white: StoneSpec
}

export const THEMES: Record<string, Theme> = {
  // 木纹：暖木底 + 棕线，棋子用现有玉石贴图。
  wood: {
    id: 'wood',
    name: '木纹',
    boardFace: '#e3c088',
    frameBase: '#8a5a2b',
    frameLight: '#c79a5c',
    frameDark: '#5c3a17',
    line: '#6b4423',
    star: '#6b4423',
    accent: '#8a2b2b',
    useImage: true,
    // 贴图未就绪时的回退渲染。
    black: { hi: '#5a5a5a', body: '#1f1f1f', edge: '#050505', rim: 'rgba(0,0,0,0.4)' },
    white: { hi: '#ffffff', body: '#f2efe6', edge: '#cfc7b5', rim: 'rgba(0,0,0,0.25)' },
  },
  // 黑白（水墨纸）：浅纸底 + 细黑线，扁平径向渐变圆子。
  ink: {
    id: 'ink',
    name: '黑白',
    boardFace: '#f3ead6',
    frameBase: '#3a2c1a',
    frameLight: '#6b5638',
    frameDark: '#241a0f',
    line: '#2a2a2a',
    star: '#2a2a2a',
    accent: '#8a2b2b',
    useImage: false,
    black: { hi: '#4a4a4a', body: '#161616', edge: '#000000', rim: 'rgba(0,0,0,0.35)' },
    white: { hi: '#ffffff', body: '#f7f4ec', edge: '#d8d2c2', rim: 'rgba(60,50,30,0.4)' },
  },
  // 石纹：灰岩底 + 深灰线，哑光圆子（顶部柔和高光）。
  stone: {
    id: 'stone',
    name: '石纹',
    boardFace: '#b8b3a8',
    frameBase: '#6c675c',
    frameLight: '#9a9488',
    frameDark: '#48443b',
    line: '#5a564e',
    star: '#4a463e',
    accent: '#2f5d8a',
    useImage: false,
    black: { hi: '#565049', body: '#2b2824', edge: '#141210', rim: 'rgba(0,0,0,0.3)' },
    white: { hi: '#fbfaf7', body: '#ddd8cf', edge: '#b3ada1', rim: 'rgba(0,0,0,0.2)' },
  },
  // 玉石（高阶皮肤）：深绿玉底 + 金线金星，玻璃光泽圆子（含高光点）。
  jade: {
    id: 'jade',
    name: '玉石',
    boardFace: '#1f4a3d',
    frameBase: '#123328',
    frameLight: '#c8912f',
    frameDark: '#0a1f18',
    line: '#c8912f',
    star: '#e6c265',
    accent: '#e6c265',
    useImage: false,
    black: { hi: '#4c4c52', body: '#1a1a20', edge: '#000004', rim: 'rgba(230,194,101,0.35)', specular: true },
    white: { hi: '#ffffff', body: '#dff2e4', edge: '#8fc7a6', rim: 'rgba(20,60,45,0.4)', specular: true },
  },
}

// 读取主题；未知 id 回退 wood。
export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.wood
}
