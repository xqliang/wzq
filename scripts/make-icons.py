# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""重生成 LOGO(修正上下压缩) 与金币/卷轴图标。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled, crop_center_ratio

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，无投影到背景，主体绝不使用绿色"

# LOGO：先按显示比例裁剪(方图→2.35:1)再缩放，避免正方形内容被压扁(上下压缩)。
logo = generate(
    f"{GREEN}，毛笔书法「五子棋」三个金色大字横排，厚重立体烫金质感，深墨描边描金，笔画饱满有光泽，"
    f"比例端正不拉伸，古风大气，字体绝不使用绿色"
)
logo = crop_center_ratio(logo, 2.35)
save_scaled(chroma_key(logo, "green"), f"{OUT}/logo_title.png", 260, 110)

# 金币：外圆内方孔铜钱，明亮金属光泽。
coin = generate(f"{GREEN}，一枚古风金币铜钱，外圆内方孔，明亮黄金金属光泽有立体高光，正面俯视，单枚，边缘清晰")
save_scaled(chroma_key(coin, "green"), f"{OUT}/icon_coin.png", 44, 44)

# 卷轴：红绸金杆，半展开，立体。
scroll = generate(f"{GREEN}，一卷古风卷轴，红色绸面配金色卷轴杆两端，半展开，立体光泽，单个，正面，边缘清晰")
save_scaled(chroma_key(scroll, "green"), f"{OUT}/icon_scroll.png", 44, 44)

print("ICONS DONE")
