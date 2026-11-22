// ============================================================
// CẤU HÌNH TRANG TRÁI TIM CỦA BẠN
// Bạn chỉ cần sửa nội dung bên dưới rồi lưu lại (Ctrl + S)
// ============================================================

window.HEART_PAGE_CONFIG = {
  // 1. Đường dẫn hình ảnh chính:
  //    Chép ảnh của bạn vào thư mục "assets/" (ví dụ: assets/anh-cua-chung-ta.jpg)
  //    rồi thay đường dẫn ở dòng dưới. Cũng hỗ trợ link ảnh online (https://...).
  photo: 'assets/photo.jpg',

  // 2. Kiểu khung ảnh mặc định:
  //    'polaroid' : Khung ảnh Polaroid ngọt ngào bo góc
  //    'heart'    : Khung cắt hình trái tim phát sáng
  frameStyle: 'polaroid',

  // 3. Nhãn nhỏ xinh phía trên tiêu đề (để trống '' nếu muốn ẩn)
  badge: 'Dành riêng cho cậu ✨',

  // 4. Tiêu đề chính
  title: 'Gửi người đặc biệt nhất',

  // 5. Dòng chữ phụ ngay dưới tiêu đề (để trống '' nếu muốn ẩn)
  subtitle: 'Mỗi khoảnh khắc bên cậu đều ngọt ngào như mơ',

  // 6. Lời nhắn ngắn hiển thị dưới khung ảnh
  message:
    'Cảm ơn cậu vì đã xuất hiện và làm những ngày bình thường trở nên thật rực rỡ. Mong rằng mỗi lần nhìn thấy bức ảnh này, cậu sẽ luôn mỉm cười thật tươi nhé!',

  // 7. Chữ ký cuối lời nhắn
  signature: '— Từ người luôn nghĩ về cậu ♥',

  // 8. Chú thích nhỏ trên viền dưới khung Polaroid
  photoCaption: 'Sweetest Memory 💕',

  // 9. Nhạc nền lãng mạn:
  //    - Để trống '' để phát giai điệu hộp nhạc lãng mạn có sẵn (không cần file nhạc).
  //    - Hoặc chép file .mp3 vào thư mục "assets/" rồi điền 'assets/music.mp3'.
  musicFile: '',

  // 10. Tên giai điệu hiển thị trên nút nhạc góc phải
  musicTitle: 'Hộp nhạc ngọt ngào',

  // 11. Chữ trên nút thả tim
  heartButtonText: 'Thả tim ngay',

  // 12. Dòng gợi ý nhỏ khi mới mở trang
  tapHint: 'Chạm vào màn hình để bắn tim & mở nhạc nhé 💕',
};
