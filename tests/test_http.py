"""Exercise the actual server, SQLite commits and model HTTP adapter on loopback."""
import base64
import http.client
import io
import json
import os
import tempfile
import threading
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from creator.server import Handler, Store


class ModelFixture(BaseHTTPRequestHandler):
    def do_POST(self):
        obj = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        material = json.loads(obj["messages"][1]["content"])
        if "素材" in material:
            sources = material["素材"]
            answer = {"body": "测试判断 "+" ".join("["+s["id"]+"]" for s in sources)}
        else:
            answer = {"title": "测试标题", "body": "第一段\n\n第二段", "cards": ["测试图卡"]}
        raw = json.dumps({"choices": [{"message": {"content": json.dumps(answer)}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *args):
        pass


class WorkflowHTTPTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.srv = self.serve(Handler)
        self.srv.store = Store(Path(tmp.name)/"workspace.sqlite")
        self.rev = 0

    def serve(self, handler):
        srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        return srv

    def send(self, path, data=None, origin=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.srv.server_port, timeout=5)
        headers = {"Origin": origin or f"http://127.0.0.1:{self.srv.server_port}",
                   "Content-Type": "application/json"}
        conn.request("GET" if data is None else "POST", path, body=json.dumps(
            data) if data is not None else None, headers=headers)
        res = conn.getresponse()
        try:
            return res.status, res.read()
        finally:
            conn.close()

    def act(self, action, **fields):
        code, raw = self.send("/api/action", dict(revision=self.rev, action=action, **fields))
        self.assertEqual(code, 200, raw)
        result = json.loads(raw)
        self.rev = result["revision"]
        return result

    def test_assets_and_origin(self):
        for asset in ["/", "/style.css", "/app.js", "/card.mjs", "/api/state"]:
            self.assertEqual(self.send(asset)[0], 200)
        self.assertEqual(
            self.send("/api/action", {"action": "story"}, origin="https://example.org")[0], 403)
        self.assertEqual(self.send("/api/action", dict(revision=50,
                         action="story", title="test"))[0], 409)

    def test_three_channels_via_model_fixture(self):
        mock = self.serve(ModelFixture)
        with patch.dict(os.environ, {"CREATOR_MODEL": "fixture", "CREATOR_MODEL_KEY": "fixture",
                                     "CREATOR_MODEL_URL": f"http://127.0.0.1:{mock.server_port}/v1/chat/completions"}):
            src = self.act("source", kind="X", title="合成来源",
                           url="https://x.com/example/status/30", excerpt="合成材料")["result"]
            story = self.act("start_idea", source=src, title="示例问题", reply="示例判断")["result"]
            self.act("draft_ai", story=story)
            self.act("approve", story=story)
            for ch in ("X", "公众号", "小红书"):
                self.act("channel_ai", story=story, channel=ch)
                png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl4grsAAAAASUVORK5CYII="
                data = dict(revision=self.rev, story=story, channel=ch,
                            assets=[png] if ch == "小红书" else [])
                status, body = self.send("/api/export", data)
                self.assertEqual(status, 200, body)
                if ch == "小红书":
                    with zipfile.ZipFile(io.BytesIO(body)) as bundle:
                        self.assertEqual(bundle.read("card-01.png"), base64.b64decode(png))
                        self.assertIn("测试图卡", bundle.read("cards.txt").decode())
                elif ch == "公众号":
                    self.assertIn("<p>第一段</p>", body.decode())
                else:
                    self.assertIn("第一段", body.decode())
            self.act("save", story=story, body="母稿修订")
            self.act("approve", story=story)
            self.assertEqual(self.send("/api/export", dict(story=story,
                             channel="X", revision=self.rev))[0], 400)
