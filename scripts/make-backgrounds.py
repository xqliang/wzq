# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""古风棋室/水墨背景，竖屏 9:16，显示 375x667。中间留白供棋盘/卡片。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, save_scaled, crop_center_ratio

OUT = "web/public/assets/img"
scenes = {
  "bg_home": "中国古风水墨山水，青绿色调，远山云雾、江面小舟、飞鸟，宣纸质感，顶部与底部有山水意象，画面中央大面积留白供标题与按钮，低饱和淡彩",
  "bg_game": "中国古风水墨背景，青蓝色调，淡云与远山，宣纸质感，低饱和，画面中央大面积留白供棋盘",
}
for name, prompt in scenes.items():
    img = crop_center_ratio(generate(prompt), 375 / 667)
    save_scaled(img, f"{OUT}/{name}.jpg", 375, 667, max_kb=180)
