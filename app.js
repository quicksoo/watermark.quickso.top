"use strict";

const $ = (id) => document.getElementById(id);
const fileInput = $("file");
const stage = $("stage");
const preview = $("preview");
const save = $("save");
const format = $("format");
const form = $("settings");
const templatePicker = $("watermark-template");
const templatePanels = [...form.querySelectorAll("[data-template-panel]")];
let photo = null;
let photoUrl = "";
let resultUrl = "";
let lastResultUrl = "";
let renderFrame = 0;
let dragDepth = 0;
let loadRevision = 0;
let busy = false;
let loading = false;

for (const { id, name } of cameraWatermark.templates) {
  templatePicker.append(new Option(name, id));
}

function selectTemplate(id) {
  const template = cameraWatermark.getTemplate(id);
  templatePicker.value = template.id;
  for (const panel of templatePanels) {
    panel.disabled = panel.hidden = panel.dataset.templatePanel !== template.id;
  }
  $("example").hidden = !template.example;
}

selectTemplate();

if (new URLSearchParams(location.search).get("embed") === "1") {
  document.querySelector(".topbar").hidden = true;
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex,follow";
  document.head.append(robots);
}

function status(message, error = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(error);
}

function localTime(date = new Date()) {
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

function options() {
  const data = new FormData(form);
  const settings = Object.fromEntries(data);
  settings.templateId = templatePicker.value;
  if (settings.time) {
    if (settings.time.length === 16) settings.time += ":00";
    settings.time = settings.time.replace("T", " ");
  }
  settings.size = Number(data.get("size") ?? 100);
  settings.centerMark = settings.centerMark?.trim();
  settings.signature = settings.signature?.trim();
  settings.shade = data.has("shade");
  settings.format = format.value;
  return settings;
}

function redraw() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    if (!photo) return;
    const settings = { ...options(), original: $("original").checked };
    const { width, height } = photo.output;
    const scale = Math.min(1, 1440 / Math.max(width, height), Math.sqrt(1_500_000 / (width * height)));
    cameraWatermark.render(preview, photo.image, settings, photo.output, scale);
  });
}

function invalidateResult() {
  $("result").hidden = true;
  $("result-link").removeAttribute("href");
}

async function load(file) {
  if (!file) return;
  const revision = ++loadRevision;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  loading = true;
  save.disabled = true;
  status("正在打开照片…");
  try {
    await image.decode();
    if (revision !== loadRevision) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error("Empty image");
    const output = cameraWatermark.outputSize(width, height);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = url;
    photo = { image, name: file.name, output };
    $("file-name").textContent = file.name;
    $("dimensions").textContent = `${width} × ${height} 像素`;
    $("original").checked = false;
    $("original").disabled = false;
    $("empty").hidden = true;
    $("replace").hidden = false;
    preview.hidden = false;
    invalidateResult();
    status(output.width !== width || output.height !== height
      ? `照片较大，下载尺寸为 ${output.width} × ${output.height} 像素。`
      : "");
    redraw();
  } catch {
    if (revision !== loadRevision) return;
    status("无法打开这张照片。请换一张图片，或先将原图转换为 JPG 或 PNG。", true);
  } finally {
    if (url !== photoUrl) URL.revokeObjectURL(url);
    if (revision === loadRevision) {
      loading = false;
      save.disabled = !photo || busy;
    }
  }
}

fileInput.addEventListener("change", () => {
  load(fileInput.files[0]);
  fileInput.value = "";
});
for (const id of ["choose", "replace"]) $(id).addEventListener("click", () => fileInput.click());
const isFileDrag = (event) => event.dataTransfer?.types.includes("Files");
window.addEventListener("dragover", (event) => {
  if (isFileDrag(event)) event.preventDefault();
});
window.addEventListener("drop", (event) => {
  if (isFileDrag(event)) event.preventDefault();
});
stage.addEventListener("dragenter", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth += 1;
  stage.classList.add("dragging");
});
stage.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) stage.classList.remove("dragging");
});
stage.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  stage.classList.remove("dragging");
  load(event.dataTransfer.files[0]);
});

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", (event) => {
  if (event.target !== templatePicker) updateSettings();
});
templatePicker.addEventListener("change", () => {
  selectTemplate(templatePicker.value);
  updateSettings();
});
$("original").addEventListener("change", redraw);

function updateSettings() {
  $("size-value").value = $("size").value + "%";
  invalidateResult();
  redraw();
}

$("now").addEventListener("click", () => {
  $("time").value = localTime();
  updateSettings();
});
$("example").addEventListener("click", () => {
  const template = cameraWatermark.getTemplate(templatePicker.value);
  const panel = templatePanels.find((item) => item.dataset.templatePanel === template.id);
  if (!panel || !template.example) return;
  for (const [name, value] of Object.entries(template.example(localTime()))) {
    const field = panel.elements.namedItem(name);
    if (field) field.value = value;
  }
  updateSettings();
});

save.addEventListener("click", async () => {
  if (!photo || busy || loading) return;
  busy = true;
  save.disabled = true;
  const target = photo;
  const settings = options();
  const canvas = document.createElement("canvas");
  status("正在生成照片…");
  try {
    await new Promise((resolve) => setTimeout(resolve, 0));
    cameraWatermark.render(canvas, target.image, settings, target.output);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, settings.format, 0.95));
    if (!blob) throw new Error("Cannot encode image");
    const url = URL.createObjectURL(blob);
    if (lastResultUrl) URL.revokeObjectURL(lastResultUrl);
    lastResultUrl = resultUrl;
    resultUrl = url;
    const filename = (target.name.replace(/\.[^.]+$/, "") || "照片") + "-水印." +
      (settings.format === "image/png" ? "png" : "jpg");
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    if (photo === target && JSON.stringify(settings) === JSON.stringify(options())) {
      $("result-link").href = url;
      $("result").hidden = false;
      status(`已发起下载 · ${target.output.width} × ${target.output.height} 像素`);
    }
  } catch {
    if (photo === target) status("未能生成照片，请尝试更换图片或下载格式。", true);
  } finally {
    canvas.width = canvas.height = 0;
    busy = false;
    save.disabled = !photo || loading;
  }
});
