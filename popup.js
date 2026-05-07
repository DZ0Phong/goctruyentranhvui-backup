const scanButton = document.getElementById("scanButton");
const downloadButton = document.getElementById("downloadButton");
const statusElement = document.getElementById("status");
const pageValue = document.getElementById("pageValue");
const storyValue = document.getElementById("storyValue");
const etaValue = document.getElementById("etaValue");
const phaseText = document.getElementById("phaseText");
const percentText = document.getElementById("percentText");
const progressBar = document.getElementById("progressBar");

let statusTimer = null;

function setStatus(title, body = "") {
  statusElement.innerHTML = `<strong>${escapeHtml(title)}</strong>${body ? `<br>${escapeHtml(body)}` : ""}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setBusy(isBusy) {
  scanButton.disabled = isBusy;
  downloadButton.disabled = isBusy || downloadButton.dataset.ready !== "true";
}

function setDownloadReady(isReady) {
  downloadButton.dataset.ready = isReady ? "true" : "false";
  downloadButton.disabled = !isReady;
}

function updateProgressBar(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
  progressBar.style.width = `${safePercent}%`;
  percentText.textContent = `${safePercent}%`;
}

function updateStats({ pages = "-", stories = "-", eta = "-" } = {}) {
  pageValue.textContent = pages;
  storyValue.textContent = stories;
  etaValue.textContent = eta;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "-";
  }

  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function estimateRemaining(progress) {
  if (!progress || progress.phase !== "reading_details") {
    return "-";
  }

  if (!progress.detailStartedAt || progress.detailDone <= 0) {
    return "Đang tính";
  }

  const elapsed = Date.now() - progress.detailStartedAt;
  const average = elapsed / progress.detailDone;
  const remaining = Math.max(0, progress.detailTotal - progress.detailDone);
  return formatDuration(average * remaining);
}

function formatScanResult(result) {
  if (!result) {
    return;
  }

  updateStats({
    pages: result.pageCount,
    stories: result.storyCount,
    eta: "0s"
  });
  updateProgressBar(100);
  phaseText.textContent = "Hoàn tất";
  setStatus("Đã quét xong", `${result.storyCount} truyện từ ${result.pageCount} trang. Có thể tải CSV.`);
}

function renderProgress(progress) {
  if (!progress) {
    return;
  }

  updateStats({
    pages: progress.pageCount || "-",
    stories: progress.storyCount || "-",
    eta: estimateRemaining(progress)
  });

  if (progress.phase === "rewinding") {
    phaseText.textContent = "Đang về trang đầu";
    updateProgressBar(3);
    setStatus("Đang quay về trang đầu tiên", "Extension sẽ quét từ đầu để tránh thiếu truyện.");
    return;
  }

  if (progress.phase === "scanning_pages") {
    phaseText.textContent = "Đang gom danh sách";
    updateProgressBar(12);
    setStatus("Đang quét danh sách", `${progress.storyCount || 0} truyện đã được ghi nhận.`);
    return;
  }

  if (progress.phase === "reading_details") {
    const total = progress.detailTotal || 0;
    const done = progress.detailDone || 0;
    const percent = total > 0 ? 15 + (done / total) * 85 : 15;
    const current = progress.currentTitle || "Đang tải trang chi tiết...";

    phaseText.textContent = `Đọc tiến độ ${done}/${total}`;
    updateProgressBar(percent);
    setStatus(current, `Còn lại khoảng: ${estimateRemaining(progress)}`);
    return;
  }

  if (progress.phase === "done") {
    formatScanResult({
      pageCount: progress.pageCount,
      storyCount: progress.storyCount
    });
    return;
  }

  if (progress.phase === "error") {
    phaseText.textContent = "Có lỗi";
    setStatus("Lỗi khi quét", progress.currentTitle || "Không rõ lỗi.");
    return;
  }

  phaseText.textContent = "Sẵn sàng";
  updateProgressBar(0);
}

async function getValidatedTab() {
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url) {
    throw new Error("Không tìm thấy tab đang mở.");
  }

  if (!tab.url.includes("goctruyentranhvui23.com")) {
    throw new Error("Hãy mở website goctruyentranhvui23.com trước.");
  }

  if (!tab.url.includes("/truyen/theo-doi")) {
    throw new Error("Hãy mở đúng trang Theo Dõi trước khi export.");
  }

  return tab;
}

async function sendToContent(type) {
  const tab = await getValidatedTab();
  const response = await chrome.tabs.sendMessage(tab.id, { type });

  if (!response) {
    throw new Error("Content script không phản hồi.");
  }

  if (!response.ok) {
    throw new Error(response.error || "Thao tác thất bại.");
  }

  return response;
}

async function startScan() {
  setDownloadReady(false);
  setBusy(true);
  phaseText.textContent = "Đang bắt đầu";
  updateProgressBar(1);
  setStatus("Đang chuẩn bị quét", "Giữ nguyên tab Theo Dõi trong lúc chạy.");
  startStatusPolling();

  try {
    const response = await sendToContent("START_SCAN");
    setDownloadReady(true);
    formatScanResult(response.result);
  } catch (error) {
    setDownloadReady(false);
    phaseText.textContent = "Có lỗi";
    setStatus("Lỗi", error.message);
  } finally {
    stopStatusPolling();
    setBusy(false);
  }
}

async function downloadCsv() {
  setBusy(true);
  setStatus("Đang tạo file CSV", "File sẽ được tải xuống ngay khi tạo xong.");

  try {
    const response = await sendToContent("DOWNLOAD_CSV");
    setStatus("Đã tải CSV", response.message || "Hoàn tất.");
    setDownloadReady(true);
  } catch (error) {
    setStatus("Lỗi", error.message);
  } finally {
    setBusy(false);
  }
}

async function restoreScanStatus() {
  try {
    const response = await sendToContent("GET_SCAN_STATUS");
    setDownloadReady(Boolean(response.ready));

    if (response.running) {
      setBusy(true);
      renderProgress(response.progress);
      startStatusPolling();
      return;
    }

    if (response.ready) {
      formatScanResult(response.result);
    }
  } catch {
    setDownloadReady(false);
  }
}

function startStatusPolling() {
  if (statusTimer) {
    return;
  }

  statusTimer = window.setInterval(async () => {
    try {
      const response = await sendToContent("GET_SCAN_STATUS");
      setDownloadReady(Boolean(response.ready));

      if (response.running) {
        setBusy(true);
        renderProgress(response.progress);
        return;
      }

      if (response.ready) {
        setBusy(false);
        formatScanResult(response.result);
        stopStatusPolling();
        return;
      }

      setBusy(false);
      stopStatusPolling();
    } catch {
      stopStatusPolling();
    }
  }, 1000);
}

function stopStatusPolling() {
  if (!statusTimer) {
    return;
  }

  window.clearInterval(statusTimer);
  statusTimer = null;
}

function escapeHtml(value) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

scanButton.addEventListener("click", startScan);
downloadButton.addEventListener("click", downloadCsv);
restoreScanStatus();
