# 💕 Trang Hình Ảnh Trái Tim + Mã QR

Bộ trang web tĩnh hoàn chỉnh giúp bạn tạo một món quà nhỏ ngọt ngào: người nhận chỉ cần quét mã QR bằng camera điện thoại hoặc Zalo là sẽ mở ngay trang hình ảnh ngập tràn mưa trái tim hồng pastel, chạm màn hình bắn tim và có nhạc nền lãng mạn!

## 📁 Các tệp trong thư mục

- `index.html` — Trang chính hiển thị hình ảnh, lời nhắn, hiệu ứng trái tim & nhạc nền (người quét QR sẽ vào trang này).
- `config.js` — **File cấu hình duy nhất bạn cần sửa** để đổi ảnh, tiêu đề, lời nhắn, kiểu khung và nhạc nền.
- `qr.html` — Công cụ tạo và tải ảnh **Thẻ Mã QR Trái Tim (PNG)** cực nét, quét nhạy trên iPhone/Android/Zalo.
- `assets/photo.jpg` — Hình ảnh mặc định (bạn chỉ cần thay bằng ảnh của bạn!).
- `styles.css`, `app.js`, `qr-engine.js` — Mã giao diện, hiệu ứng trái tim 60fps và bộ tạo mã QR offline chuẩn ISO.

---

## 🎨 Bước 1: Đổi ảnh, lời nhắn và nhạc của bạn

1. **Thay hình ảnh**:
   - Chép ảnh của bạn vào thư mục `assets/` và đặt tên là `photo.jpg` (đè lên ảnh mẫu), **hoặc** giữ tên gốc (ví dụ `assets/ky-niem.png`) rồi sửa dòng `photo:` trong file `config.js`.
2. **Đổi tiêu đề, lời nhắn, khung ảnh**:
   - Mở `config.js` bằng Notepad hoặc VS Code và sửa các dòng chữ tiếng Việt bên trong rồi lưu lại (`Ctrl + S`).
   - Bạn có thể đổi `frameStyle: 'polaroid'` thành `'heart'` nếu muốn mặc định hiện khung cắt hình trái tim.
3. **Nhạc nền**:
   - Mặc định trang **đã có sẵn giai điệu hộp nhạc lãng mạn** (tự phát khi người xem chạm màn hình hoặc bấm nút nhạc).
   - Nếu muốn dùng bài hát riêng, chép file `.mp3` vào `assets/music.mp3` rồi sửa `musicFile: 'assets/music.mp3'` trong `config.js`.

---

## 🌐 Bước 2: Đưa trang web lên mạng miễn phí (để ai cũng quét QR được)

> Vì mã QR trên điện thoại cần mở một đường link online (`https://...`), bạn hãy đưa cả thư mục này lên mạng miễn phí trong 10 giây:

### Cách nhanh nhất: Netlify Drop (không cần biết code)
1. Truy cập **https://app.netlify.com/drop**
2. Kéo thả **cả thư mục** `d:\tttttttttttttttttt` vào khung trên web.
3. Chờ khoảng 5–10 giây, Netlify sẽ cấp cho bạn một đường link dạng `https://ten-ngau-nhien.netlify.app`.

*(Ngoài ra bạn cũng có thể upload lên **GitHub Pages**, **Vercel**, hoặc **Cloudflare Pages** hoàn toàn miễn phí.)*

---

## 📱 Bước 3: Tạo & tải mã QR hình trái tim

1. Mở file `qr.html` trên trình duyệt (hoặc mở trực tiếp `https://link-cua-ban.netlify.app/qr.html` sau khi đã đưa lên mạng).
2. Dán đường link `https://...` vừa nhận ở Bước 2 vào ô **Đường link trang trái tim**.
3. Chọn màu, kiểu thẻ, sửa dòng chữ trên thẻ nếu thích → bấm **Tải ảnh mã QR (PNG)**.
4. Dùng điện thoại quét thử ảnh vừa tải để kiểm tra rồi gửi tặng hoặc in ra nhé! 💕

