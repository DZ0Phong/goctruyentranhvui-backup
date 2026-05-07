(function initExporter() {
  const state = {
    running: false,
    scannedRows: [],
    lastResult: null
  };

  const config = {
    selectors: {
      carouselRoot: [
        ".items-title"
      ],
      item: [
        ".card-reader[data-card]",
        "[data-card].card-reader",
        "[data-card]"
      ],
      titleLink: [
        ".card-info .card-name",
        "a.card-name",
        "a[title][href*='/truyen/']",
        "a[href*='/truyen/']"
      ],
      timelineItems: [
        ".card-timeline .timeline-item",
        ".timeline .timeline-item"
      ],
      nextPage: [
        ".items-title button.next[title='Sau']",
        ".items-title .next[title='Sau']",
        "button.next[title='Sau']",
        ".next[title='Sau']"
      ],
      prevPage: [
        ".items-title button.prev[title='Trước']",
        ".items-title .prev[title='Trước']",
        "button.prev[title='Trước']",
        ".prev[title='Trước']"
      ],
      detail: [
        ".start-chapter",
        ".btn-recent",
        ".btn-start"
      ],
      chapterCards: [
        "a.v-card-link[href*='/chuong-']",
        "a[href*='/chuong-'].v-card"
      ]
    },
    timings: {
      afterClickMs: 1200,
      detailRenderTimeoutMs: 9000
    },
    detailConcurrency: 2,
    maxPages: 100
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_SCAN_STATUS") {
      sendResponse({
        ok: true,
        ready: state.scannedRows.length > 0,
        running: state.running,
        result: state.lastResult
      });
      return;
    }

    if (message?.type === "DOWNLOAD_CSV") {
      try {
        if (state.scannedRows.length === 0) {
          throw new Error("Chua co du lieu. Hay bam Quet truoc.");
        }

        downloadCsv(state.scannedRows);
        sendResponse({
          ok: true,
          message: `Da tai CSV voi ${state.scannedRows.length} truyen.`
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message
        });
      }
      return;
    }

    if (message?.type !== "START_SCAN" && message?.type !== "START_EXPORT") {
      return;
    }

    if (state.running) {
      sendResponse({
        ok: false,
        error: "Tien trinh quet dang chay. Hay doi xong roi thu lai."
      });
      return;
    }

    state.running = true;

    runScan()
      .then((result) => {
        state.scannedRows = result.rows;
        state.lastResult = {
          pageCount: result.pageCount,
          storyCount: result.rows.length,
          scannedAt: new Date().toISOString()
        };

        sendResponse({
          ok: true,
          ready: true,
          result: state.lastResult,
          message: result.message
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      })
      .finally(() => {
        state.running = false;
      });

    return true;
  });

  async function runScan() {
    assertFollowPage();
    await rewindToFirstPage();

    const rows = [];
    const seenKeys = new Set();
    let pageCount = 0;

    while (pageCount < config.maxPages) {
      pageCount += 1;
      await waitForPageReady();

      const items = collectCurrentPageItems();
      const pageSignature = createPageSignature(items);

      for (const item of items) {
        const key = `${item.title}::${item.link}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          rows.push(item);
        }
      }

      const nextButton = findNextPageButton();
      if (!nextButton) {
        break;
      }

      nextButton.click();
      const changed = await waitForPageChange(pageSignature);
      if (!changed) {
        break;
      }
    }

    if (rows.length === 0) {
      throw new Error(
        "Chua quet duoc dong du lieu nao. Can bo sung selector tu HTML that cua trang Theo Doi."
      );
    }

    const enrichedRows = await enrichRowsWithDetailPages(rows);

    return {
      rows: enrichedRows,
      pageCount,
      message: `Quet xong ${enrichedRows.length} truyen tu ${pageCount} trang.`
    };
  }

  function assertFollowPage() {
    if (!location.pathname.includes("/truyen/theo-doi")) {
      throw new Error("Ban can mo dung trang /truyen/theo-doi.");
    }
  }

  async function waitForPageReady() {
    if (document.readyState === "complete") {
      return;
    }

    await new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  }

  function collectCurrentPageItems() {
    const containers = findStoryContainers();
    return containers
      .map(extractStoryData)
      .filter((item) => item && item.title && item.link);
  }

  function findStoryContainers() {
    for (const selector of config.selectors.item) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length > 0) {
        return nodes;
      }
    }

    return Array.from(document.querySelectorAll("a[href*='/truyen/']"))
      .map((link) => link.closest("article, li, .item, .row, .media"))
      .filter(Boolean);
  }

  function extractStoryData(container) {
    const titleLink = findFirstWithin(container, config.selectors.titleLink);
    if (!titleLink) {
      return null;
    }

    const title =
      normalizeText(titleLink.textContent) ||
      normalizeText(container.getAttribute("title")) ||
      normalizeText(container.getAttribute("data-card"));
    const link = toAbsoluteUrl(titleLink.getAttribute("href") || titleLink.href || "");
    const chapterSummary = extractVisibleChapterSummary(container);
    const progressText =
      chapterSummary ||
      inferProgressText(container) ||
      "Chua co HTML chap dang doc";

    return {
      title,
      link,
      progress: progressText,
      continueChapter: "",
      latestChapter: chapterSummary,
      latestUnreadChapter: "",
      note: chapterSummary
        ? "Tien do tam thoi lay tu danh sach ngoai"
        : "Can HTML trong trang doc de lay chap dang doc that"
    };
  }

  async function enrichRowsWithDetailPages(rows) {
    return mapWithConcurrency(rows, config.detailConcurrency, async (row) => {
      try {
        const detail = await fetchStoryDetail(row.link);

        return {
          ...row,
          progress: detail.progress || row.progress,
          continueChapter: detail.continueChapter || "",
          latestChapter: detail.latestChapter || row.latestChapter,
          latestUnreadChapter: detail.latestUnreadChapter || "",
          note: detail.note || row.note
        };
      } catch (error) {
        return {
          ...row,
          note: `Khong doc duoc trang chi tiet: ${error.message}`
        };
      }
    });
  }

  async function fetchStoryDetail(url) {
    try {
      return await renderStoryDetailInIframe(url);
    } catch (renderError) {
      const staticDetail = await fetchStaticStoryDetail(url);
      return {
        ...staticDetail,
        note: `${staticDetail.note} (doc tu HTML tinh vi render iframe loi: ${renderError.message})`
      };
    }
  }

  async function fetchStaticStoryDetail(url) {
    const response = await fetch(url, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return extractDetailProgress(doc);
  }

  async function renderStoryDetailInIframe(url) {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.cssText = [
      "position: fixed",
      "left: -9999px",
      "top: -9999px",
      "width: 1px",
      "height: 1px",
      "opacity: 0",
      "pointer-events: none",
      "border: 0"
    ].join(";");

    try {
      const loadPromise = waitForIframeLoad(iframe);
      document.body.appendChild(iframe);
      await loadPromise;
      await waitForDetailRender(iframe);
      return extractDetailProgress(iframe.contentDocument);
    } finally {
      iframe.remove();
    }
  }

  function waitForIframeLoad(iframe) {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("timeout khi load iframe"));
      }, config.timings.detailRenderTimeoutMs);

      function cleanup() {
        window.clearTimeout(timeout);
        iframe.removeEventListener("load", handleLoad);
        iframe.removeEventListener("error", handleError);
      }

      function handleLoad() {
        cleanup();
        resolve();
      }

      function handleError() {
        cleanup();
        reject(new Error("iframe load loi"));
      }

      iframe.addEventListener("load", handleLoad, { once: true });
      iframe.addEventListener("error", handleError, { once: true });
    });
  }

  async function waitForDetailRender(iframe) {
    const start = Date.now();

    while (Date.now() - start < config.timings.detailRenderTimeoutMs) {
      const doc = iframe.contentDocument;
      if (!doc) {
        throw new Error("khong doc duoc iframe document");
      }

      const hasReaderButtons = Boolean(
        doc.querySelector(".start-chapter .btn-recent, .start-chapter .btn-start")
      );
      const hasChapters = doc.querySelectorAll(config.selectors.chapterCards.join(",")).length > 0;

      if (hasReaderButtons && hasChapters) {
        await delay(250);
        return;
      }

      await delay(250);
    }

    throw new Error("timeout khi doi trang chi tiet render");
  }

  function extractDetailProgress(doc) {
    const recentButton = doc.querySelector(".start-chapter .btn-recent");
    const startButton = doc.querySelector(".start-chapter .btn-start");
    const continueChapter = recentButton
      ? extractChapterLabel(recentButton) || extractChapterFromUrl(recentButton.getAttribute("href"))
      : "";
    const chapterCards = Array.from(
      doc.querySelectorAll(config.selectors.chapterCards.join(","))
    );
    const latestChapter = chapterCards.length > 0 ? extractChapterLabel(chapterCards[0]) : "";
    const latestUnread = chapterCards.find((card) => !card.classList.contains("read"));
    const latestUnreadChapter = latestUnread ? extractChapterLabel(latestUnread) : "";

    if (continueChapter) {
      return {
        progress: `Da doc toi ${continueChapter}`,
        continueChapter,
        latestChapter,
        latestUnreadChapter,
        note: latestUnreadChapter
          ? `Co chap chua doc moi nhat ${latestUnreadChapter}`
          : "Tat ca chap hien thi da doc"
      };
    }

    if (startButton) {
      return {
        progress: "Chua doc",
        continueChapter: "",
        latestChapter,
        latestUnreadChapter,
        note: latestChapter
          ? `Chua doc, co the bat dau tu ${latestChapter}`
          : "Chua doc"
      };
    }

    return {
      progress: "Chua xac dinh",
      continueChapter: "",
      latestChapter,
      latestUnreadChapter,
      note: "Khong thay nut Doc Tiep hoac Doc Tu Dau trong trang chi tiet"
    };
  }

  function extractChapterLabel(node) {
    const text =
      normalizeText(node.querySelector(".chapter-info span")?.textContent) ||
      normalizeText(node.textContent);

    if (text.includes("#")) {
      const label = normalizeText(text.slice(text.indexOf("#") + 1));
      if (label) {
        return `#${label}`;
      }
    }

    const urlChapter = extractChapterFromUrl(node.getAttribute("href"));
    return urlChapter || "";
  }

  function extractChapterFromUrl(href) {
    const match = (href || "").match(/chuong-([^/?#]+)/i);
    if (!match) {
      return "";
    }

    return `#${decodeURIComponent(match[1])}`;
  }

  function extractVisibleChapterSummary(container) {
    const timelineItems = findAllWithin(container, config.selectors.timelineItems);
    if (timelineItems.length === 0) {
      return "";
    }

    const labels = timelineItems
      .slice(0, 2)
      .map((item) => {
        const numberNode = item.querySelector(".timeline-info .number");
        const timeNode = item.querySelector(".timeline-info .time");
        const number = normalizeText(numberNode?.textContent).replace(/^#\s*/i, "");
        const time = normalizeText(timeNode?.textContent);

        if (!number) {
          return "";
        }

        return time ? `${number} (${time})` : number;
      })
      .filter(Boolean);

    return labels.join(" | ");
  }

  function inferProgressText(container) {
    const text = normalizeText(container.textContent);
    if (!text) {
      return "";
    }

    const chapterMatch = text.match(/(chap|chuong)\s*[:\-]?\s*([0-9]+(\.[0-9]+)?)/i);
    if (chapterMatch) {
      return chapterMatch[0];
    }

    if (/chua doc/i.test(text)) {
      return "Chua doc";
    }

    return "";
  }

  function findNextPageButton() {
    for (const selector of config.selectors.nextPage) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const matched = candidates.find(isNextPageCandidate);
      if (matched) {
        return matched;
      }
    }

    return null;
  }

  async function rewindToFirstPage() {
    await waitForPageReady();

    for (let step = 0; step < config.maxPages; step += 1) {
      const items = collectCurrentPageItems();
      const pageSignature = createPageSignature(items);
      const prevButton = findPrevPageButton();

      if (!prevButton) {
        return;
      }

      prevButton.click();
      const changed = await waitForPageChange(pageSignature);
      if (!changed) {
        return;
      }
    }
  }

  function findPrevPageButton() {
    for (const selector of config.selectors.prevPage) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const matched = candidates.find(isPrevPageCandidate);
      if (matched) {
        return matched;
      }
    }

    return null;
  }

  function isNextPageCandidate(node) {
    if (!node || isVisuallyDisabled(node)) {
      return false;
    }

    const text = normalizeText(node.textContent);
    const label = normalizeText(
      `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""}`
    );
    const href = node.getAttribute("href") || "";

    return (
      /trang\s*sau|next|sau/i.test(`${text} ${label}`) ||
      /page=\d+/i.test(href) ||
      node.classList.contains("next")
    );
  }

  function isPrevPageCandidate(node) {
    if (!node || isVisuallyDisabled(node)) {
      return false;
    }

    const text = normalizeText(node.textContent);
    const label = normalizeText(
      `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""}`
    );

    return /trang\s*truoc|trang\s*trước|previous|prev|truoc|trước/i.test(`${text} ${label}`) ||
      node.classList.contains("prev");
  }

  function isVisuallyDisabled(node) {
    if (
      node.hasAttribute("disabled") ||
      node.getAttribute("aria-disabled") === "true"
    ) {
      return true;
    }

    const icon = node.querySelector("svg, .v-icon-svg, .v-icon");
    const classBlob = normalizeText(
      `${node.className || ""} ${icon?.className?.baseVal || ""} ${icon?.className || ""}`
    );

    return /disabled|text--disabled/i.test(classBlob);
  }

  async function waitForPageChange(previousSignature) {
    const start = Date.now();

    while (Date.now() - start < 10000) {
      await delay(250);
      const items = collectCurrentPageItems();
      const nextSignature = createPageSignature(items);
      if (nextSignature && nextSignature !== previousSignature) {
        return true;
      }
    }

    return false;
  }

  function createPageSignature(items) {
    return items
      .slice(0, 6)
      .map((item) => item.link || item.title)
      .join("||");
  }

  async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
  }

  function findFirstWithin(container, selectors) {
    for (const selector of selectors) {
      const node = container.querySelector(selector);
      if (node) {
        return node;
      }
    }
    return null;
  }

  function findAllWithin(container, selectors) {
    for (const selector of selectors) {
      const nodes = Array.from(container.querySelectorAll(selector));
      if (nodes.length > 0) {
        return nodes;
      }
    }

    return [];
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function toAbsoluteUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, location.origin).href;
    } catch {
      return value;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function downloadCsv(rows) {
    const headers = [
      "STT",
      "Ten truyen",
      "Tien do doc",
      "Doc tiep",
      "Chap moi nhat",
      "Chap chua doc moi nhat",
      "Ghi chu"
    ];
    const lines = [
      headers.join(","),
      ...rows.map((row, index) => [
        escapeCsv(index + 1),
        escapeCsv(row.title),
        escapeCsv(row.progress),
        escapeCsv(row.continueChapter),
        escapeCsv(row.latestChapter),
        escapeCsv(row.latestUnreadChapter),
        escapeCsv(row.note)
      ].join(","))
    ];

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "truyen_dang_theo_doi.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeCsv(value) {
    const normalized = `${value ?? ""}`.replace(/"/g, "\"\"");
    return `"${normalized}"`;
  }
})();
