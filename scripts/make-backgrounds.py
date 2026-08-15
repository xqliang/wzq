# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""古风棋室/水墨背景，竖屏 9:16，显示 375x667。中间留白供棋盘/卡片。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, save_scaled, crop_center_ratio

OUT = "web/public/assets/img"
REF = "/Users/jyxc-dz-0100360/.claude/image-cache/945c658b-2f15-4c79-81f7-dbc7d546755b"
# (提示, 竞品参考图)：保留竞品风格与构图，调整色调/元素，中央大留白。
scenes = {
  "bg_home": ("参考竞品古风五子棋主页背景，保留其水墨山水风格与整体构图，改为更清雅的青绿色调，去除所有文字与标题，顶部远山云雾、底部江面小舟意象，画面中央大面积干净留白供标题与按钮", f"{REF}/7.png"),
  "bg_game": ("参考竞品古风五子棋对局背景，保留其风格，改为清雅青蓝水墨色调，去除棋盘与文字，画面中央大面积干净留白供棋盘放置", f"{REF}/8.png"),
}
for name, (prompt, ref) in scenes.items():
    img = crop_center_ratio(generate(prompt, ref_images=[ref]), 375 / 667)
    save_scaled(img, f"{OUT}/{name}.jpg", 375, 667, max_kb=180)
