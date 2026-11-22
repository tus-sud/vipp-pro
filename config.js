// ============================================================
// CẤU HÌNH TRANG ẢNH TRÁI TIM 5D & BÀI VĂN TỎ TÌNH PHÁO HOA
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
  // - Để trống '' để tự phát giai điệu hộp nhạc & piano lãng mạn có sẵn.
  // - Hoặc chép file .mp3 vào assets/ rồi điền 'assets/music.mp3'.
  musicFile: '',
  musicTitle: 'Giai điệu ngọt ngào',

  // ✨ Tùy chỉnh hiệu ứng 5D
  orbitPhotoCount: 11,    // Đủ cả 11 ảnh xoay quanh trái tim ở giữa
  fallingPhotoCount: 16,  // Khung ảnh rơi 5D từ trên xuống dưới
  autoRotateSpeed: 0.34,  // Tốc độ tự xoay 3D quanh trái tim

  // 🎆 Bài văn tỏ tình cổ điển ấm áp được các mảnh pháo hoa ghép thành sau 30 giây:
  // Sau 30 giây, pháo hoa sẽ nổ và ghép lần lượt từng đoạn văn trên bầu trời,
  // sau đó kết lại thành trọn vẹn bức thư tỏ tình cổ điển giữa bầu trời sao!
  textStartDelay: 30,
  letterTitle: 'Gửi Chị, Người Em Thương...',
  fireworkTexts: [
    'Giữa muôn vàn vì sao lấp lánh đêm nay,\ncó một điều em đã giữ trong lòng từ rất lâu...',
    'Người ta thường nói thời gian trôi nhanh như gió thoảng,\nnhưng từ ngày gặp chị, mỗi khoảnh khắc đều hóa dịu dàng.',
    'Em thích cách chị cười làm sáng bừng cả ngày bình thường nhất,\nthích cả những phút giây bình yên khi chỉ cần nhìn thấy chị.',
    'Chẳng biết tự bao giờ, giữa thế gian rộng lớn và vội vã này,\nánh mắt em lại chỉ muốn dừng lại ở một người duy nhất.',
    'Theo một cách cổ điển và chân thành nhất của trái tim,\nem không hứa hái sao trên trời, chỉ hứa luôn ở cạnh khi chị cần.',
    'Cùng chị đi qua những ngày nắng ấm lẫn những chiều mưa bay,\nlắng nghe mọi vui buồn và giữ gìn nụ cười trên môi chị.',
    'Nếu trái tim chị cũng đang khẽ rung lên một nhịp dịu dàng...\nCho phép em được thương chị, và đi cùng chị từ hôm nay, chị nhé? ♥',
  ],
  letterSignature: '— Thương chị, theo cách dịu dàng và lâu dài nhất ♥',
};
