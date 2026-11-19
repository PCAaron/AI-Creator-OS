export function cardPNG(text, n, createCanvas = () => document.createElement("canvas")) {
  const canvas = createCanvas();
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = n ? "#f5f3e9" : "#1f4937";
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = n ? "#234735" : "#f9f7e9";
  ctx.font = "36px sans-serif";
  ctx.fillText(String(n + 1).padStart(2, "0"), 72, 100);
  let size = 74,
    lines;
  do {
    ctx.font = "600 " + size + "px sans-serif";
    lines = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const char of para) {
        if (line && ctx.measureText(line + char).width > 920) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
    }
    if (lines.length * size * 1.5 < 1080) break;
    size -= 2;
  } while (size >= 20);
  if (lines.length * size * 1.5 >= 1080) throw Error("图卡文字过密，请拆成两张。");
  lines.forEach((l, i) => ctx.fillText(l, 72, 260 + i * size * 1.5));
  return canvas.toDataURL("image/png").split(",")[1];
}
