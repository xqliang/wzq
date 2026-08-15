# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""seedream 文生图公共封装：生成 -> （可选）抠纯色底 -> 按显示尺寸×3 缩放保存。
跑法：ARK_API_KEY=xxx uv run scripts/make-*.py
模型 id 沿用全项目确认值，勿改。"""
import base64, io, os, sys
import requests
from PIL import Image
import numpy as np

ARK_KEY = os.environ["ARK_API_KEY"]
ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
MODEL = "doubao-seedream-5-0-260128"
REQUEST_SIZE = "1920x1920"  # seedream 5.0 需 >= ~3.7M 像素

def _data_uri(path: str, max_side: int = 1024) -> str:
    """把参考图缩放到 max_side 内并转成 data URI（JPEG base64），用于图生图。"""
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def generate(prompt: str, ref_images: list[str] | None = None) -> Image.Image:
    """文生图；传 ref_images 则走图生图（参考竞品图，保留风格、调整色调/元素）。"""
    payload = {"model": MODEL, "prompt": prompt, "size": REQUEST_SIZE,
               "response_format": "url", "watermark": False}
    if ref_images:
        payload["image"] = [_data_uri(p) for p in ref_images]
    resp = requests.post(
        ARK_URL,
        headers={"Authorization": f"Bearer {ARK_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=180)
    if not resp.ok:
        print(f"ARK HTTP {resp.status_code}: {resp.text}", file=sys.stderr)
        resp.raise_for_status()
    item = resp.json()["data"][0]
    raw = requests.get(item["url"], timeout=180).content if item.get("url") else base64.b64decode(item["b64_json"])
    return Image.open(io.BytesIO(raw)).convert("RGB")

def chroma_key(img: Image.Image, key: str = "green", tol: int = 90) -> Image.Image:
    """把绿/蓝纯底抠成透明。key: green|blue。"""
    arr = np.array(img.convert("RGBA")).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    if key == "green":
        mask = (g > 100) & (g - r > tol) & (g - b > tol)
    else:
        mask = (b > 100) & (b - r > tol) & (b - g > tol)
    arr[mask, 3] = 0
    return Image.fromarray(arr.astype("uint8"), "RGBA")

def save_scaled(img: Image.Image, out: str, disp_w: int, disp_h: int, max_kb: int = 200):
    """按显示尺寸×3 缩放后保存；PNG 保留透明，JPG 压到 max_kb。"""
    img = img.resize((disp_w * 3, disp_h * 3), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if out.endswith(".png"):
        img.save(out, "PNG", optimize=True)
    else:
        for q in (85, 78, 70, 62, 55):
            img.convert("RGB").save(out, "JPEG", quality=q, optimize=True, progressive=True)
            if os.path.getsize(out) / 1024 <= max_kb:
                break
    print(f"saved {out} ({os.path.getsize(out)//1024} KB, {img.size})")

def crop_center_ratio(img: Image.Image, ratio_w_h: float) -> Image.Image:
    w, h = img.size
    th = int(w / ratio_w_h)
    if th <= h:
        top = (h - th) // 2
        return img.crop((0, top, w, top + th))
    tw = int(h * ratio_w_h)
    left = (w - tw) // 2
    return img.crop((left, 0, left + tw, h))
