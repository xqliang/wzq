# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""8 个古风人物头像，蓝底抠透明 PNG，显示 64px。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/src/assets/img"
roles = ["书生", "侠客", "琴女", "老翁", "少年", "道士", "画师", "棋童"]
for i, role in enumerate(roles, 1):
    img = chroma_key(generate(f"纯蓝色背景(#0000ff)，中国古风{role}头像，圆形构图，水墨淡彩，扁平居中，无背景装饰"), "blue")
    save_scaled(img, f"{OUT}/avatar_{i:02d}.png", 64, 64)
