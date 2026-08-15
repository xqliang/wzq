// 棋盘主题定义：棋盘面/立体边框/网格/星位配色 + 棋子渲染样式。
// 棋子统一用径向渐变程序化绘制（黑白玻璃子）；wood 主题另附木纹贴图作盘面。

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
  baseShadow?: string // 棋盘底部立体底座色（缺省用 frameDark）
  faceImage?: string // 棋盘面木纹贴图路径（缺省则用 boardFace 纯色）
  useImage: boolean // true=玉石 PNG（仅 wood）；false=程序化渐变棋子
  black: StoneSpec
  white: StoneSpec
}

export const THEMES: Record<string, Theme> = {
  // 木纹（默认，复刻竞品）：浅暖木盘面 + 木纹贴图 + 棕线，玻璃光泽黑白子。
  wood: {
    id: 'wood',
    name: '木纹',
    boardFace: '#e9d3a5',
    frameBase: '#b5823f',
    frameLight: '#e0b877',
    frameDark: '#6f4a20',
    line: '#9c7a44',
    star: '#6f4a20',
    accent: '#8a2b2b',
    baseShadow: '#5c3a17',
    faceImage: '/assets/img/board_wood.jpg',
    useImage: false,
    black: { hi: '#6b6b6b', body: '#161616', edge: '#000000', rim: 'rgba(0,0,0,0.35)', specular: true },
    white: { hi: '#ffffff', body: '#f4f0e6', edge: '#d6ccb4', rim: 'rgba(110,80,35,0.3)', specular: true },
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
  // 流金岁月（高阶皮肤）：深蓝棋盘面 + 金色立体框，金光泽圆子（含细锐高光点）。
  gold: {
    id: 'gold',
    name: '流金岁月',
    boardFace: '#2b3a5c',
    frameBase: '#b8791b',
    frameLight: '#f5c542',
    frameDark: '#7c4a1e',
    line: '#d9b56a',
    star: '#f5e2a0',
    accent: '#f5c542',
    baseShadow: '#5c360f',
    useImage: false,
    black: { hi: '#5a5a62', body: '#1a1a22', edge: '#000006', rim: 'rgba(245,197,66,0.4)', specular: true },
    white: { hi: '#ffffff', body: '#f0e6c8', edge: '#c8b483', rim: 'rgba(120,74,30,0.4)', specular: true },
  },
  // 青蓝（高阶皮肤，复刻竞品高级盘）：宝蓝盘面 + 浅蓝网格 + 金色框，玻璃光泽黑白子。
  blue: {
    id: 'blue',
    name: '青蓝',
    boardFace: '#41528a',
    frameBase: '#c19a3c',
    frameLight: '#f0d27a',
    frameDark: '#856016',
    line: '#aab7de',
    star: '#cdd7f0',
    accent: '#f0d27a',
    baseShadow: '#6e5018',
    useImage: false,
    black: { hi: '#5a5a62', body: '#16161c', edge: '#000004', rim: 'rgba(255,255,255,0.14)', specular: true },
    white: { hi: '#ffffff', body: '#f4f6fb', edge: '#c3ccdd', rim: 'rgba(20,30,60,0.35)', specular: true },
  },
}

// 读取主题；未知 id 回退默认木纹。
export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.wood
}
