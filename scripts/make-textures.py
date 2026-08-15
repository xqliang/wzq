# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成离散 UI 贴图原子：木纹按钮 / 金色头像圆环框 / 棋盘面木纹。
- 木纹按钮、棋盘面：不透明贴图，作 CSS/Canvas 背景铺满。
- 头像框：金色雕花圆环，中心镂空(纯绿抠透明)。
说明：这些是离散 UI 原子，竞品参考图是整屏合成图，直接图生图会把整屏构图
带进来污染单元素素材；因此按“观察竞品风格→写进提示词”复刻，不传整屏参考图。
默认跳过已存在文件（避免重跑覆盖已确认素材）；加 --force 强制重生成。
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，扁平居中，无投影到背景"


def gen_wood_btn(p):
    # 暖棕横向木纹，无文字无边框无图案，整幅均匀，用作按钮背景铺满
    img = generate(
        "古风暖棕色木质纹理贴图，横向木纹清晰细腻，色泽温润，"
        "整幅均匀充满画面，无任何文字、无边框、无雕花、无图案、无投影，用作按钮背景")
    save_scaled(img, p, 240, 96, max_kb=60)


def gen_frame_gold(p):
    # 金色雕花描金圆环，中心完全镂空(纯绿)，点缀青玉祥云，无人物无文字
    img = chroma_key(generate(
        f"{GREEN}，古风圆形头像边框，金色雕花描金圆环，环身点缀青玉与祥云纹样，"
        "华贵精致，正圆形，圆环中心完全镂空为纯绿色(#00ff00)，无人物、无头像、无文字"), "green")
    save_scaled(img, p, 72, 72)


def gen_board_wood(p):
    # 浅暖原木盘面贴图：木纹细腻柔和，整幅均匀，供网格/棋子清晰叠加其上
    img = generate(
        "古风浅暖色木质棋盘面纹理贴图，浅原木/浅胡桃木色，木纹细腻柔和均匀，"
        "整幅充满画面，无任何文字、无边框、无网格线、无棋子、无图案、无投影")
    save_scaled(img, p, 320, 320, max_kb=140)


TASKS = [
    (f"{OUT}/wood_btn.jpg", gen_wood_btn),
    (f"{OUT}/frame_gold.png", gen_frame_gold),
    (f"{OUT}/board_wood.jpg", gen_board_wood),
]

force = "--force" in sys.argv
for path, fn in TASKS:
    if not force and os.path.exists(path):
        print(f"skip {path}（已存在；--force 覆盖）")
        continue
    fn(path)
