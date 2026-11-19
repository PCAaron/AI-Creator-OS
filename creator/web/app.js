import {
  cardPNG
} from "./card.mjs";
"use strict";
const $ = s => document.querySelector(s);
const E = x => String(x ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
} [c]));
const btn = (text, act, primary = false, attrs = "") => '<button type="button" data-act="' + act + '" class="' + (
  primary ? "primary" : "") + '" ' + attrs + '>' + E(text) + '</button>';
const lab = (id, label, value = "", multi = false, extra = "") => '<label for="' + id + '">' + E(label) + '</label>' + (
  multi ? '<textarea id="' + id + '" ' + extra + '>' + E(value) + '</textarea>' : '<input id="' + id + '" value="' +
  E(value) + '" ' + extra + '>');
const val = id => $("#" + id)?.value.trim() || "";
const dlg = $("#dialog");
let editStart = null;
let db, rev, model, xReady, busy = false,
  page = "inbox",
  current = "",
  platform = "X",
  search = "",
  filter = "",
  dirty = false;
const story = () => db.stories.find(s => s.id === current);
const latest = s => s?.revisions.at(-1);
const external = s => ["X", "公众号", "其他"].includes(s.kind);
const showMessage = m => {
  $("#notice").textContent = m;
  if (dlg.open) {
    let e = $("#dialogBody .error");
    if (e) e.textContent = m;
  }
};
const openDialog = html => {
  $("#dialogBody").innerHTML = html + '<p class="error" role="alert"></p>';
  dlg.showModal();
};
async function api(path, data) {
  const res = await fetch(path, data ? {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  } : {});
  const result = await res.json();
  if (!res.ok) throw Error(result.error || "操作失败");
  return result;
}
async function mutate(action, params = {}) {
  const r = await api("/api/action", {
    revision: rev,
    story: current,
    action,
    ...params
  });
  rev = r.revision;
  db = r.state;
  return r.result;
}

function leave() {
  return !dirty || confirm("当前编辑区有未保存的文字，放弃这些修改？");
}

function navigate(next) {
  if (!leave()) return;
  dirty = false;
  page = next;
  render();
}

function header(title, detail, controls = "") {
  return '<div class="head"><div><h1>' + E(title) + '</h1><p class="sub">' + E(detail) +
    '</p></div><div class="actions">' + controls + "</div></div>";
}

function storyControls() {
  return (db.stories.length ? '<select aria-label="切换选题" id="storySelect">' + db.stories.map(s => '<option value="' + s
      .id + '" ' + (s.id === current ? "selected" : "") + '>' + E(s.title) + '</option>').join("") + '</select>' : '') +
    btn("新建选题", "newStory", true);
}

function excerpt(s) {
  return '<article><span class="tag">' + E(s.kind) + '</span><b>' + E(s.title) + '</b><p class="sub">' + E(s.author ||
      "") + ' ' + E(s.date || "") + '</p><details><summary>' + (s.excerpt ? "查看素材" : "待补原文") +
    '</summary><p class="cardtext">' + E(s.excerpt) + '</p><small>' + E(s.id) + '</small></details>' + (s.url ?
      '<a href="' + E(s.url) + '" target="_blank" rel="noreferrer">原文 ↗</a>' : '') + '</article>';
}

function sourceDialog(kind = "X") {
  const kinds = ["X", "公众号", "其他", "本人观点", "本人案例", "文风样本"];
  openDialog('<h2>收入素材</h2><label for="kind">类型</label><select id="kind">' + kinds.map(k => '<option ' + (k === kind ?
    "selected" : "") + '>' + k + '</option>').join("") + '</select>' + lab("url", "外部原文链接") + btn("读取公众号公开正文",
    "wechat") + lab("title", "素材标题") + lab("author", "作者或账号") + lab("event", "事件名（相同名称归为一组）") + lab("excerpt",
    "原文节选或本人确认的材料", "", true) + '<p class="sub">可先保存外部链接，取得原文后再次导入同一链接即可补全。</p>' + btn("保存素材", "source", true));
}

function inbox() {
  let rows = db.sources.filter(s => (!filter || s.kind === filter) && [s.title, s.event, s.excerpt, s.author].join(" ")
    .toLowerCase().includes(search.toLowerCase())).slice().reverse();
  const groups = Map.groupBy ? Map.groupBy(rows, s => s.event || "未分组") : rows.reduce((m, s) => {
    let k = s.event || "未分组";
    m.set(k, [...(m.get(k) || []), s]);
    return m;
  }, new Map());
  return header("素材台", "把同一事件的报道放在一起，保留你的第一手判断。", btn("导入素材", "newSource", true)) +
    '<div class="twocol"><section class="panel"><div class="actions"><input id="search" aria-label="搜索素材" placeholder="搜索标题、作者、事件或正文" value="' +
    E(search) + '"><select id="filter" aria-label="素材类型">' + ["", "X", "公众号", "其他", "本人观点", "本人案例", "文风样本"].map(k =>
      '<option value="' + k + '" ' + (filter === k ? "selected" : "") + '>' + (k || "全部素材") + '</option>').join("") +
    '</select></div>' + ([...groups].map(([key, items]) => '<h2>' + E(key) + ' <small>' + items.length +
        ' 条</small></h2>' + items.map(s => excerpt(s) + btn("修改分组", "group", false, 'data-id="' + s.id + '"')).join(""))
      .join("") || '<div class="empty">还没有符合条件的素材。可导入一篇文章，也可以先记下自己的想法。</div>') +
    '</section><aside class="panel"><h2>X 关注账号</h2><p class="sub">' + (xReady ? "可按需取最近 10 条原创帖或回复。" :
      "配置 X_BEARER_TOKEN 后可读取账号最近帖子。也可直接导入链接。") + '</p>' + lab("handle", "账号", "", false, 'placeholder="@username"') +
    btn("获取最近帖子", "xFetch") + db.accounts.map(h => '<p>' + btn("@" + h, "account", false, 'data-handle="' + E(h) +
      '"') + '</p>').join("") + '<hr><h2>可回应的话题</h2>' + topicIdeas() + '<hr><h2>我的选题</h2>' + db.stories.map(s => '<p>' +
      btn(s.title, "pick", false, 'data-id="' + s.id + '"') + '</p>').join("") + btn("新建选题", "newStory") +
    '</aside></div>';
}

function relevant(s, topic) {
  const hay = (s.title + s.event + s.excerpt).toLowerCase(),
    t = topic.toLowerCase();
  const terms = new Set(t.match(/[a-z0-9]+/g) || []);
  for (let i = 0; i < t.length - 1; i++)
    if (/^[\u3400-\u9fff]{2}$/.test(t.slice(i, i + 2))) terms.add(t.slice(i, i + 2));
  return [...terms].filter(q => hay.includes(q)).length;
}

function topicIdeas() {
  const views = db.sources.filter(s => s.kind === "本人观点");
  return db.sources.filter(external).map(r => {
    const matches = views.map(v => [relevant(v, r.title + " " + r.event), v]).filter(([score]) => score > 0).sort((
      a, b) => b[0] - a[0]);
    return {
      r,
      v: matches[0]?.[1],
      score: matches[0]?.[0] || 0
    };
  }).sort((a, b) => b.score - a.score).slice(0, 3).map(({
      r,
      v
    }) =>
    '<article><b>' + E(r.title) + '</b><p class="sub">' + (v ? '可关联的本人观点 · ' + E(v.title) : '待回应 · 这件事与你的哪次实践有关？') +
    '</p>' + btn(v ? "拟定选题" : "留下回应", "idea", false, 'data-id="' + r.id + '" data-view="' + (v?.id || "") + '"') +
    '</article>').join("");
}

function sourceList(s, personal) {
  const rows = db.sources.filter(r => external(r) !== personal).sort((a, b) => Number(s.ids.includes(b.id)) - Number(s
    .ids.includes(a.id)) || relevant(b, s.title) - relevant(a, s.title));
  return rows.map(r => '<article><label><input type="checkbox" data-link="' + r.id + '" ' + (s.ids.includes(r.id) ?
        "checked" : "") + '> ' + E(r.title) + '</label><small>' + E(r.kind) + ' · ' + E(r.id) +
      '</small><details><summary>查看依据</summary><p class="cardtext">' + E(r.excerpt || "待补原文") + '</p>' + (r.url ?
        '<a target="_blank" rel="noreferrer" href="' + E(r.url) + '">原文 ↗</a>' : '') + '</details></article>').join(
    "") || '<p class="sub">还没有素材。</p>';
}

function references(s, body) {
  const matches = [...new Set(body.match(/\[([SV][a-zA-Z0-9_-]+)\]/g) || [])];
  return matches.map(marker => {
    const src = db.sources.find(r => "[" + r.id + "]" === marker && s.ids.includes(r.id));
    return src ? '<details><summary>' + E(marker) + ' ' + E(src.title) + '</summary><p class="cardtext">' + E(src
      .excerpt) + '</p>' + (src.url ? '<a href="' + E(src.url) + '" target="_blank" rel="noreferrer">查看原文 ↗</a>' :
      '') + '</details>' : '<p>待核对 ' + E(marker) + '</p>';
  }).join("");
}

function editor() {
  const s = story();
  let html = header("写作台", s?.title || "从一个读者真正关心的问题开始。", storyControls());
  if (!s) return html;
  const r = latest(s);
  return html + '<div class="grid"><aside class="panel"><h2>外部来源</h2>' + btn("导入来源", "newSource") + sourceList(s,
    false) + '</aside><section class="sheet"><span class="stamp">Manuscript</span><h2>' + E(s.title) +
    '</h2><p class="sub">' + (s.approved ? "已确认，可生成平台稿" : r ? E(r.mode) + " · 待确认" : "尚未起稿") +
    '</p><div class="actions">' + btn("整理素材提纲", "outline") + btn("AI 起草", "draft_ai") + '</div>' + lab("body", "母稿", r
      ?.body || "", true, 'class="editor"') + references(s, r?.body || "") + lab("reason", "此次修改的理由（选填）") +
    '<label for="category">主要修改类型</label><select id="category"><option>事实</option><option>观点</option><option>结构</option><option>措辞</option></select>' +
    '<div class="actions">' + btn("保存改稿", "save", true) + btn("确认母稿", "approve") + '</div><details><summary>历史版本 · ' + s
    .revisions.length + '</summary>' + [...s.revisions].reverse().map((v, i) => '<article><small>' + E(v.at) + ' · ' +
      E(v.mode) + '</small><p>' + E(v.reason) + '</p><details><summary>阅读版本</summary><p class="cardtext">' + E(v.body) +
      '</p></details>' + btn('恢复为新版本', 'restore', false, 'data-id="' + v.id + '"') + '</article>').join("") +
    '</details></section><aside class="panel personal"><h2>我的观点与案例</h2>' + btn("记下我的观点", "newView") +
    '<p class="cover">' + (db.sources.some(r => s.ids.includes(r.id) && r.kind === "本人观点") ?
      "哪段经历能支持这个判断？它在什么情况下可能不成立？" : "你对这件事的判断是什么？最想回应哪一个问题？") + '</p>' + sourceList(s, true) + '</aside></div>';
}

function channelView() {
  const s = story();
  let html = header("平台稿", "每个平台独立编辑。导出始终对应已确认的母稿版本。", storyControls());
  if (!s) return html;
  const p = s.channels[platform],
    stale = p && p.revision !== s.approved;
  return html + '<div class="twocol"><section class="sheet"><div class="row">' + ["X", "公众号", "小红书"].map(ch => btn(ch,
      "switch", ch === platform, 'data-ch="' + ch + '"')).join("") + '</div><p class="cover">' + E({
      X: "先写能独立阅读的首帖，每条用空行分隔。",
      公众号: "从读者的场景展开，写清证据、论证和适用边界。",
      小红书: "准备封面标题、配文和逐页图卡。用空行分隔图卡。"
    } [platform]) + '</p><p class="sub">' + (stale ? "母稿已变更，此稿需要重新核对。" : p ? "已保存此平台版本。" : s.approved ? "可以手写或调用模型。" :
      "先到写作台确认母稿。") + '</p>' + lab("ctitle", "标题", p?.title || s.title) + lab("cbody", "平台正文", p?.body || "", true,
      'class="editor"') + (platform === "小红书" ? lab("cards", "图卡文字", p?.cards.join("\n\n") || "", true) : "") +
    '<div class="actions">' + btn("保存平台稿", "channel_save", true) + btn("AI 生成平台稿", "channel_ai") +
    '</div><div class="actions">' + btn("导出" + ({
      X: " TXT",
      公众号: " HTML",
      小红书: "图文包"
    } [platform]), "export") + '</div></section><aside class="panel"><h2>已确认母稿</h2><p class="cardtext">' + E(s
      .approved ? latest(s).body : "等待作者确认。") + '</p></aside></div>';
}

function rulesView() {
  const s = story();
  return header("文风规则", "从实际改稿提出候选，在另一篇已确认的稿件上评价后启用。", storyControls()) +
    '<div class="twocol"><section class="panel"><h2>候选与生效记录</h2>' + (db.rules.map(r => '<article><span class="tag">' +
      E(({
        candidate: "待评测",
        active: "已启用",
        withdrawn: "已撤回",
        rejected: "已拒绝"
      })[r.status]) + '</span><h3>' + E(r.text) + '</h3><p>' + E(r.reason) + '</p>' + r.reviews.map(v =>
        '<p class="sub">' + E(v.note) + '</p>').join("") + (r.status === "candidate" ? btn("记录留出样本评测", "review",
        false, 'data-id="' + r.id + '"') : r.status === "active" ? btn("撤回", "rollback", false, 'data-id="' + r.id +
        '"') : "") + '</article>').join("") || '<p class="empty">保存一次有修改理由的改稿后，可以提出写作规则。</p>') +
    '</section><aside class="panel"><h2>当前文章的修改理由</h2>' + (s?.feedback.map(f => '<p>' + E(f.reason) + ' <small>' + E(f
      .category || '') + ' · ' + E(f.seconds || 0) + ' 秒</small></p>').join("") || '<p class="sub">暂无记录</p>') + lab(
      "rule", "候选写作规则") + btn("创建候选", "rule") + '</aside></div>';
}

function render() {
  editStart = null;
  if (!current && db.stories.length) current = db.stories[0].id;
  $("#app").innerHTML = ({
    inbox,
    editor,
    channels: channelView,
    rules: rulesView
  })[page]();
  document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === page));
}

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportChannel() {
  if (dirty) throw Error("请先保存当前平台稿。");
  const s = story(),
    p = s?.channels[platform];
  if (!s?.approved || !p || p.revision !== s.approved) throw Error("请先核对并保存与当前母稿对应的平台稿。");
  const assets = platform === "小红书" ? await Promise.all(p.cards.map((text, i) => cardPNG(text, i))) : [];
  const res = await fetch("/api/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      story: s.id,
      channel: platform,
      revision: rev,
      assets
    })
  });
  if (!res.ok) throw Error((await res.json()).error);
  const ext = {
    X: "txt",
    公众号: "html",
    小红书: "zip"
  } [platform];
  download(await res.blob(), p.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + "." + ext);
}
async function handle(b) {
  const a = b.dataset.act;
  if (a === "newSource" || a === "newView") {
    if (leave()) sourceDialog(a === "newView" ? "本人观点" : "X");
    return;
  }
  if (a === "idea") {
    const r = db.sources.find(s => s.id === b.dataset.id),
      v = db.sources.find(s => s.id === b.dataset.view);
    openDialog("<h2>从素材形成选题</h2><p>" + E(r.title) + "</p>" + (v ? "<p>" + E(v.excerpt) + "</p>" :
        "<p>留下一句你愿意署名的判断，再开始写。</p>") + lab("topic", "读者问题", v ? v.title : "") + (v ? "" : lab("firstView", "我的回应",
        "", true)) + btn("建立选题并关联材料", "startIdea", true, 'data-id="' + r.id + '" data-view="' + (v?.id || "") +
      '"'));
    return;
  }
  if (a === "newStory") {
    if (leave()) openDialog("<h2>新建选题</h2>" + lab("topic", "读者最想弄清楚的问题") + btn("创建选题", "story", true));
    return;
  }
  if (a === "switch") {
    if (leave()) {
      platform = b.dataset.ch;
      dirty = false;
      render();
    }
    return;
  }
  if (a === "pick") {
    if (leave()) {
      current = b.dataset.id;
      dirty = false;
      page = "editor";
      render();
    }
    return;
  }
  if (a === "export") {
    await exportChannel();
    return;
  }
  if (a === "wechat") {
    const p = await api("/api/wechat", {
      url: val("url")
    });
    $("#kind").value = "公众号";
    $("#title").value = p.title;
    $("#excerpt").value = p.excerpt;
    $("#author").value = p.author;
    showMessage("已读取，请选留需要的段落再保存。");
    return;
  }
  if (a === "group") {
    const s = db.sources.find(r => r.id === b.dataset.id);
    openDialog("<h2>归组事件</h2>" + lab("groupName", "事件名称", s.event) + btn("保存分组", "groupSave", true, 'data-id="' + s
      .id + '"'));
    return;
  }
  if (a === "review" || a === "rollback") {
    openDialog("<h2>文风评测</h2><p>当前选题：" + E(story()?.title || "请先选择文章") + "</p>" + lab("note", "写出具体段落、改前改后和判断依据", "",
        true) +
      (a === "review" ? btn("评测通过并启用", "verdict", true, 'data-v="accept" data-id="' + b.dataset.id + '"') + btn(
        "评测未通过", "verdict", false, 'data-v="reject" data-id="' + b.dataset.id + '"') : btn("撤回此规则", "verdict",
        true, 'data-v="rollback" data-id="' + b.dataset.id + '"')));
    return;
  }
  if (a === "draft_ai" || a === "channel_ai") {
    if (!model) throw Error("本机未配置模型。可用素材提纲和手动编辑，或配置自己的模型服务。");
    if (!confirm("这次将发送本篇选定材料或已确认母稿给已配置的模型服务，可能计费。继续？")) return;
  }
  if (dirty && !["save", "channel_save", "source", "story", "rule"].includes(a) && !leave()) return;
  switch (a) {
    case "startIdea":
      current = await mutate("start_idea", {
        title: val("topic"),
        source: b.dataset.id,
        view: b.dataset.view,
        reply: val("firstView")
      });
      page = "editor";
      break;
    case "source": {
      await mutate("source", {
        ...Object.fromEntries(["kind", "url", "title", "author", "event", "excerpt"].map(k => [k, val(k)])),
        attach: page === "editor" ? current : ""
      });
      break;
    }
    case "story":
      current = await mutate("story", {
        title: val("topic")
      });
      page = "editor";
      break;
    case "groupSave":
      await mutate("group", {
        id: b.dataset.id,
        event: val("groupName")
      });
      break;
    case "xFetch":
    case "account":
      if (!xReady) throw Error("尚未配置 X_BEARER_TOKEN。");
      if (!confirm("从 X API 获取最近帖子，可能产生读取费用。继续？")) return;
      await mutate("x_fetch", {
        handle: b.dataset.handle || val("handle")
      });
      break;
    case "restore":
      await mutate("restore", {
        id: b.dataset.id
      });
      break;
    case "save":
      await mutate("save", {
        body: val("body"),
        reason: val("reason"),
        category: val("category"),
        seconds: editStart ? Math.min(86400, Math.floor((Date.now() - editStart) / 1000)) : 0
      });
      break;
    case "channel_save":
      await mutate(a, {
        channel: platform,
        title: val("ctitle"),
        body: val("cbody"),
        cards: val("cards").split(/\n\s*\n/).filter(Boolean)
      });
      break;
    case "channel_ai":
      await mutate(a, {
        channel: platform
      });
      break;
    case "rule":
      await mutate("rule", {
        text: val("rule")
      });
      break;
    case "verdict":
      await mutate("rule_review", {
        id: b.dataset.id,
        verdict: b.dataset.v,
        note: val("note")
      });
      break;
    default:
      await mutate(a);
  }
  dirty = false;
  if (dlg.open) dlg.close();
  render();
  showMessage("已保存。");
}
document.addEventListener("click", async e => {
  const nav = e.target.closest("[data-nav]");
  if (nav && !busy) {
    navigate(nav.dataset.nav);
    return;
  }
  const b = e.target.closest("[data-act]");
  if (!b || busy) return;
  busy = true;
  b.disabled = true;
  $("#app").inert = true;
  showMessage("");
  try {
    await handle(b);
  } catch (err) {
    showMessage(err.message);
  } finally {
    busy = false;
    b.disabled = false;
    $("#app").inert = false;
  }
});
document.addEventListener("input", e => {
  if (e.target.id === "body" && editStart === null) editStart = Date.now();
  if (["body", "reason", "ctitle", "cbody", "cards", "rule"].includes(e.target.id)) dirty = true;
  if (e.target.id === "search") {
    search = e.target.value;
    render();
    $("#search").focus();
  }
});
document.addEventListener("change", async e => {
  const b = e.target;
  if (b.id === "filter") {
    filter = b.value;
    render();
  }
  if (b.id === "storySelect") {
    if (leave()) {
      current = b.value;
      dirty = false;
      render();
    } else b.value = current;
  }
  if (b.dataset.link) {
    if (busy || !leave()) {
      b.checked = !b.checked;
      return;
    }
    busy = true;
    try {
      await mutate("link", {
        id: b.dataset.link
      });
      dirty = false;
      render();
    } catch (err) {
      b.checked = !b.checked;
      showMessage(err.message);
    } finally {
      busy = false;
    }
  }
});
window.addEventListener("beforeunload", e => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
api("/api/state").then(r => {
  db = r.state;
  rev = r.revision;
  model = r.model;
  xReady = r.x;
  render();
}).catch(e => showMessage(e.message));
