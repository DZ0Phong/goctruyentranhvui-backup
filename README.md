# GocTruyenTranhVui Follow Exporter

Chrome/Edge extension nhỏ gọn để xuất danh sách truyện đang theo dõi trên `goctruyentranhvui23.com` ra file CSV.

Made by **DZ0Phong**.

Nếu project này hữu ích, cho mình xin một star nhé.

## Có gì hay?

- Quét danh sách truyện trong trang Theo Dõi.
- Tự quay về page đầu trước khi quét để tránh thiếu truyện.
- Tự chuyển qua các page tiếp theo.
- Lấy tiến độ đọc thật từ trang chi tiết truyện, ví dụ `Đọc Tiếp #99`.
- Xuất file CSV UTF-8, mở được bằng Excel hoặc Google Sheets.
- Popup có progress, số truyện, số page và thời gian ước tính còn lại.

## Cài đặt local

1. Tải hoặc clone repo này.
2. Mở Chrome/Edge và vào `chrome://extensions/` hoặc `edge://extensions/`.
3. Bật `Developer mode`.
4. Chọn `Load unpacked`.
5. Chọn folder chứa file `manifest.json`.
6. Mở `https://goctruyentranhvui23.com/truyen/theo-doi`.
7. Bấm icon extension, chọn `Quét dữ liệu`, rồi `Tải CSV`.

## File CSV gồm

- `STT`
- `Tên truyện`
- `Trạng thái`
- `Đã đọc tới`
- `Chap mới nhất`
- `Số chap chưa đọc`
- `Ghi chú`

## Lưu ý

- Hãy giữ nguyên tab Theo Dõi trong lúc quét để kết quả ổn định.
- Có thể chuyển sang tab khác, nhưng không nên reload hoặc đóng tab đang quét.
- Extension đọc dữ liệu trong trình duyệt và tạo CSV cục bộ, không gửi dữ liệu lên server riêng.
- Website đổi giao diện/class HTML thì extension có thể cần cập nhật selector.

## Dành cho dev

Cấu trúc chính:

- `manifest.json`: cấu hình extension.
- `popup.html`: giao diện popup.
- `popup.js`: logic popup, progress, tải file.
- `content.js`: quét dữ liệu và tạo CSV.
- `icons/`: icon extension.

Kiểm tra nhanh cú pháp:

```bash
node --check content.js
node --check popup.js
```

## Policy

- License: [MIT](LICENSE)
- Privacy Policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- Store submission notes: [STORE_SUBMISSION.md](STORE_SUBMISSION.md)

## License

MIT
