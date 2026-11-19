"""Local web application, Python 3.10+. Run with python -m creator.server."""
import argparse
from contextlib import closing
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
from . import editor, exports, integrations

ASSETS = Path(__file__).with_name("web")
FILES = {"/card.mjs": ("card.mjs", "text/javascript"), "/": ("index.html", "text/html"),
         "/app.js": ("app.js", "text/javascript"), "/style.css": ("style.css", "text/css")}


class Store:
    def __init__(self, path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(path)) as db, db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER, content TEXT)")
            db.execute("INSERT OR IGNORE INTO workspace VALUES (1,0,?)", (json.dumps(editor.blank()),))

    def read(self):
        with closing(sqlite3.connect(self.path)) as db, db:
            rev, raw = db.execute("SELECT revision,content FROM workspace WHERE id=1").fetchone()
        return rev, json.loads(raw)

    def change(self, revision, data):
        current, state = self.read()
        if revision != current:
            raise Conflict()
        result = editor.apply(state, data)
        with closing(sqlite3.connect(self.path)) as db, db:
            changed = db.execute("UPDATE workspace SET revision=?,content=? WHERE id=1 AND revision=?",
                                 (current+1, json.dumps(state, ensure_ascii=False), current))
            if changed.rowcount != 1:
                raise Conflict()
        return {"revision": current+1, "state": state, "result": result}


class Conflict(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, obj, ctype="application/json"):
        body = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        for k, v in {"Content-Type": ctype+"; charset=utf-8", "Content-Length": str(len(body)),
                     "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
                     "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"} .items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def local(self, write=False):
        host = self.headers.get("Host", "")
        port = self.server.server_port
        return host in {f"127.0.0.1:{port}", f"localhost:{port}"} and (not write or self.headers.get("Origin") == "http://"+host)

    def do_GET(self):
        if not self.local():
            return self.send(403, {"error": "仅允许本机访问。"})
        if self.path in FILES:
            file, mime = FILES[self.path]
            return self.send(200, (ASSETS/file).read_bytes(), mime)
        if self.path == "/api/state":
            rev, state = self.server.store.read()
            return self.send(200, dict(revision=rev, state=state, model=bool(os.getenv("CREATOR_MODEL_KEY") and os.getenv("CREATOR_MODEL")), x=bool(os.getenv("X_BEARER_TOKEN"))))
        self.send(404, {})

    def do_POST(self):
        if not self.local(True) or self.headers.get_content_type() != "application/json":
            return self.send(403, {"error": "请求来源无效。"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size < (16000000 if self.path == "/api/export" else 300000):
                raise ValueError("请求长度无效。")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("请求格式无效。")
            if self.path == "/api/export":
                revision, state = self.server.store.read()
                if data["revision"] != revision:
                    raise Conflict()
                mime, body = exports.build(state, data)
                return self.send(200, body, mime)
            if self.path == "/api/wechat":
                return self.send(200, integrations.wechat_preview(editor.field(data, "url", 2000)))
            if self.path != "/api/action":
                return self.send(404, {})
            self.send(200, self.server.store.change(data.pop("revision"), data))
        except Conflict:
            self.send(409, {"error": "另一窗口已更新。请复制未保存文字后刷新。"})
        except (KeyError, ValueError, TypeError) as exc:
            self.send(400, {"error": str(exc)})
        except Exception:
            self.send(500, {"error": "操作未完成，请检查本机数据库、网络或服务响应。"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data", type=Path, default=Path.home()/".ai-creator-os"/"workspace.sqlite")
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.store = Store(args.data)
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"AI Creator OS  {url}", flush=True)
    if args.open:
        webbrowser.open(url)
    server.serve_forever()


if __name__ == "__main__":
    main()
