"""Editorial actions over a single-user, revisioned project."""
from datetime import datetime, timezone
from difflib import SequenceMatcher
import re
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4
from . import integrations

CHANNELS = ("X", "公众号", "小红书")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ident():
    return uuid4().hex[:12]


def field(data, key, limit=12000, required=True):
    value = data.get(key, "")
    if not isinstance(value, str) or len(value.strip()) > limit or (required and not value.strip()):
        raise ValueError(f"请检查 {key} 字段（最多 {limit} 字符）。")
    return value.strip()


def blank():
    return {"sources": [], "stories": [], "accounts": [], "rules": []}


def lookup(rows, key):
    for row in rows:
        if row["id"] == key:
            return row
    raise ValueError("记录不存在，请刷新。")


def canonical(url):
    p = urlsplit(url.strip())
    if p.scheme not in {"http", "https"} or not p.hostname or p.username or p.password:
        raise ValueError("请输入有效的 HTTP(S) 来源链接。")
    if p.hostname.lower() in {"twitter.com", "x.com", "www.x.com", "www.twitter.com"}:
        m = re.search(r"/status/(\d+)", p.path)
        if m:
            return "https://x.com/i/status/" + m[1]
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, p.query, ""))


def add_source(state, d):
    kind = d.get("kind")
    if kind not in {"X", "公众号", "其他", "本人观点", "本人案例", "文风样本"}:
        raise ValueError("请选择素材类型。")
    external = kind in {"X", "公众号", "其他"}
    url = canonical(field(d, "url", 2000)) if external else ""
    excerpt = field(d, "excerpt", 16000, required=not external)
    title = field(d, "title", 180)
    author = field(d, "author", 180, required=False)
    event = field(d, "event", 140, required=False)
    for item in state["sources"]:
        if url and item["url"] == url:
            # Allow enriching an existing link without overwriting an excerpt used in an article.
            if not item["excerpt"] and excerpt:
                item.update(excerpt=excerpt, title=title, author=author or item["author"])
            return item
    if external and not event:
        def clean(t): return re.sub(r"[^\w]+", "", t.casefold())
        closest = max((s for s in state["sources"] if s["url"]), default=None,
                      key=lambda s: SequenceMatcher(None, clean(title), clean(s["title"])).ratio())
        if closest and len(clean(title)) >= 8 and SequenceMatcher(None, clean(title), clean(closest["title"])).ratio() >= .87:
            event = closest["event"] or closest["title"]
            closest["event"] = event
    item = dict(id=("S" if external else "V")+ident(), kind=kind, url=url, excerpt=excerpt, title=title,
                author=author, event=event, date=field(d, "date", 80, False), added=now())
    state["sources"].append(item)
    return item


def selected(state, story):
    return [s for s in state["sources"] if s["id"] in story["ids"]]


def evidence(state, story):
    rows = selected(state, story)
    if not any(r["kind"] == "本人观点" and r["excerpt"] for r in rows):
        raise ValueError("请先关联一条本人确认的观点。")
    if any(not r["excerpt"] for r in rows):
        raise ValueError("所选链接中有待补原文的素材，请补充节选或移出本篇。")
    return rows


def new_story(state, d):
    title = field(d, "title", 180)
    item = dict(id=ident(), title=title, ids=[], revisions=[], approved=None, channels={},
                feedback=[], created=now(), versions=[], basis=0)
    state["stories"].append(item)
    return item


def save_revision(story, body, mode, reason=""):
    if story["revisions"] and body == story["revisions"][-1]["body"] and story["basis"] == story["revisions"][-1]["basis"]:
        return
    story["revisions"].append(dict(id=ident(), body=body, mode=mode, reason=reason,
                              at=now(), basis=story["basis"], ids=list(story["ids"])))
    story["approved"] = None


def compose(state, story, ai):
    rows = evidence(state, story)
    materials = [r for r in rows if r["kind"] != "文风样本"]
    if ai:
        result = integrations.model_json("返回 body 字符串，写成有论点、事实、论证边界的中文母稿。"
                                         "外部事实和个人判断所在段均附对应的 [素材id]。文风样本只学写法。", {
                                             "选题": story["title"], "素材": rows, "已启用写作规则": [r["text"] for r in state["rules"] if r["status"] == "active"]})
        body = field(result, "body", 32000)
        known = {r["id"] for r in materials}
        refs = set(re.findall(r'\[([SV][a-zA-Z0-9_-]+)\]', body))
        if (not refs or refs-known or not any(r["kind"] == "本人观点" and r["id"] in refs for r in materials)
                or (any(r["url"] for r in materials) and not any(r["url"] and r["id"] in refs for r in materials))):
            raise ValueError("模型引用缺失或有未知编号，请重试或手写。")
    else:
        sections = [story["title"]]
        for label, kinds in [("我的判断", {"本人观点"}), ("事实与出处", {"X", "公众号", "其他"}), ("我的案例", {"本人案例"})]:
            excerpts = [r["excerpt"]+" ["+r["id"]+"]" for r in materials if r["kind"] in kinds]
            if excerpts:
                sections.append(label+"\n"+"\n\n".join(excerpts))
        sections.append("待写：这条判断在哪些条件下成立？读者可以怎样验证？")
        body = "\n\n".join(sections)
    save_revision(story, body, "AI 草稿" if ai else "素材提纲")


def approve(story):
    if not story["revisions"] or story["revisions"][-1]["basis"] != story["basis"]:
        raise ValueError("请根据当前素材保存母稿后再确认。")
    rev = story["revisions"][-1]
    if rev["mode"] == "素材提纲" or "待写：" in rev["body"]:
        raise ValueError("请将素材提纲写成文章后再确认。")
    story["approved"] = rev["id"]


def channel_payload(channel, d):
    title = field(d, "title", 180)
    body = field(d, "body", 32000)
    cards = d.get("cards", [])
    if not isinstance(cards, list) or len(cards) > 12 or any(not isinstance(c, str) or not c.strip() or len(c) > 200 for c in cards):
        raise ValueError("每张图卡需 1–200 字，最多 12 张。")
    if channel == "小红书" and not cards:
        raise ValueError("请至少填写一张图卡。")
    return dict(title=title, body=body, cards=cards if channel == "小红书" else [])


def compile_channel(state, story, d):
    ch = d.get("channel")
    if ch not in CHANNELS or not story["approved"]:
        raise ValueError("请先确认母稿并选择平台。")
    rev = story["revisions"][-1]
    if d["action"] == "channel_ai":
        brief = {"X": "一个独立可读的首帖，可按空行分成短串帖。", "公众号": "场景开头，论证清晰，加入限制与实践建议。",
                 "小红书": "标题和配文，另给 3–7 张读者可单独理解的图卡。每张最多 100 字。"}[ch]
        raw = integrations.model_json(
            brief+"返回 title、body 两个字符串和 cards 字符串数组。保留母稿观点强度。用普通文本。", {"母稿": rev["body"], "选题": story["title"]})
    else:
        raw = d
    payload = channel_payload(ch, raw)
    current = story["channels"].get(ch)
    if current:
        story["versions"].append(dict(channel=ch, **current))
    story["channels"][ch] = dict(**payload, revision=rev["id"], at=now())


def apply(state, d):
    action = d["action"]
    if action == "source":
        source = add_source(state, d)
        if d.get("attach"):
            item = lookup(state["stories"], d["attach"])
            if source["id"] not in item["ids"]:
                item["ids"].append(source["id"])
                item["basis"] += 1
                item["approved"] = None
        return source["id"]
    if action == "group":
        lookup(state["sources"], d["id"])["event"] = field(d, "event", 140, False)
        return
    if action == "story":
        return new_story(state, d)["id"]
    if action == "start_idea":
        source = lookup(state["sources"], d["source"])
        view = lookup(state["sources"], d["view"]) if d.get("view") else add_source(
            state, dict(kind="本人观点", title=d["title"], excerpt=field(d, "reply")))
        if not source["url"] or view["kind"] != "本人观点":
            raise ValueError("请关联外部素材与本人观点。")
        item = new_story(state, d)
        item["ids"] = [source["id"], view["id"]]
        return item["id"]
    if action == "x_fetch":
        handle = field(d, "handle", 20).strip("@").lower()
        posts = integrations.x_feed(handle)
        for p in posts:
            add_source(state, dict(p, kind="X"))
        if handle not in state["accounts"]:
            state["accounts"].append(handle)
        return len(posts)
    story = lookup(state["stories"], d.get("story"))
    if action == "link":
        row = lookup(state["sources"], d["id"])
        if row["id"] in story["ids"]:
            story["ids"].remove(row["id"])
        else:
            story["ids"].append(row["id"])
        story["basis"] += 1
        story["approved"] = None
    elif action in {"outline", "draft_ai"}:
        compose(state, story, action == "draft_ai")
    elif action == "save":
        evidence(state, story)
        body = field(d, "body", 32000)
        reason = field(d, "reason", 450, False)
        seconds = d.get("seconds", 0)
        category = field(d, "category", 30, False)
        if type(seconds) is not int or not 0 <= seconds <= 86400:
            raise ValueError("改稿时长无效。")
        if reason:
            story["feedback"].append(dict(reason=reason, category=category, seconds=seconds, at=now()))
        save_revision(story, body, "作者编辑", reason)
    elif action == "restore":
        revision = lookup(story["revisions"], d["id"])
        story["ids"] = list(revision["ids"])
        story["basis"] += 1
        save_revision(story, revision["body"], revision["mode"], "从历史版本恢复")
    elif action == "approve":
        evidence(state, story)
        approve(story)
    elif action in {"channel_save", "channel_ai"}:
        compile_channel(state, story, d)
    elif action == "rule":
        if not story["feedback"]:
            raise ValueError("请先保存一次含修改理由的改稿。")
        state["rules"].append(dict(id=ident(), text=field(d, "text", 450), source=story["id"],
                                   reason=story["feedback"][-1]["reason"], status="candidate", reviews=[]))
    elif action == "rule_review":
        rule = lookup(state["rules"], d["id"])
        if d.get("verdict") == "rollback" and rule["status"] == "active":
            rule["status"] = "withdrawn"
        elif rule["status"] == "candidate" and story["id"] != rule["source"] and story["approved"] and d.get("verdict") in {"accept", "reject"}:
            rule["status"] = "active" if d["verdict"] == "accept" else "rejected"
        else:
            raise ValueError("请用另一篇已确认的文章评测候选规则。")
        rule["reviews"].append(dict(story=story["id"], revision=story["approved"],
                               note=field(d, "note", 450), at=now()))
    else:
        raise ValueError("未知操作。")
