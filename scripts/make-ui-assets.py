# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成古风 UI 素材：标题 LOGO / 木牌横幅底 / 段位奖章 / 货币图标。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，扁平居中，无投影到背景"

items = [
    # (文件名, 显示宽, 显示高, 提示)
    ("logo_title", 220, 96, f"{GREEN}，毛笔书法「五子棋」三个大字，金色烫金描金，深墨描边，古风，字体绝不使用绿色"),
    ("banner_wood", 240, 72, f"{GREEN}，古风木质横匾牌匾，空白无字，两端有雕花卷角，暖棕木色"),
    ("medal_ji", 96, 96, f"{GREEN}，古风圆形奖章徽章，青铜色莲花纹，无文字"),
    ("medal_duan", 96, 96, f"{GREEN}，古风圆形奖章徽章，白银色云纹，无文字"),
    ("medal_master", 96, 96, f"{GREEN}，古风圆形奖章徽章，金色玉石祥云，无文字，华贵"),
    ("icon_coin", 40, 40, f"{GREEN}，古风金色铜钱金币图标，正面俯视，单枚"),
    ("icon_scroll", 40, 40, f"{GREEN}，古风红色卷轴书卷图标，单个"),
]
for name, w, h, prompt in items:
    img = chroma_key(generate(prompt), "green")
    save_scaled(img, f"{OUT}/{name}.png", w, h)
