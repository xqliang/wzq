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
  "bg_game": "中国古风棋室，木质棋桌、屏风、茶具、灯笼、山水画，水墨淡彩，低饱和暖木色调，画面中央大面积留白",
  "bg_home": "中国古风书房庭院，竹影、宣纸质感，水墨淡彩，低饱和，顶部底部有意象中间留白",
}
for name, prompt in scenes.items():
    img = crop_center_ratio(generate(prompt), 375 / 667)
    save_scaled(img, f"{OUT}/{name}.jpg", 375, 667, max_kb=180)
