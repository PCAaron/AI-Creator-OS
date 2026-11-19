import base64
import html
import io
import zipfile
from .editor import lookup


def build(state, data):
    story = lookup(state["stories"], data["story"])
    platform = data["channel"]
    p = story["channels"].get(platform)
    if not story["approved"] or not p or p["revision"] != story["approved"]:
        raise ValueError("请重新核对母稿和平台版本后导出。")
    # Expand internal evidence markers into readable citations in published copy.
    body = p["body"]
    for s in state["sources"]:
        marker = "["+s["id"]+"]"
        if marker in body:
            body = body.replace(marker, "（"+s["title"]+" "+s["url"]+"）" if s["url"] else "")
    text = p["title"]+"\n\n"+body
    if platform == "X":
        return "text/plain", text.encode()
    if platform == "公众号":
        h = html.escape
        paragraphs = "".join("<p>"+h(part).replace("\n", "<br>")+"</p>" for part in body.split("\n\n"))
        doc = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>' + \
            h(p["title"])+"</title><article><h1>"+h(p["title"])+"</h1>"+paragraphs+"</article></html>"
        return "text/html", doc.encode()
    assets = data.get("assets", [])
    if not isinstance(assets, list) or len(assets) != len(p["cards"]):
        raise ValueError("图卡数量不一致。")
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("post.txt", text)
        bundle.writestr("cards.txt", "\n\n".join(p["cards"]))
        for i, encoded in enumerate(assets, 1):
            raw = base64.b64decode(encoded, validate=True)
            if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("图卡不是 PNG 格式。")
            bundle.writestr(f"card-{i:02d}.png", raw)
    return "application/zip", out.getvalue()
