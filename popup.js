const scanButton = document.getElementById("scanButton");
const downloadButton = document.getElementById("downloadButton");
const statusElement = document.getElementById("status");

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

  return `Da quet xong.\nSo trang: ${result.pageCount}\nSo truyen: ${result.storyCount}`;
}

async function getValidatedTab() {
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url) {
    throw new Error("Khong tim thay tab dang mo.");
  }

  if (!tab.url.includes("goctruyentranhvui23.com")) {
    throw new Error("Hay mo website goctruyentranhvui23.com truoc.");
  }

  if (!tab.url.includes("/truyen/theo-doi")) {
    throw new Error("Hay mo dung trang Theo Doi truoc khi export.");
  }

  return tab;
}

async function sendToContent(type) {
  const tab = await getValidatedTab();
  const response = await chrome.tabs.sendMessage(tab.id, { type });

  if (!response) {
    throw new Error("Content script khong phan hoi.");
  }

  if (!response.ok) {
    throw new Error(response.error || "Thao tac that bai.");
  }

  return response;
}

async function startScan() {
  setDownloadReady(false);
  setBusy(true);
  setStatus("Dang quet tu trang dau tien...");

  try {
    const response = await sendToContent("START_SCAN");
    setDownloadReady(true);
    setStatus(formatScanResult(response.result) || response.message || "Da quet xong.");
  } catch (error) {
    setDownloadReady(false);
    setStatus(`Loi: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function downloadCsv() {
  setBusy(true);
  setStatus("Dang tao file CSV...");

  try {
    const response = await sendToContent("DOWNLOAD_CSV");
    setStatus(response.message || "Da tai CSV.");
    setDownloadReady(true);
  } catch (error) {
    setStatus(`Loi: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function restoreScanStatus() {
  try {
    const response = await sendToContent("GET_SCAN_STATUS");
    setDownloadReady(Boolean(response.ready));

    if (response.ready) {
      setStatus(formatScanResult(response.result));
    }
  } catch {
    setDownloadReady(false);
  }
}

scanButton.addEventListener("click", startScan);
downloadButton.addEventListener("click", downloadCsv);
restoreScanStatus();
