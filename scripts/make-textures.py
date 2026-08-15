# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pillow", "numpy"]
# ///
"""生成木纹按钮贴图与古风头像圆环框。
- 木纹：不透明贴图，作 CSS 背景拉伸铺满按钮（圆角/边框/阴影仍由 CSS 负责）。
- 头像框：金色雕花圆环，中心镂空(纯绿抠透明)，覆盖在圆形头像上。
说明：这两个是离散 UI 原子（贴图/透明环），竞品参考图是整屏合成图，
直接做图生图会把整屏构图带进来污染单元素素材；因此按“观察竞品风格→写进提示词”
的方式复刻（金色雕花圆环，参见竞品胜利页头像框），不传整屏参考图。
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _seedream import generate, chroma_key, save_scaled

OUT = "web/public/assets/img"
GREEN = "纯绿色背景(#00ff00)，正面平视，扁平居中，无投影到背景"

# 木纹按钮贴图：暖棕横向木纹，无文字无边框无图案，整幅均匀，用作按钮背景铺满
wood = generate(
    "古风暖棕色木质纹理贴图，横向木纹清晰细腻，色泽温润，"
    "整幅均匀充满画面，无任何文字、无边框、无雕花、无图案、无投影，用作按钮背景")
save_scaled(wood, f"{OUT}/wood_btn.jpg", 240, 96, max_kb=60)

# 头像圆环框：金色雕花描金圆环，中心完全镂空(纯绿)，点缀青玉祥云，无人物无文字
frame = chroma_key(generate(
    f"{GREEN}，古风圆形头像边框，金色雕花描金圆环，环身点缀青玉与祥云纹样，"
    "华贵精致，正圆形，圆环中心完全镂空为纯绿色(#00ff00)，无人物、无头像、无文字"), "green")
save_scaled(frame, f"{OUT}/frame_gold.png", 72, 72)
