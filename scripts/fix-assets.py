# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""修图：重生成饱满木匾(banner_wood, 无透明压缩) 与更像卷轴的 icon_scroll；金币裁掉透明边。
所有图裁到 alpha 包围盒去掉多余透明区域；图标居中贴到正方画布避免拉伸。绿底抠透明。"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled, crop_center_ratio
from PIL import Image

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，无投影到背景，主体绝不使用绿色"


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    """裁到 alpha 包围盒，四周留 pad 像素透明边。"""
    im = im.convert("RGBA")
    bb = im.split()[3].getbbox()
    if not bb:
        return im
    l, t, r, b = bb
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def square(im: Image.Image, pad_ratio: float = 0.06) -> Image.Image:
    """把(可能非方的)图标居中贴到正方透明画布，避免后续 resize 成正方时被拉伸。"""
    im = trim(im, 1)
    side = int(max(im.width, im.height) * (1 + pad_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas


# 1) 木匾：饱满实木牌匾，填满画面(不再是薄条+大片透明)，裁到 ~3.2:1。
banner = generate(
    f"{GREEN}，古风木质牌匾横匾，深棕实木质地带木纹与描金包边，横向长方形，匾面中间留白无文字，"
    f"牌匾主体填满整个画面(上下左右几乎顶边)，正面平视"
)
banner = crop_center_ratio(chroma_key(banner, "green"), 3.2)
banner = trim(banner, 1)
save_scaled(banner, f"{OUT}/banner_wood.png", 150, 47)  # -> 450x141

# 2) 卷轴：横向半展开宣纸卷轴，两端红木卷轴杆，米黄纸面（更像卷轴）。
scroll = generate(
    f"{GREEN}，古风卷轴图标，一幅横向半展开的宣纸书卷，左右两端为红木/金色卷轴杆，中间米黄色纸面微微露出，"
    f"古典立体有光泽，正面，居中，单个，图标风格"
)
scroll = square(chroma_key(scroll, "green"))
save_scaled(scroll, f"{OUT}/icon_scroll.png", 48, 48)  # -> 144x144

# 3) 金币：沿用现有图，仅裁掉透明边并居中成方(让币面填满，显示更大更清晰)。
coin = square(Image.open(f"{OUT}/icon_coin.png"))
save_scaled(coin, f"{OUT}/icon_coin.png", 48, 48)

print("ASSETS FIXED")
