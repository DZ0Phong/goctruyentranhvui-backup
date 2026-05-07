const scanButton = document.getElementById("scanButton");
const downloadButton = document.getElementById("downloadButton");
const statusElement = document.getElementById("status");
let statusTimer = null;

function setStatus(message) {
  statusElement.textContent = message;
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

function formatScanResult(result) {
  if (!result) {
    return "";
  }

  return `Đã quét xong.\nSố trang: ${result.pageCount}\nSố truyện: ${result.storyCount}`;
}

function formatProgress(progress) {
  if (!progress) {
    return "";
  }

  if (progress.phase === "rewinding") {
    return "Đang quay về trang đầu tiên...";
  }

  if (progress.phase === "scanning_pages") {
    return `Đang quét danh sách...\nSố trang đã gặp: ${progress.pageCount}\nSố truyện đã gom: ${progress.storyCount}`;
  }

  if (progress.phase === "reading_details") {
    const currentLine = progress.currentTitle
      ? `\nĐang đọc: ${progress.currentTitle}`
      : "";
    return `Đang đọc tiến độ từng truyện...\n${progress.detailDone}/${progress.detailTotal} truyện${currentLine}`;
  }

  if (progress.phase === "done") {
    return formatScanResult({
      pageCount: progress.pageCount,
      storyCount: progress.storyCount
    });
  }

  if (progress.phase === "error") {
    return `Lỗi: ${progress.currentTitle || "Không rõ lỗi"}`;
  }

  return "Đang chuẩn bị quét...";
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
  setStatus("Đang quét từ trang đầu tiên...");
  startStatusPolling();

  try {
    const response = await sendToContent("START_SCAN");
    setDownloadReady(true);
    setStatus(formatScanResult(response.result) || response.message || "Đã quét xong.");
  } catch (error) {
    setDownloadReady(false);
    setStatus(`Lỗi: ${error.message}`);
  } finally {
    stopStatusPolling();
    setBusy(false);
  }
}

async function downloadCsv() {
  setBusy(true);
  setStatus("Đang tạo file CSV...");

  try {
    const response = await sendToContent("DOWNLOAD_CSV");
    setStatus(response.message || "Đã tải CSV.");
    setDownloadReady(true);
  } catch (error) {
    setStatus(`Lỗi: ${error.message}`);
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
      setStatus(formatProgress(response.progress));
      startStatusPolling();
      return;
    }

    if (response.ready) {
      setStatus(formatScanResult(response.result));
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
        setStatus(formatProgress(response.progress));
        return;
      }

      if (response.ready) {
        setBusy(false);
        setStatus(formatScanResult(response.result));
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

scanButton.addEventListener("click", startScan);
downloadButton.addEventListener("click", downloadCsv);
restoreScanStatus();
