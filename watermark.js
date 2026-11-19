"use strict";

const cameraWatermark = (() => {
  const yuandaoFields = [
    ["longitude", "经度"], ["latitude", "纬度"], ["system", "坐标系"],
    ["address", "地址"], ["time", "时间"], ["altitude", "海拔"],
    ["weather", "天气"], ["note", "备注"],
  ];
  const templates = [{
    id: "yuandao-onsite",
    name: "元道-现场拍照",
    draw: drawYuandaoOnsite,
    example: (time) => ({
      longitude: "108.000000", latitude: "34.000000", system: "WGS84坐标系",
      address: "示例市新城大道 40 号 · 城市公园", time,
      altitude: "370.3米", weather: "多云 3 ~ 10°C 东风", note: "随手记录", weatherIcon: "auto",
    }),
  }];
  const getTemplate = (id) => templates.find((template) => template.id === id) ?? templates[0];
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("zh-CN", { granularity: "grapheme" })
    : null;
  const chars = (text) => segmenter
    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
    : Array.from(text);

  const weatherPatterns = [
    ["thunder", /雷|闪电/],
    ["snow", /雪|冰粒/],
    ["rain", /雨/],
    ["fog", /雾|霾/],
    ["partly-cloudy", /多云|少云|晴间多云|云间晴/],
    ["cloudy", /阴/],
    ["sunny", /晴/],
  ];
  const weatherLabels = /^(雷阵雨|雷雨|雨夹雪|暴雪|大雪|中雪|小雪|雪|暴雨|阵雨|大雨|中雨|小雨|雨|大雾|轻雾|雾|霾|多云|少云|阴天|阴|晴天|晴)(?=$|[\s\d+\-−，,：:])/;

  function weatherRow(text, selection) {
    const detect = (value) => weatherPatterns.find(([, pattern]) => pattern.test(value))?.[0];
    const leading = text.match(weatherLabels)?.[0];
    const icon = selection === "none" ? null
      : !selection || selection === "auto" ? detect(leading || text)
      : selection;
    if (!icon) return text ? { text: "天气： " + text } : null;
    // The icon replaces a simple condition label; leave descriptions such as “多云转阴” intact.
    const details = leading && detect(leading) === icon
      ? text.slice(leading.length).replace(/^[\s，,：:]+/, "") : text;
    return { prefix: "天气：", text: details, icon };
  }

  function wrap(ctx, text, maxWidth, firstOffset = 0) {
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const char of chars(paragraph)) {
        const available = lines.length ? maxWidth : maxWidth - firstOffset;
        if (line && ctx.measureText(line + char).width > available) {
          lines.push(line.trimEnd());
          line = char.trimStart();
        } else line += char;
      }
      lines.push(line);
    }
    return lines;
  }

  function drawWeatherIcon(ctx, type, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.shadowBlur = ctx.shadowOffsetY = 0;
    ctx.lineCap = ctx.lineJoin = "round";
    const fill = (path, color) => {
      ctx.fillStyle = color;
      ctx.fill(new Path2D(path));
    };
    const stroke = (path, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke(new Path2D(path));
    };
    const sun = (cx, cy, radius) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(radius / 5, radius / 5);
      stroke("M0-8V-6.6 M5.65-5.65l-1 1 M8 0H6.6 M5.65 5.65l-1-1 M0 8V6.6 M-5.65 5.65l1-1 M-8 0h1.4 M-5.65-5.65l1 1", "#ffd653", 1.35);
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffc438";
      ctx.fill();
      ctx.restore();
    };
    const cloud = "M6 17a4 4 0 0 1-.4-8 5.8 5.8 0 0 1 10.9 1.5h.4a3.3 3.3 0 0 1 0 6.6Z";
    switch (type) {
      case "sunny":
        sun(12, 12, 5.6);
        break;
      case "partly-cloudy":
        sun(8.1, 10.0, 4.6);
        ctx.translate(4.1, 5);
        ctx.scale(1, 0.85);
        stroke(cloud, "#d7dfe5", 0.6);
        fill(cloud, "#fff");
        break;
      case "cloudy":
        ctx.translate(1.4, 1.2);
        fill(cloud, "#e1e7eb");
        break;
      case "rain":
        fill(cloud, "#e1e7eb");
        stroke("M8 18.8l-1.2 3 M12 18.8l-1.2 3 M16 18.8l-1.2 3", "#74c5ff", 1.5);
        break;
      case "thunder":
        fill(cloud, "#e1e7eb");
        fill("m12 15-3 5h3l-1 3.5 5-6h-3l1-2.5z", "#ffd653");
        break;
      case "snow":
        fill(cloud, "#e1e7eb");
        stroke("M8 18.8v3.4 M6.5 19.65l3 1.7 M6.5 21.35l3-1.7 M15 18.8v3.4 M13.5 19.65l3 1.7 M13.5 21.35l3-1.7", "#c4eaff", 1);
        break;
      case "fog":
        ctx.translate(0, -2);
        fill(cloud, "#e1e7eb");
        stroke("M3.5 18.5H17 M6.5 21H21", "#d7e2e9", 1.45);
        break;
    }
    ctx.restore();
  }

  function drawCenterMark(ctx, text, width, height, edge, family) {
    if (!text) return;
    ctx.save();
    const font = edge * 0.076;
    ctx.font = `700 ${font}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = font * 0.043;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.27)";
    ctx.fillStyle = "rgba(32, 32, 32, 0.20)";
    ctx.strokeText(text, width / 2, height / 2, width * 0.86);
    ctx.fillText(text, width / 2, height / 2, width * 0.86);
    ctx.restore();
  }

  function drawSignature(ctx, text, right, baseline, maxWidth, edge, family) {
    ctx.save();
    const glyphs = chars(text);
    const naturalFont = edge * 0.021;
    ctx.font = `600 ${naturalFont}px ${family}`;
    const advances = glyphs.map((glyph) => ctx.measureText(glyph).width + naturalFont * 0.03);
    const total = advances.reduce((sum, advance) => sum + advance, 0);
    const ratio = Math.min(1, maxWidth / total);
    const span = total * ratio;
    const rise = glyphs.length > 1 ? Math.min(span * 0.14, edge * 0.018) : 0;
    ctx.font = `600 ${naturalFont * ratio}px ${family}`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = naturalFont * ratio * 0.08;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
    ctx.fillStyle = "rgba(54, 54, 54, 0.52)";
    ctx.shadowBlur = ctx.shadowOffsetY = 0;
    let position = 0;
    glyphs.forEach((glyph, index) => {
      const advance = advances[index] * ratio;
      const center = position + advance / 2;
      const t = (center / span) * 2 - 1;
      ctx.save();
      ctx.translate(right - span + center, baseline - rise * (1 - t * t));
      ctx.rotate(Math.atan(4 * rise * t / span));
      ctx.strokeText(glyph, 0, 0);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
      position += advance;
    });
    ctx.restore();
  }

  function render(canvas, image, settings, output, scale = 1) {
    const { width, height } = output;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("此浏览器无法绘制照片。");
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    if (settings.format === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    if (!settings.original) getTemplate(settings.templateId).draw(ctx, settings, output, scale);
  }

  function drawYuandaoOnsite(ctx, settings, { width, height }, scale) {
    const edge = Math.min(width, height);
    const left = edge * 0.028;
    const bottom = edge * 0.032;
    const family = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
    const rows = yuandaoFields.flatMap(([id, label]) => {
      const value = settings[id]?.trim() ?? "";
      const row = id === "weather" ? weatherRow(value, settings.weatherIcon)
        : value ? { text: label + "： " + value } : null;
      return row ? [row] : [];
    });
    let font = edge * 0.037 * (settings.size / 100);
    const blockWidth = Math.min(width - left * 2, Math.max(width * 0.52, edge * 0.51 * (settings.size / 100)));
    let lines;
    let step;
    for (;;) {
      ctx.font = `${font}px ${family}`;
      lines = rows.flatMap(({ text, prefix, icon }) => {
        const iconX = icon ? ctx.measureText(prefix).width : 0;
        const offset = icon ? iconX + font * 1.30 : 0;
        return wrap(ctx, text, blockWidth, offset).map((line, index) =>
          icon && index === 0 ? { line, prefix, icon, iconX, offset } : { line });
      });
      step = font * 1.36;
      if (lines.length * step <= height - bottom * 2) break;
      font *= 0.88;
    }

    if (settings.shade && (lines.length || settings.signature)) {
      const shadeHeight = Math.min(height, Math.max(edge * 0.17, lines.length * step + bottom * 2));
      const shade = ctx.createLinearGradient(0, height - shadeHeight, 0, height);
      shade.addColorStop(0, "rgba(0, 0, 0, 0)");
      shade.addColorStop(1, "rgba(0, 0, 0, 0.56)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, height - shadeHeight, width, shadeHeight);
    }
    drawCenterMark(ctx, settings.centerMark, width, height, edge, family);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = font * 0.10 * scale;
    ctx.shadowOffsetY = font * 0.025 * scale;
    lines.forEach(({ line, prefix, icon, iconX, offset = 0 }, index) => {
      const baseline = height - bottom - (lines.length - 1 - index) * step;
      if (icon) {
        ctx.fillText(prefix, left, baseline);
        drawWeatherIcon(ctx, icon, left + iconX, baseline - font * 0.88, font * 1.12);
      }
      ctx.fillText(line, left + offset, baseline);
    });

    if (settings.signature) {
      const allowed = width - (lines.length ? left + blockWidth + left : left) - left;
      drawSignature(ctx, settings.signature, width - left, height - bottom, allowed, edge, family);
    }
  }

  function outputSize(width, height) {
    const limit = Math.min(1, 8192 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
    return { width: Math.max(1, Math.floor(width * limit)), height: Math.max(1, Math.floor(height * limit)) };
  }

  return { templates, getTemplate, render, outputSize };
})();
