import io
import re
import os
import tempfile
import zipfile
import subprocess
import sys
from contextlib import ExitStack
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
with ExitStack() as stack:
    tmp = Path(stack.enter_context(tempfile.TemporaryDirectory()))
    proc = subprocess.Popen([sys.executable, "-u", "-m", "creator.server", "--port", "0",
                            "--data", str(tmp/"ui.sqlite")], stdout=subprocess.PIPE, text=True, encoding="utf-8")

    def stop():
        proc.terminate()
        proc.wait(timeout=10)
    stack.callback(stop)
    url = proc.stdout.readline().strip().split()[-1]
    pw = stack.enter_context(sync_playwright())
    b = pw.chromium.launch(executable_path=os.getenv("CREATOR_TEST_CHROMIUM"))
    page = b.new_page(viewport={"width": 1270, "height": 900})
    errors = []
    page.on("pageerror", lambda ex: errors.append(str(ex)))
    page.on("dialog", lambda d: d.accept())
    page.goto(url)
    def click(t):
        page.get_by_role("button", name=t, exact=True).first.click()
        page.locator("#app:not([inert])").wait_for(state="attached")
    def nav(t): page.locator("nav").get_by_role("button", name=t, exact=True).click()

    def source(kind, title, body, url=""):
        click("导入素材")
        page.locator("#kind").select_option(kind)
        page.locator("#url").fill(url)
        page.locator("#title").fill(title)
        page.locator("#excerpt").fill(body)
        click("保存素材")
        page.wait_for_selector("dialog", state="hidden")
    source("X", "原始说明", "合成测试素材，示例版本支持批注。", "https://x.com/example/status/7612")
    source("公众号", "观察与背景", "合成测试素材，提及了试用限制。", "https://mp.weixin.qq.com/s/test-example-7612")
    source("本人观点", "保留原始语境", "合成观点，摘录和批注都应保留语境。")
    source("本人案例", "一次复核", "合成案例，复核时对照了原始说明。")
    click("新建选题")
    page.locator("#topic").fill("怎样保留批注的原始语境？")
    click("创建选题")
    page.wait_for_selector(".grid")
    for id in page.locator("[data-link]").evaluate_all("(nodes) => nodes.map(n => n.dataset.link)"):
        with page.expect_response(lambda r: r.url.endswith("/api/action") and r.status == 200):
            page.locator('[data-link="'+id+'"]').check()
        expect(page.locator('[data-link="'+id+'"]')).to_be_checked()
    click("整理素材提纲")
    expect(page.locator("#body")).to_have_value(re.compile("待写"))
    page.locator("#body").fill("读者需要知道一项结论适用的条件。示例中，批注记录了出处，也保留了原始说明的限制。")
    page.locator("#reason").fill("补回原始语境")
    click("保存改稿")
    click("确认母稿")
    page.get_by_text("已确认，可生成平台稿", exact=True).wait_for()
    nav("平台稿")
    for ch in ["X", "公众号", "小红书"]:
        click(ch)
        page.locator("#ctitle").fill("条件如何影响结论")
        page.locator("#cbody").fill("这是测试稿。\n\n适用条件应保留。")
        if ch == "小红书":
            page.locator("#cards").fill("先看原文\n\n核对条件\n\n留下可追溯的批注")
        click("保存平台稿")
        page.get_by_text("已保存此平台版本。").wait_for()
        with page.expect_download() as dl:
            page.locator('[data-act="export"]').click()
        data = Path(dl.value.path()).read_bytes()
        if ch == "小红书":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                assert len(z.namelist()) == 5
                for name in ["card-01.png", "card-02.png", "card-03.png"]:
                    im = z.read(name)
                    assert im[:8] == b'\x89PNG\r\n\x1a\n' and int.from_bytes(
                        im[16:20], "big") == 1080 and int.from_bytes(im[20:24], "big") == 1440
        elif ch == "公众号":
            assert b"<article>" in data
        else:
            assert "适用条件" in data.decode()
        print(ch, "download OK", len(data))
    nav("写作台")
    page.locator("#body").fill("第二版修正后的母稿。")
    click("保存改稿")
    click("确认母稿")
    nav("平台稿")
    click("导出图文包")
    page.get_by_text("请先核对并保存与当前母稿对应的平台稿。").wait_for()
    page.set_viewport_size({"width": 390, "height": 844})
    nav("写作台")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.reload()
    nav("写作台")
    assert page.locator("#body").input_value() == "第二版修正后的母稿。"
    assert not errors, errors
    print("stale export blocked; mobile width and persistence OK")
    b.close()
