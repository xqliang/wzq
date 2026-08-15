# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成古风弹窗边框(含顶部孔明灯/星火)与更精致的 LOGO / 金币 / 卷轴 图标。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled, crop_center_ratio

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，无投影到背景，主体绝不使用绿色"

# 1) 弹窗竖向边框：青绿描边+金色雕花四角，顶部中央融入暖黄孔明灯与星火，中间纯绿透空。
frame = generate(
    f"{GREEN}，古风手游弹窗边框，竖向长方形，四边闭合的青绿色描边配金色卷草雕花，四角金色祥云雕花，"
    f"顶部边框中央融入两三盏暖黄发光的孔明灯(天灯)与点点金色星火，边框内部为一整块纯绿色透空(占画面中间大部分)，边框粗细适中"
)
frame = crop_center_ratio(frame, 470 / 600)
save_scaled(chroma_key(frame, "green"), f"{OUT}/panel_frame.png", 470, 600)

# 2) 顶部孔明灯装饰条（单独一层，叠在标题后）。
top = generate(
    f"{GREEN}，一排三四盏暖黄色发光的孔明灯(天灯)在夜空漂浮，四周点点金色星火火花，横向排列，古风氛围，无边框无文字"
)
top = crop_center_ratio(top, 460 / 150)
save_scaled(chroma_key(top, "green"), f"{OUT}/panel_top.png", 460, 150)

# 3) 更精致的 LOGO。
logo = generate(
    f"{GREEN}，毛笔书法「五子棋」三个大字横排，厚重金色烫金立体质感，深墨描边描金，古风大气，笔画饱满有光泽，字体绝不使用绿色"
)
save_scaled(chroma_key(logo, "green"), f"{OUT}/logo_title.png", 240, 100)

# 4) 金币 / 卷轴 图标（更立体有光泽）。
coin = generate(f"{GREEN}，古风金币铜钱图标，圆形方孔，明亮金色金属光泽立体，单枚，正面俯视")
save_scaled(chroma_key(coin, "green"), f"{OUT}/icon_coin.png", 40, 40)

scroll = generate(f"{GREEN}，古风卷轴书卷图标，红色绸面配金色轴头，卷起状，立体有光泽，单个")
save_scaled(chroma_key(scroll, "green"), f"{OUT}/icon_scroll.png", 40, 40)

print("ALL DONE")
