# ED Ans 1.5

Bổ sung tự điền cho bốn dạng bạn đã gửi:

- Sắp xếp câu: lấy thứ tự từ ID danh sách đáp án, không dùng thứ tự chữ trong bảng đáp án cũ.
- Kéo từ vào chỗ trống: ghép theo mã ô BLANK NUM và mã đáp án; giữ từ thừa trong ngân hàng.
- Phân loại theo cột: đưa nhiều câu vào đúng cột (ví dụ Mel / Ralph), bỏ qua tiêu đề trong dữ liệu đáp án. Câu đã đặt sai được trả về ngân hàng trước để giải phóng cột đã đầy. Bấm lại giữ các câu đã ở đúng cột.
- Ghép câu hỏi và câu trả lời: kéo đáp án vào đúng từng hàng, giữ câu trả lời thừa trong ngân hàng. Nếu đã ghép sai, trả các câu sai về ngân hàng rồi ghép lại; bấm V lần nữa giữ các cặp đã đúng.

Nhấn **Lấy lại đáp án** để lấy và điền bài hiện tại. Khi hoàn tất, bảng hiện số ô đã điền. Extension dừng và báo khi thiếu dữ liệu hoặc kéo thả không được trang ghi nhận. Không còn tự kéo từ đầu tiên vào ô đầu tiên ngay khi mở bài.

Nhấn **V** trên trang bài học để kích hoạt nút **Lấy lại đáp án**. Phím tắt không chạy khi đang gõ trong ô nhập liệu, đang dùng Ctrl/Alt/Meta, đang gõ qua bộ gõ hoặc đang giữ phím. Nếu extension đang lấy/điền đáp án, nhấn V sẽ không tạo thêm lượt chạy.

## Cập nhật extension đang dùng

1. Giải nén EDAns-1.5.zip.
2. Chép 6 tệp `manifest.json`, `autofill.js`, `content.js`, `content.css`, `background.js`, `icon.png` vào thư mục EDAns đang cài, thay các tệp trùng tên.
3. Mở `chrome://extensions`, tìm ED Ans và bấm nút tải lại extension.
4. Tải lại tab ED, mở bài cần làm rồi bấm **Lấy lại đáp án**.

Hoặc tắt bản cũ và dùng **Load unpacked / Tải tiện ích đã giải nén**, chọn thư mục chứa `manifest.json` của bản này. Chỉ bật một bản ED Ans để tránh hai extension cùng thao tác.

## Phạm vi đã kiểm tra

Kiểm thử trình duyệt Chrome dùng cấu trúc HTML từ bốn mẫu của bạn, dữ liệu đáp án mô phỏng và thư viện Dragula lấy từ mã công khai của ED. Các kiểm thử kiểm tra cả dữ liệu kéo thả, không chỉ chữ trên màn hình: sắp xếp theo ID, bấm lại, điền mọi ô, thay ô đã điền sai, giữ từ thừa, từ chối dữ liệu bài khác/thiếu dữ liệu, hủy phản hồi cũ sau khi chuyển bài và giữ cách chọn trắc nghiệm cũ. Mẫu phân loại được kiểm tra qua phím V, với cột trống, cột đầy có câu sai và dữ liệu mã câu trùng. Mẫu ghép cặp được kiểm tra với hàng trống, hàng đã ghép sai, câu trả lời thừa và dữ liệu đảo chiều hai cột.

Chưa kiểm thử đầu cuối với API đáp án trong tài khoản đang đăng nhập hoặc việc máy chủ lưu bài sau khi rời trang. Chưa khẳng định hỗ trợ mọi dạng ED; dạng nói, viết tự do và các giao diện khác chưa có mẫu để kiểm tra. Phần trắc nghiệm/danh sách thả xuống cũ vẫn được giữ.

## Chạy kiểm thử (dành cho người sửa mã)

Cần Node.js 20 trở lên và Google Chrome đã cài. Trong thư mục này chạy:

```powershell
npm install
npm run prepare-tests
npm test
```

Lệnh chuẩn bị tải mã JavaScript công khai của ED để làm tham chiếu Dragula, không đăng nhập hoặc dùng dữ liệu tài khoản. Mã tham chiếu không nằm trong gói extension. Nếu Chrome ở vị trí khác, đặt biến `EDANS_CHROME_PATH` thành đường dẫn chrome.exe.
