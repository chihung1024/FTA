(() => {
"use strict";
const COLOR_CYCLE = ["normal", "top", "branch", "critical"];
const MAX_DEPTH = 50;
const MM_TO_CSS_PX = 96 / 25.4;
const PRINT_PAGE = Object.freeze({
widthMm: 297,
heightMm: 210,
marginMm: 8,
titleAndGapPx: 58,
safetyPx: 8,
maxScale: 1.25
});
const rootTree = document.getElementById("rootTree");
const treeContainer = document.getElementById("treeContainer");
const projectTitle = document.getElementById("projectTitle");
const importFile = document.getElementById("importFile");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalActions = document.getElementById("modalActions");
const printDocument = document.getElementById("printDocument");
const printHeader = document.getElementById("printHeader");
const printTreeHost = document.getElementById("printTreeHost");
const instructionToast = document.getElementById("instructionToast");
const instructionToastToggle = document.getElementById("instructionToastToggle");
let focusToRestore = null;
function cleanEditable(element) {
const html = element.innerHTML;
if (html === "<br>" || html === "<div><br></div>" || html === "&nbsp;") element.innerHTML = "";
}
function closeModal() {
modalOverlay.classList.remove("active");
modalOverlay.setAttribute("aria-hidden", "true");
const target = focusToRestore;
focusToRestore = null;
if (target && typeof target.focus === "function") target.focus();
}
function showModal({ title, message, type = "confirm", onConfirm }) {
focusToRestore = document.activeElement;
modalTitle.textContent = title;
modalMessage.textContent = message;
modalActions.replaceChildren();
if (type !== "alert") {
const cancel = document.createElement("button");
cancel.type = "button";
cancel.className = "modal-btn modal-btn-cancel";
cancel.textContent = "取消";
cancel.addEventListener("click", closeModal);
modalActions.append(cancel);
}
const confirm = document.createElement("button");
confirm.type = "button";
confirm.className = type === "confirm" ? "modal-btn modal-btn-confirm" : "modal-btn modal-btn-ok";
confirm.textContent = "確定";
confirm.addEventListener("click", () => {
const callback = onConfirm;
closeModal();
if (callback) callback();
});
modalActions.append(confirm);
modalOverlay.removeAttribute("aria-hidden");
modalOverlay.classList.add("active");
confirm.focus();
}
function createButton(className, title, text) {
const button = document.createElement("button");
button.type = "button";
button.className = `ctrl-btn ${className}`;
button.title = title;
button.textContent = text;
return button;
}
function createNodeDOM(data = {}, isRoot = false, depth = 0) {
if (depth > MAX_DEPTH) return null;
const li = document.createElement("li");
if (isRoot) li.id = "rootNode";
const wrapper = document.createElement("div");
wrapper.className = "gate-wrapper";
li.append(wrapper);
const node = document.createElement("div");
const requestedColor = COLOR_CYCLE.includes(data.colorClass) ? data.colorClass : "normal";
node.className = `node ${isRoot ? "top" : requestedColor}`;
wrapper.append(node);
const controls = document.createElement("div");
controls.className = "node-controls";
if (!isRoot) controls.append(createButton("btn-color", "切換節點顏色", "🎨"));
controls.append(createButton("btn-add", "向下新增子節點", "➕"));
if (!isRoot) controls.append(createButton("btn-del", "刪除此節點與下方分支", "❌"));
node.append(controls);
const title = document.createElement("div");
title.className = "title";
title.contentEditable = "true";
title.spellcheck = false;
title.dataset.placeholder = isRoot ? "頂事件 (Top Event)" : "新增事件";
title.textContent = typeof data.title === "string" ? data.title : "";
node.append(title);
const desc = document.createElement("div");
desc.className = "desc";
desc.contentEditable = "true";
desc.spellcheck = false;
desc.dataset.placeholder = isRoot ? "請輸入事故或失效結果描述..." : "點擊輸入描述...";
desc.textContent = typeof data.desc === "string" ? data.desc : "";
node.append(desc);
const children = Array.isArray(data.children)
? data.children.filter(child => child && typeof child === "object" && !Array.isArray(child))
: [];
if (children.length) {
const gateType = data.gateType === "and" ? "and" : "or";
const gate = document.createElement("div");
gate.className = `gate ${gateType} toggle-gate`;
gate.textContent = gateType.toUpperCase();
wrapper.append(gate);
const ul = document.createElement("ul");
children.forEach(child => {
const childNode = createNodeDOM(child, false, depth + 1);
if (childNode) ul.append(childNode);
});
if (ul.childElementCount) li.append(ul);
}
return li;
}
function initCanvas(data = {}) {
rootTree.replaceChildren(createNodeDOM(data, true));
}
function serializeNode(li, depth = 0, context = { depthHit: false }) {
if (depth > MAX_DEPTH) {
context.depthHit = true;
return null;
}
const node = li.querySelector(":scope > .gate-wrapper > .node");
if (!node) return null;
const gate = li.querySelector(":scope > .gate-wrapper > .gate");
const children = [];
li.querySelectorAll(":scope > ul > li").forEach(child => {
const serialized = serializeNode(child, depth + 1, context);
if (serialized) children.push(serialized);
});
return {
title: node.querySelector(".title")?.textContent.trim() || "",
desc: node.querySelector(".desc")?.textContent.trim() || "",
colorClass: COLOR_CYCLE.find(color => node.classList.contains(color)) || "normal",
gateType: gate ? (gate.classList.contains("and") ? "and" : "or") : null,
children
};
}
function removeEmptyAncestors(startUl) {
let ul = startUl;
while (ul && ul !== rootTree && ul.childElementCount === 0) {
const parentLi = ul.parentElement;
ul.remove();
parentLi?.querySelector(":scope > .gate-wrapper > .gate")?.remove();
ul = parentLi?.parentElement;
}
}
treeContainer.addEventListener("click", event => {
const addButton = event.target.closest(".btn-add");
if (addButton) {
const li = addButton.closest("li");
const wrapper = li.querySelector(":scope > .gate-wrapper");
let ul = li.querySelector(":scope > ul");
if (!ul) {
const gate = document.createElement("div");
gate.className = "gate or toggle-gate";
gate.textContent = "OR";
wrapper.append(gate);
ul = document.createElement("ul");
li.append(ul);
}
ul.append(createNodeDOM({}, false));
return;
}
const deleteButton = event.target.closest(".btn-del");
if (deleteButton) {
const li = deleteButton.closest("li");
showModal({
title: "確認刪除",
message: "確定要刪除此節點及其下方的所有分支嗎？此操作無法復原。",
type: "confirm",
onConfirm: () => {
const parentUl = li.parentElement;
li.remove();
removeEmptyAncestors(parentUl);
}
});
return;
}
const colorButton = event.target.closest(".btn-color");
if (colorButton) {
const node = colorButton.closest(".node");
const current = COLOR_CYCLE.find(color => node.classList.contains(color)) || "normal";
const next = COLOR_CYCLE[(COLOR_CYCLE.indexOf(current) + 1) % COLOR_CYCLE.length];
node.classList.replace(current, next);
return;
}
const gate = event.target.closest(".toggle-gate");
if (gate) {
const next = gate.classList.contains("or") ? "and" : "or";
gate.className = `gate ${next} toggle-gate`;
gate.textContent = next.toUpperCase();
}
});
document.addEventListener("paste", event => {
const editable = event.target.closest('[contenteditable="true"]');
if (!editable) return;
event.preventDefault();
const text = event.clipboardData?.getData("text/plain") || "";
if (!document.execCommand("insertText", false, text)) {
const selection = window.getSelection();
if (!selection?.rangeCount) return;
const range = selection.getRangeAt(0);
range.deleteContents();
const textNode = document.createTextNode(text);
range.insertNode(textNode);
range.setStartAfter(textNode);
range.collapse(true);
selection.removeAllRanges();
selection.addRange(range);
}
});
document.addEventListener("input", event => {
if (event.target.matches('[contenteditable="true"]')) cleanEditable(event.target);
if (event.target === projectTitle && projectTitle.textContent.length > 100) {
projectTitle.textContent = projectTitle.textContent.slice(0, 100);
}
});
document.addEventListener("focusout", event => {
if (event.target.matches('[contenteditable="true"]')) cleanEditable(event.target);
});
document.addEventListener("keydown", event => {
if (event.key === "Escape") closeModal();
if (event.key === "Enter" && (event.target.classList.contains("title") || event.target === projectTitle)) {
event.preventDefault();
event.target.blur();
}
});
modalOverlay.addEventListener("mousedown", event => {
if (event.target === modalOverlay) closeModal();
});
instructionToastToggle.addEventListener("click", () => {
const collapsed = instructionToast.classList.toggle("collapsed");
instructionToastToggle.textContent = collapsed ? "💡" : "×";
instructionToastToggle.setAttribute("aria-expanded", String(!collapsed));
instructionToastToggle.setAttribute("aria-label", collapsed ? "展開操作指南" : "收合操作指南");
});
let dragging = false;
let pointerId = null;
let startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;
treeContainer.addEventListener("pointerdown", event => {
if (event.target.closest('[contenteditable="true"], button, .gate')) return;
dragging = true;
pointerId = event.pointerId;
startX = event.clientX;
startY = event.clientY;
startScrollLeft = treeContainer.scrollLeft;
startScrollTop = treeContainer.scrollTop;
treeContainer.setPointerCapture(pointerId);
});
treeContainer.addEventListener("pointermove", event => {
if (!dragging || event.pointerId !== pointerId) return;
treeContainer.scrollLeft = startScrollLeft - (event.clientX - startX) * 1.5;
treeContainer.scrollTop = startScrollTop - (event.clientY - startY) * 1.5;
});
function stopDragging(event) {
if (!dragging || (event && event.pointerId !== pointerId)) return;
dragging = false;
if (pointerId !== null && treeContainer.hasPointerCapture(pointerId)) treeContainer.releasePointerCapture(pointerId);
pointerId = null;
}
treeContainer.addEventListener("pointerup", stopDragging);
treeContainer.addEventListener("pointercancel", stopDragging);
function safeFileTitle(value) {
return (value || "FTA_Project").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
}
function exportTree() {
try {
const context = { depthHit: false };
const treeData = serializeNode(document.getElementById("rootNode"), 0, context);
const title = projectTitle.textContent.trim() || "FTA_Project";
const download = () => {
const blob = new Blob([JSON.stringify({ projectTitle: title, treeData }, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");
const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
anchor.href = url;
anchor.download = `FTA_${safeFileTitle(title)}_${date}.json`;
document.body.append(anchor);
anchor.click();
anchor.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
};
if (context.depthHit) {
showModal({
title: "深度限制警告",
message: "樹狀圖超過 50 層，過深的分支未完整匯出。是否仍要下載？",
type: "warning",
onConfirm: download
});
} else {
download();
}
} catch (error) {
console.error(error);
showModal({ title: "匯出失敗", message: "資料序列化失敗，請確認樹狀結構無異常。", type: "alert" });
}
}
function importTree(event) {
const file = event.target.files?.[0];
if (!file) return;
if (file.size > 5 * 1024 * 1024) {
showModal({ title: "檔案過大", message: "請選擇小於 5MB 的 JSON 檔案。", type: "alert" });
importFile.value = "";
return;
}
const reader = new FileReader();
reader.addEventListener("load", loadEvent => {
try {
const parsed = JSON.parse(loadEvent.target.result);
const treeData = parsed.treeData || parsed;
if (!treeData || typeof treeData !== "object" || Array.isArray(treeData)) throw new Error("invalid tree");
if (parsed.projectTitle) projectTitle.textContent = String(parsed.projectTitle).slice(0, 100);
initCanvas(treeData);
} catch (error) {
console.error(error);
showModal({ title: "讀檔失敗", message: "無法解析此檔案。請確認它是本系統匯出的 JSON。", type: "alert" });
} finally {
importFile.value = "";
}
});
reader.addEventListener("error", () => {
showModal({ title: "讀取失敗", message: "檔案讀取時發生錯誤，請再試一次。", type: "alert" });
importFile.value = "";
});
reader.readAsText(file, "UTF-8");
}
function makePrintableClone() {
const clone = rootTree.cloneNode(true);
clone.removeAttribute("id");
clone.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
clone.querySelectorAll(".node-controls").forEach(element => element.remove());
clone.querySelectorAll('[contenteditable="true"]').forEach(element => {
element.removeAttribute("contenteditable");
element.removeAttribute("spellcheck");
if (!element.textContent.trim()) {
element.textContent = element.dataset.placeholder || "";
element.classList.add("print-placeholder");
}
});
clone.querySelectorAll(".toggle-gate").forEach(element => element.classList.remove("toggle-gate"));
return clone;
}
function preparePrintDocument() {
document.activeElement?.blur?.();
printHeader.textContent = projectTitle.textContent.trim() || "FTA 故障樹";
printTreeHost.replaceChildren(makePrintableClone());
printDocument.classList.add("print-measure");
const naturalWidth = Math.max(printTreeHost.scrollWidth, printTreeHost.getBoundingClientRect().width, 1);
const naturalHeight = Math.max(printTreeHost.scrollHeight, printTreeHost.getBoundingClientRect().height, 1);
printDocument.classList.remove("print-measure");
const pageWidth = (PRINT_PAGE.widthMm - PRINT_PAGE.marginMm * 2) * MM_TO_CSS_PX;
const pageHeight = (PRINT_PAGE.heightMm - PRINT_PAGE.marginMm * 2) * MM_TO_CSS_PX;
const usableWidth = pageWidth - PRINT_PAGE.safetyPx * 2;
const usableHeight = pageHeight - PRINT_PAGE.titleAndGapPx - PRINT_PAGE.safetyPx;
const scale = Math.max(.1, Math.min(usableWidth / naturalWidth, usableHeight / naturalHeight, PRINT_PAGE.maxScale));
printDocument.style.setProperty("--print-scale", scale.toFixed(4));
printDocument.style.setProperty("--print-viewport-height", `${Math.ceil(naturalHeight * scale + 2)}px`);
}
function resetPrintDocument() {
printDocument.style.removeProperty("--print-scale");
printDocument.style.removeProperty("--print-viewport-height");
printTreeHost.replaceChildren();
}
function printAsPdf() {
preparePrintDocument();
requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
document.getElementById("btn-clear").addEventListener("click", () => {
showModal({
title: "清空畫布",
message: "這將清除目前所有內容並恢復初始狀態。確定執行？",
type: "confirm",
onConfirm: () => {
projectTitle.textContent = "互動式 FTA 故障樹編輯器";
initCanvas();
}
});
});
document.getElementById("btn-export").addEventListener("click", exportTree);
document.getElementById("btn-import").addEventListener("click", () => importFile.click());
document.getElementById("btn-print").addEventListener("click", printAsPdf);
importFile.addEventListener("change", importTree);
window.addEventListener("beforeprint", preparePrintDocument);
window.addEventListener("afterprint", resetPrintDocument);
initCanvas();
})();
