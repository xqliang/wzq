# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成可用于 CSS border-image 的『均匀可平铺』古风方形边框：四角对称雕花、四边等宽连续纹样、
中间纯绿透空、无灯笼无文字。另出一条顶部孔明灯装饰(单独叠加，不参与边框平铺)。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled, crop_center_ratio

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，主体绝不使用绿色，正面平视，无投影"

# 可平铺方形边框：四角对称、四边等宽连续纹样，中间大块纯绿透空。
frame = generate(
    f"{GREEN}，古风手游弹窗方形边框，正方形，四条边等宽的青绿色描边配连续金色卷草回纹，"
    f"四角为对称的金色祥云雕花，边框粗细均匀便于平铺，边框内部一整块纯绿色透空占画面中部大部分，"
    f"无灯笼、无文字、无人物，四边对称"
)
save_scaled(chroma_key(frame, "green"), f"{OUT}/panel_frame.png", 300, 300)

# 顶部孔明灯装饰条（单独一层）。
top = generate(
    f"{GREEN}，三四盏暖黄发光的孔明灯(天灯)在夜空漂浮，四周点点金色星火火花，横向排列，古风氛围，无边框无文字"
)
top = crop_center_ratio(top, 300 / 96)
save_scaled(chroma_key(top, "green"), f"{OUT}/panel_top.png", 300, 96)

print("FRAME DONE")
