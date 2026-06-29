(() => {
  "use strict";

  const MM_TO_CSS_PX = 96 / 25.4;
  const PRINT_PAGE = Object.freeze({
    widthMm: 297,
    heightMm: 210,
    marginMm: 8,
    footerPx: 24,
    verticalSafetyPx: 12,
    horizontalSafetyPx: 16
  });

  const printButton = document.getElementById("btn-print");
  const rootTree = document.getElementById("rootTree");
  const projectTitle = document.getElementById("projectTitle");
  const printDocument = document.getElementById("printDocument");
  const printHeader = document.getElementById("printHeader");
  const printTreeHost = document.getElementById("printTreeHost");

  if (!printButton || !rootTree || !projectTitle || !printDocument || !printHeader || !printTreeHost) return;

  const managedProperties = [
    "--print-scale",
    "--print-title-size",
    "--print-header-height",
    "--print-node-width",
    "--print-node-pad-x",
    "--print-node-pad-y",
    "--print-h-gap",
    "--print-level-gap",
    "--print-gate-size",
    "--print-page-width",
    "--print-viewport-height"
  ];

  function ensureHeaderStructure() {
    let title = document.getElementById("printTitle");
    let meta = document.getElementById("printMeta");
    let date = document.getElementById("printDate");
    let footer = document.getElementById("printFooter");

    if (!title || !meta) {
      const kicker = document.createElement("div");
      kicker.className = "print-kicker";
      kicker.textContent = "FAULT TREE ANALYSIS / 故障樹分析";

      title = document.createElement("div");
      title.id = "printTitle";

      meta = document.createElement("div");
      meta.id = "printMeta";

      printHeader.replaceChildren(kicker, title, meta);
    }

    if (!footer) {
      footer = document.createElement("footer");
      footer.id = "printFooter";
      const label = document.createElement("span");
      label.textContent = "FTA REPORT";
      date = document.createElement("span");
      date.id = "printDate";
      footer.append(label, date);
      printDocument.append(footer);
    } else if (!date) {
      date = document.createElement("span");
      date.id = "printDate";
      footer.append(date);
    }

    return { title, meta, date };
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

  function getTreeStats(rootLi) {
    let nodeCount = 0;
    let leafCount = 0;
    let maxDepth = 0;

    function visit(li, depth) {
      nodeCount += 1;
      maxDepth = Math.max(maxDepth, depth);
      const children = [...li.querySelectorAll(":scope > ul > li")];
      if (children.length === 0) leafCount += 1;
      children.forEach(child => visit(child, depth + 1));
    }

    visit(rootLi, 1);
    return { nodeCount, leafCount, maxDepth };
  }

  function choosePrintProfile(stats) {
    if (stats.leafCount >= 9 && stats.maxDepth <= 4) {
      return {
        nodeWidth: 150,
        nodePadX: 10,
        nodePadY: 9,
        hGap: 4,
        levelGap: 32,
        maxLevelGap: 104,
        gateSize: 33,
        maxScale: 1.72,
        targetHeightFill: .82
      };
    }

    if (stats.maxDepth >= 7) {
      return {
        nodeWidth: 160,
        nodePadX: 11,
        nodePadY: 9,
        hGap: 6,
        levelGap: 24,
        maxLevelGap: 38,
        gateSize: 32,
        maxScale: 1.34,
        targetHeightFill: .9
      };
    }

    return {
      nodeWidth: 170,
      nodePadX: 12,
      nodePadY: 10,
      hGap: 8,
      levelGap: 31,
      maxLevelGap: 82,
      gateSize: 35,
      maxScale: 1.52,
      targetHeightFill: .84
    };
  }

  function applyPrintProfile(profile, levelGap = profile.levelGap) {
    printDocument.style.setProperty("--print-node-width", `${profile.nodeWidth}px`);
    printDocument.style.setProperty("--print-node-pad-x", `${profile.nodePadX}px`);
    printDocument.style.setProperty("--print-node-pad-y", `${profile.nodePadY}px`);
    printDocument.style.setProperty("--print-h-gap", `${profile.hGap}px`);
    printDocument.style.setProperty("--print-level-gap", `${levelGap}px`);
    printDocument.style.setProperty("--print-gate-size", `${profile.gateSize}px`);
  }

  function measurePrintTree(pageWidth) {
    printDocument.style.setProperty("--print-page-width", `${pageWidth}px`);
    printDocument.classList.add("print-measure");
    const naturalWidth = Math.max(printTreeHost.scrollWidth, printTreeHost.getBoundingClientRect().width, 1);
    const naturalHeight = Math.max(printTreeHost.scrollHeight, printTreeHost.getBoundingClientRect().height, 1);
    printDocument.classList.remove("print-measure");
    return { naturalWidth, naturalHeight };
  }

  function calculateTitleLayout(title) {
    const length = [...title].length;
    if (length > 58) return { fontSize: 18, headerHeight: 94 };
    if (length > 36) return { fontSize: 21, headerHeight: 88 };
    if (length > 22) return { fontSize: 23, headerHeight: 82 };
    return { fontSize: 26, headerHeight: 78 };
  }

  function prepareAdaptivePrint() {
    const rootNode = document.getElementById("rootNode");
    if (!rootNode) return;

    document.activeElement?.blur?.();
    const header = ensureHeaderStructure();
    const title = projectTitle.textContent.trim() || "FTA 故障樹";
    const stats = getTreeStats(rootNode);
    const profile = choosePrintProfile(stats);
    const titleLayout = calculateTitleLayout(title);

    header.title.textContent = title;
    header.meta.textContent = `${stats.nodeCount} 個事件 · ${stats.leafCount} 個葉節點 · ${stats.maxDepth} 層結構`;
    header.date.textContent = new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    printTreeHost.replaceChildren(makePrintableClone());
    printDocument.style.removeProperty("--print-viewport-height");
    printDocument.style.setProperty("--print-title-size", `${titleLayout.fontSize}px`);
    printDocument.style.setProperty("--print-header-height", `${titleLayout.headerHeight}px`);

    const pageWidth = (PRINT_PAGE.widthMm - PRINT_PAGE.marginMm * 2) * MM_TO_CSS_PX;
    const pageHeight = (PRINT_PAGE.heightMm - PRINT_PAGE.marginMm * 2) * MM_TO_CSS_PX;
    const usableWidth = pageWidth - PRINT_PAGE.horizontalSafetyPx * 2;
    const usableHeight = pageHeight - titleLayout.headerHeight - PRINT_PAGE.footerPx - PRINT_PAGE.verticalSafetyPx;

    let levelGap = profile.levelGap;
    let scale = 1;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      applyPrintProfile(profile, levelGap);
      const dimensions = measurePrintTree(pageWidth);
      scale = Math.max(.1, Math.min(
        usableWidth / dimensions.naturalWidth,
        usableHeight / dimensions.naturalHeight,
        profile.maxScale
      ));

      const scaledHeight = dimensions.naturalHeight * scale;
      const targetHeight = usableHeight * profile.targetHeightFill;
      if (stats.maxDepth <= 1 || scaledHeight >= targetHeight - 4 || levelGap >= profile.maxLevelGap) break;

      const verticalSegments = Math.max(1, (stats.maxDepth - 1) * 2);
      const neededHeight = targetHeight - scaledHeight;
      const estimatedGapIncrease = Math.ceil(neededHeight / Math.max(scale * verticalSegments, .1));
      levelGap = Math.min(profile.maxLevelGap, levelGap + Math.max(6, estimatedGapIncrease));
    }

    printDocument.style.setProperty("--print-scale", scale.toFixed(4));
  }

  function resetAdaptivePrint() {
    managedProperties.forEach(property => printDocument.style.removeProperty(property));
    printDocument.classList.remove("print-measure");
  }

  printButton.addEventListener("click", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (document.fonts?.ready) await document.fonts.ready;
    prepareAdaptivePrint();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, true);

  window.addEventListener("beforeprint", prepareAdaptivePrint);
  window.addEventListener("afterprint", resetAdaptivePrint);
})();
