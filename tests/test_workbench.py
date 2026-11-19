from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from creator import editor, exports, integrations
from creator.server import Conflict, Store


class WorkbenchTest(unittest.TestCase):
    def setUp(self):
        self.state = editor.blank()
        self.story = editor.new_story(self.state, {"title": "一个测试问题"})
        self.opinion = self.source("本人观点", "示例个人判断")
        self.report = self.source("其他", "示例发布事实", url="https://example.org/info")

    def source(self, kind, text, **more):
        return editor.add_source(self.state, dict(kind=kind, title="合成测试素材", excerpt=text, **more))

    def act(self, action, **more):
        return editor.apply(self.state, dict(action=action, story=self.story["id"], **more))

    def ready(self):
        self.act("link", id=self.opinion["id"])
        self.act("link", id=self.report["id"])
        self.act("save", body="示例结论与适用条件", reason="补充条件", category="观点", seconds=12)
        self.act("approve")

    def test_source_gate(self):
        self.act("link", id=self.report["id"])
        with self.assertRaises(ValueError):
            self.act("outline")
        self.act("link", id=self.opinion["id"])
        self.act("outline")
        with self.assertRaises(ValueError):
            self.act("approve")

    def test_link_only_enrichment_and_dedup(self):
        a = self.source("X", "", url="https://twitter.com/test/status/123?s=20")
        self.act("link", id=a["id"])
        self.act("link", id=self.opinion["id"])
        with self.assertRaises(ValueError):
            self.act("outline")
        b = self.source("X", "节选", url="https://x.com/test/status/123")
        self.assertEqual(a["id"], b["id"])
        self.act("outline")
        self.assertIn("节选", self.story["revisions"][-1]["body"])

    def test_idea_links_and_event_group(self):
        sid = self.act("start_idea", title="测试读者问题", source=self.report["id"], reply="我认为需要验证")
        self.assertEqual(len(editor.lookup(self.state["stories"], sid)["ids"]), 2)
        one = self.source("其他", "一手", url="https://example.org/a")
        two = self.source("其他", "转述", url="https://example.org/b")
        self.act("group", id=one["id"], event="同一事件")
        self.act("group", id=two["id"], event="同一事件")
        self.assertEqual(one["event"], two["event"])
        self.assertNotEqual(one["id"], two["id"])

    def test_channel_staleness_and_html(self):
        self.ready()
        self.act("channel_save", channel="公众号", title="<title>", body="<script>示例</script>")
        _, html = exports.build(self.state, dict(story=self.story["id"], channel="公众号"))
        self.assertIn(b"&lt;script&gt;", html)
        self.act("save", body="修改后的结论")
        self.act("approve")
        with self.assertRaises(ValueError):
            exports.build(self.state, dict(story=self.story["id"], channel="公众号"))
        self.act("channel_save", channel="公众号", title="新题", body="新文")
        self.assertEqual(len(self.story["versions"]), 1)

    def test_source_change_invalidates_approval(self):
        self.ready()
        self.act("link", id=self.report["id"])
        with self.assertRaises(ValueError):
            self.act("approve")

    def test_restore_adds_revision(self):
        self.ready()
        old = self.story["revisions"][-1]
        self.act("save", body="新稿")
        self.act("restore", id=old["id"])
        self.assertEqual(self.story["revisions"][-1]["body"], old["body"])
        self.assertEqual(len(self.story["revisions"]), 3)
        self.assertIsNone(self.story["approved"])

    def test_model_contract(self):
        self.ready()
        with patch.object(integrations, "model_json", return_value={"body": "未注明依据"}):
            with self.assertRaises(ValueError):
                self.act("draft_ai")
        value = "判断 ["+self.opinion["id"]+"]。事实 ["+self.report["id"]+"]"
        with patch.object(integrations, "model_json", return_value={"body": value}):
            self.act("draft_ai")
        self.assertEqual(self.story["revisions"][-1]["body"], value)
        self.act("approve")
        with patch.object(integrations, "model_json", return_value={"title": "测试", "body": "稿件", "cards": ["卡片一"]}):
            self.act("channel_ai", channel="小红书")
        with self.assertRaises(ValueError):
            exports.build(self.state, dict(story=self.story["id"], channel="小红书", assets=[]))

    def test_citation_export(self):
        self.ready()
        self.act("channel_save", channel="X", title="测试", body="观察 ["+self.report["id"]+"]")
        _, data = exports.build(self.state, dict(channel="X", story=self.story["id"]))
        self.assertIn(b"https://example.org/info", data)

    def test_rule_holdout_and_rollback(self):
        self.ready()
        self.act("rule", text="请写出适用条件")
        rule = self.state["rules"][0]
        with self.assertRaises(ValueError):
            self.act("rule_review", id=rule["id"], verdict="accept", note="同一篇")
        self.story = editor.new_story(self.state, {"title": "独立稿件"})
        self.ready()
        self.act("rule_review", id=rule["id"], verdict="accept", note="第二篇末段增加适用条件")
        self.assertEqual(rule["status"], "active")
        self.act("rule_review", id=rule["id"], verdict="rollback", note="样本范围偏窄")
        self.assertEqual(rule["status"], "withdrawn")

    def test_store_conflict_restart_and_atomicity(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp)/"work.db"
            store = Store(path)
            store.change(0, dict(action="story", title="保留此稿"))
            with self.assertRaises(Conflict):
                store.change(0, dict(action="story", title="过期动作"))
            with self.assertRaises(ValueError):
                store.change(1, dict(action="start_idea", source="不存在", title="未写入"))
            rev, state = Store(path).read()
            self.assertEqual((rev, len(state["stories"])), (1, 1))

    def test_wechat_whitelist_and_extraction(self):
        with self.assertRaises(ValueError):
            integrations.wechat_preview("https://mp.weixin.qq.com.example.org/s/test")
        html = '<meta property="og:title" content="测试"><main><div id="js_content"><p>第一段</p><script>忽略</script></div>其他</main>'
        with patch.object(integrations, "request", return_value=html):
            self.assertEqual(integrations.wechat_preview(
                "https://mp.weixin.qq.com/s/test")["excerpt"], "第一段")
        with patch.object(integrations, "request", return_value="<title>拦截页</title>"):
            with self.assertRaises(ValueError):
                integrations.wechat_preview("https://mp.weixin.qq.com/s/test")

    def test_x_without_token_and_replay(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ValueError):
                self.act("x_fetch", handle="example")
        post = dict(title="示例", excerpt="原文", url="https://x.com/a/status/12", author="@a")
        with patch.object(integrations, "x_feed", return_value=[post]):
            self.act("x_fetch", handle="example")
            self.act("x_fetch", handle="example")
        self.assertEqual(len(self.state["accounts"]), 1)
        self.assertEqual(sum(s["kind"] == "X" for s in self.state["sources"]), 1)
