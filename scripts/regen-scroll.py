# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""重新生成卷轴图标 icon_scroll.png：卷起收拢(未展开)的精致古风卷轴。绿底抠透明、居中成方。
跑法(仓库根目录)：ARK_API_KEY=xxx uv run scripts/regen-scroll.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled
from PIL import Image

OUT = "web/src/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，无投影到背景，主体绝不使用绿色"


def trim(im: Image.Image, pad: int = 1) -> Image.Image:
    im = im.convert("RGBA")
    bb = im.split()[3].getbbox()
    if not bb:
        return im
    l, t, r, b = bb
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def square(im: Image.Image, pad_ratio: float = 0.08) -> Image.Image:
    """居中贴到正方透明画布，避免 resize 成正方被拉伸。"""
    im = trim(im, 1)
    side = int(max(im.width, im.height) * (1 + pad_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas


scroll = generate(
    f"{GREEN}，一枚古风卷轴图标，一卷收拢卷起、尚未展开的宣纸卷轴，"
    f"圆柱形横放，两端为红木镶金的卷轴杆，纸卷层次细腻，中段系一道红色丝带，"
    f"精致小巧，古典立体有光泽与描金高光，正面平视，居中，单个物体，图标风格，简洁干净"
)
scroll = square(chroma_key(scroll, "green"))
save_scaled(scroll, f"{OUT}/icon_scroll.png", 48, 48)
print("SCROLL REGENERATED")
