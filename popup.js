const exportButton = document.getElementById("exportButton");
const statusElement = document.getElementById("status");

function setStatus(message) {
  statusElement.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function startExport() {
  exportButton.disabled = true;
  setStatus("Dang kiem tra tab hien tai...");

  try {
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

    setStatus("Dang gui lenh quet du lieu...");

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "START_EXPORT"
    });

    if (!response) {
      throw new Error("Content script khong phan hoi.");
    }

    if (!response.ok) {
      throw new Error(response.error || "Export that bai.");
    }

    setStatus(response.message || "Da xuat file thanh cong.");
  } catch (error) {
    setStatus(`Loi: ${error.message}`);
  } finally {
    exportButton.disabled = false;
  }
}

exportButton.addEventListener("click", startExport);
