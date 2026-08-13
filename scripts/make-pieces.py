# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成黑/白古风玉石棋子，绿底抠成透明 PNG，显示尺寸 34px（×3=102px）。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
STYLE = "纯绿色背景(#00ff00)，正上方俯视单颗围棋子特写，无阴影投射到背景，扁平居中，写实玉石质感"

for name, desc in [("piece_black", "墨玉黑子，温润哑光"), ("piece_white", "羊脂白玉白子，温润")]:
    img = chroma_key(generate(f"{STYLE}，{desc}"), "green")
    # 裁到棋子方形边界（简化：中心方裁）
    save_scaled(img, f"{OUT}/{name}.png", 34, 34)
