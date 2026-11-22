// ============================================================
// CẤU HÌNH TRANG ẢNH TRÁI TIM 5D
// ============================================================

window.HEART_PAGE_CONFIG = {
  // 🖼️ Toàn bộ 11 tấm ảnh của bạn (xoay quanh trái tim 5D & rơi từ trên xuống)
  photos: [
    'assets/p01.jpg',
    'assets/p02.jpg',
    'assets/p03.jpg',
    'assets/p04.jpg',
    'assets/p05.jpg',
    'assets/p06.jpg',
    'assets/p07.jpg',
    'assets/p08.jpg',
    'assets/p09.jpg',
    'assets/p10.jpg',
    'assets/p11.jpg',
  ],

  // 🎵 Nhạc nền lãng mạn:
  // - Để trống '' để tự phát giai điệu hộp nhạc lãng mạn có sẵn.
  // - Hoặc chép file .mp3 vào assets/ rồi điền 'assets/music.mp3'.
  musicFile: '',
  musicTitle: 'Giai điệu ngọt ngào',

  // ✨ Tùy chỉnh hiệu ứng 5D
  orbitPhotoCount: 11,    // Đủ cả 11 ảnh xoay quanh trái tim ở giữa
  fallingPhotoCount: 16,  // 16 khung ảnh rơi 5D từ trên xuống dưới
  autoRotateSpeed: 0.34,  // Tốc độ tự xoay 3D quanh trái tim
};
