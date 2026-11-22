(() => {
  'use strict';

  const rawCfg = window.HEART_PAGE_CONFIG || {};
  const photoList =
    Array.isArray(rawCfg.photos) && rawCfg.photos.length > 0
      ? rawCfg.photos.filter(Boolean)
      : [rawCfg.photo || 'assets/photo.jpg'];

  const cfg = {
    photos: photoList,
    musicFile: (rawCfg.musicFile || '').trim(),
    orbitPhotoCount: Math.max(4, Math.min(14, rawCfg.orbitPhotoCount || Math.max(8, photoList.length))),
    fallingPhotoCount: Math.max(6, Math.min(22, rawCfg.fallingPhotoCount || 14)),
    autoRotateSpeed: typeof rawCfg.autoRotateSpeed === 'number' ? rawCfg.autoRotateSpeed : 0.34,
  };

  const canvas = document.getElementById('scene5d');
  const ctx = canvas.getContext('2d');
  const musicToggle = document.getElementById('musicToggle');
  const customAudio = document.getElementById('customAudio');
  const gestureHint = document.getElementById('gestureHint');
  const photoModal = document.getElementById('photoModal');
  const photoModalImg = document.getElementById('photoModalImg');

  // ============================================================
  // 1. NHẠC NỀN LÃNG MẠN (FILE MP3 HOẶC HỘP NHẠC WEB AUDIO)
  // ============================================================
  class RomanticMusicBox {
    constructor(audioEl, musicFile) {
      this.audioEl = audioEl;
      this.musicFile = musicFile;
      this.useCustomFile = Boolean(this.musicFile);
      this.isPlaying = false;
      this.userMuted = false;
      this.ctx = null;
      this.masterGain = null;
      this.delayNode = null;
      this.stepTimer = null;
      this.stepIndex = 0;

      this.sequence = [
        { lead: 659.25, chord: [261.63, 329.63, 392.0] },
        { lead: 783.99, chord: [493.88] },
        { lead: 1046.5, chord: [392.0] },
        { lead: 987.77, chord: [329.63] },
        { lead: 783.99, chord: [261.63, 392.0] },
        { lead: 659.25, chord: [493.88] },
        { lead: 880.0, chord: [220.0, 261.63, 329.63] },
        { lead: 783.99, chord: [392.0] },
        { lead: 659.25, chord: [329.63] },
        { lead: 587.33, chord: [261.63] },
        { lead: 523.25, chord: [220.0, 329.63] },
        { lead: null, chord: [392.0] },
        { lead: 698.46, chord: [174.61, 261.63, 329.63] },
        { lead: 880.0, chord: [349.23] },
        { lead: 783.99, chord: [329.63] },
        { lead: 659.25, chord: [261.63] },
        { lead: 587.33, chord: [174.61, 329.63] },
        { lead: 523.25, chord: [349.23] },
        { lead: 587.33, chord: [196.0, 246.94, 293.66] },
        { lead: 659.25, chord: [392.0] },
        { lead: 783.99, chord: [293.66] },
        { lead: 659.25, chord: [246.94] },
        { lead: 587.33, chord: [196.0, 392.0] },
        { lead: null, chord: [293.66] },
      ];

      if (this.useCustomFile) {
        this.audioEl.src = this.musicFile;
        this.audioEl.volume = 0.68;
        this.audioEl.addEventListener('error', () => {
          this.useCustomFile = false;
          if (this.isPlaying) this.startSynth();
        });
      }
    }

    initAudioCtx() {
      if (this.ctx) return;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.24;

      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.34;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.24;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2100;

      this.delayNode.connect(filter);
      filter.connect(feedback);
      feedback.connect(this.delayNode);
      filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    playBell(freq, vol, dur, offset = 0) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + offset;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);
      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(0.14, now);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.45, dur * 0.45));

      osc1.connect(gain);
      osc2.connect(hGain);
      hGain.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(this.delayNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur + 0.05);
      osc2.stop(now + dur + 0.05);
    }

    startSynth() {
      this.initAudioCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.stepTimer) clearInterval(this.stepTimer);

      const tick = () => {
        if (!this.isPlaying) return;
        const step = this.sequence[this.stepIndex % this.sequence.length];
        this.stepIndex += 1;
        if (step.chord) {
          step.chord.forEach((f, i) => this.playBell(f, 0.14, 1.5, i * 0.035));
        }
        if (step.lead) {
          this.playBell(step.lead, 0.28, 1.9, 0.01);
        }
      };
      tick();
      this.stepTimer = setInterval(tick, 460);
    }

    stopSynth() {
      if (this.stepTimer) {
        clearInterval(this.stepTimer);
        this.stepTimer = null;
      }
    }

    async play() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.updateUI();
      if (this.useCustomFile) {
        try {
          await this.audioEl.play();
          return;
        } catch {
          this.useCustomFile = false;
        }
      }
      this.startSynth();
    }

    pause() {
      this.isPlaying = false;
      this.updateUI();
      if (this.useCustomFile) this.audioEl.pause();
      this.stopSynth();
    }

    toggle() {
      if (this.isPlaying) {
        this.userMuted = true;
        this.pause();
      } else {
        this.userMuted = false;
        this.play();
      }
    }

    tryAutoStart() {
      if (!this.isPlaying && !this.userMuted) this.play();
    }

    updateUI() {
      musicToggle.classList.toggle('is-playing', this.isPlaying);
      musicToggle.setAttribute('aria-pressed', String(this.isPlaying));
    }
  }

  const music = new RomanticMusicBox(customAudio, cfg.musicFile);
  musicToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    music.toggle();
  });

  // ============================================================
  // 2. NẠP & TẠO KHUNG THẺ ẢNH PHÁT SÁNG (CACHED CHO 60FPS MƯỢT)
  // ============================================================
  function drawRoundedRect(c, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  function createFallbackCard() {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 290;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 240, 290);
    bg.addColorStop(0, '#ff85b8');
    bg.addColorStop(1, '#c92a76');
    drawRoundedRect(g, 10, 10, 220, 270, 24);
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(255, 228, 242, 0.9)';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '700 84px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('♥', 120, 148);
    return c;
  }

  function buildFramedPhotoCard(img) {
    const W = 256;
    const H = 304;
    const PAD = 16;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    // Hào quang hồng phát sáng dịu xung quanh thẻ ảnh
    g.save();
    g.shadowColor = 'rgba(255, 96, 174, 0.72)';
    g.shadowBlur = 18;
    drawRoundedRect(g, PAD, PAD, W - PAD * 2, H - PAD * 2, 22);
    const frameGrad = g.createLinearGradient(PAD, PAD, W - PAD, H - PAD);
    frameGrad.addColorStop(0, 'rgba(255, 232, 244, 0.95)');
    frameGrad.addColorStop(0.5, 'rgba(255, 170, 212, 0.9)');
    frameGrad.addColorStop(1, 'rgba(255, 224, 240, 0.95)');
    g.fillStyle = frameGrad;
    g.fill();
    g.restore();

    // Cắt ảnh tỷ lệ chuẩn (object-fit: cover) bên trong khung bo góc
    const innerX = PAD + 7;
    const innerY = PAD + 7;
    const innerW = W - (PAD + 7) * 2;
    const innerH = H - (PAD + 7) * 2;

    g.save();
    drawRoundedRect(g, innerX, innerY, innerW, innerH, 16);
    g.clip();

    const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const boxRatio = innerW / innerH;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (imgRatio > boxRatio) {
      sw = img.naturalHeight * boxRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / boxRatio;
      sy = (img.naturalHeight - sh) * 0.28;
    }

    g.drawImage(img, sx, sy, sw, sh, innerX, innerY, innerW, innerH);

    // Ánh sáng kính bóng nhẹ tạo cảm giác thẻ 5D cao cấp
    const sheen = g.createLinearGradient(innerX, innerY, innerX + innerW * 0.8, innerY + innerH * 0.65);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.04)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(innerX, innerY, innerW, innerH);
    g.restore();

    return c;
  }

  const fallbackCard = createFallbackCard();
  const loadedPhotos = cfg.photos.map((src) => {
    const entry = { src, card: fallbackCard, loaded: false };
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      entry.card = buildFramedPhotoCard(img);
      entry.loaded = true;
    };
    img.src = src;
    return entry;
  });

  // ============================================================
  // 3. ĐỘNG CƠ 5D (TRÁI TIM HẠT 3D + ẢNH XOAY QUANH + ẢNH RƠI 3D)
  // ============================================================
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function drawMiniHeart(c, x, y, size, color, alpha, rot = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, size * 0.5);
    c.bezierCurveTo(-size * 0.78, size * 0.04, -size * 0.82, -size * 0.56, -size * 0.36, -size * 0.56);
    c.bezierCurveTo(-size * 0.12, -size * 0.56, 0, -size * 0.32, 0, -size * 0.32);
    c.bezierCurveTo(0, -size * 0.32, size * 0.12, -size * 0.56, size * 0.36, -size * 0.56);
    c.bezierCurveTo(size * 0.82, -size * 0.56, size * 0.78, size * 0.04, 0, size * 0.5);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawStarGlint(c, x, y, r, color, alpha) {
    c.save();
    c.translate(x, y);
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      const am = a + Math.PI / 4;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(am) * r * 0.25, Math.sin(am) * r * 0.25);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  // Bảng màu trái tim phát sáng 5D
  const HEART_PALETTE = [
    '#ff3d8b',
    '#ff5ea3',
    '#ff85bc',
    '#ffb3d9',
    '#ff2e7a',
    '#ffd6eb',
    '#ff99c8',
    '#ffe6a7',
  ];

  // Tạo bề mặt trái tim 3D căng tròn, phân bố đều theo độ dài cung (không bị dồn vệt giữa)
  function create3DHeartParticles(count) {
    // Tiền tính bảng tra phân bố đều theo độ dài cung đường viền trái tim
    const SAMPLES = 720;
    const pts = [];
    const cumLen = [0];
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = (Math.PI * 2 * i) / SAMPLES;
      const hx = (16 * Math.pow(Math.sin(t), 3)) / 16;
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 1.2) / 16;
      pts.push([hx, hy]);
      if (i > 0) {
        const dx = hx - pts[i - 1][0];
        const dy = hy - pts[i - 1][1];
        cumLen.push(cumLen[i - 1] + Math.hypot(dx, dy));
      }
    }
    const totalLen = cumLen[SAMPLES];

    function sampleHeartRim() {
      const target = Math.random() * totalLen;
      let lo = 0;
      let hi = SAMPLES;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cumLen[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      return pts[lo];
    }

    const list = [];
    const rimCount = Math.floor(count * 0.28);
    const auraStart = Math.floor(count * 0.88);

    for (let i = 0; i < count; i += 1) {
      const [hx, hy] = sampleHeartRim();
      const isRim = i < rimCount;
      const isOuterAura = i >= auraStart;

      let r;
      let z;
      let jitter;
      if (isRim) {
        // Viền trái tim 3D rực sáng sắc nét
        r = rand(0.95, 1.03);
        z = rand(-0.2, 0.2);
        jitter = 0.014;
      } else if (isOuterAura) {
        // Bụi hào quang phát sáng tỏa nhẹ quanh viền tim
        r = rand(1.03, 1.24);
        z = rand(-0.34, 0.34);
        jitter = 0.06;
      } else {
        // Khối phồng 3D mềm mại cả mặt trước lẫn mặt sau
        r = Math.pow(Math.random(), 0.45);
        const dome = Math.sqrt(Math.max(0, 1 - r * r)) * 0.54;
        z = (Math.random() < 0.5 ? 1 : -1) * dome * rand(0.84, 1.05);
        jitter = 0.022;
      }

      const x = hx * r + rand(-jitter, jitter);
      const y = hy * r + rand(-jitter, jitter);

      const color = isRim
        ? pick(['#ff4da6', '#ff77bb', '#ffd9ee', '#ff2e83', '#fff0f7'])
        : isOuterAura
          ? pick(['#ff99cc', '#ffd6eb', '#ffe6b3'])
          : pick(HEART_PALETTE);

      list.push({
        bx: x,
        by: y,
        bz: z,
        size: isRim ? rand(1.3, 2.5) : isOuterAura ? rand(0.9, 2.0) : rand(1.1, 2.4),
        color,
        twinklePhase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(2.2, 5.4),
        sparkle: isRim ? Math.random() < 0.16 : Math.random() < 0.08,
        isAura: isOuterAura,
      });
    }
    return list;
  }

  // Vòng bụi sao xoay quanh trái tim đồng bộ với quỹ đạo ảnh
  function createOrbitDust(count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        angle: rand(0, Math.PI * 2),
        radius: rand(1.48, 2.38),
        yOffset: rand(-0.22, 0.22),
        speed: rand(0.18, 0.44),
        size: rand(1.1, 2.8),
        color: pick(['#ffb3d9', '#ffe0f0', '#ff6eb0', '#ffe7a8', '#ffffff']),
        phase: rand(0, Math.PI * 2),
      });
    }
    return list;
  }

  // Các ngôi sao sâu trong không gian nền 5D
  function createStarfield(count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        nx: rand(0, 1),
        ny: rand(0, 1),
        depth: rand(0.2, 1.0),
        r: rand(0.7, 2.2),
        phase: rand(0, Math.PI * 2),
        speed: rand(1.2, 3.8),
        color: pick(['#ffffff', '#ffd6ec', '#ffb3d9', '#fff1cc']),
      });
    }
    return list;
  }

  // Tạo danh sách khung ảnh xoay quanh trái tim 3D (dạng sóng lượn 5D đẹp mắt)
  function createOrbitPhotos(count) {
    const list = [];
    const baseRadius = count >= 10 ? 2.26 : 2.08;
    for (let i = 0; i < count; i += 1) {
      list.push({
        photoIndex: i % loadedPhotos.length,
        baseAngle: (Math.PI * 2 * i) / count,
        radiusMul: baseRadius + (i % 2 === 0 ? 0.1 : -0.08),
        yOffset: (i % 2 === 0 ? 0.2 : -0.2),
        yBobAmp: rand(0.08, 0.14),
        yBobPhase: rand(0, Math.PI * 2),
        tiltPhase: rand(0, Math.PI * 2),
      });
    }
    return list;
  }

  // Tạo dòng ảnh rơi 5D từ trên xuống dưới theo nhiều tầng chiều sâu
  function createFallingPhoto(randomY) {
    // Tầng gần, trung và xa tạo cảm giác chiều sâu 5D rõ rệt
    const layer = Math.random();
    const zDepth = layer < 0.42 ? rand(-2.7, -1.3) : layer < 0.82 ? rand(-1.2, 0.8) : rand(0.9, 1.9);
    return {
      photoIndex: (Math.random() * loadedPhotos.length) | 0,
      x: rand(-3.1, 3.1),
      y: randomY ? rand(-3.6, 3.6) : rand(-4.3, -3.2),
      z: zDepth,
      vy: rand(0.36, 0.74) * (zDepth > 0.6 ? 1.12 : 0.88),
      swayAmp: rand(0.22, 0.54),
      swayFreq: rand(0.6, 1.4),
      swayPhase: rand(0, Math.PI * 2),
      spinPhase: rand(0, Math.PI * 2),
      spinSpeed: rand(0.7, 1.6),
      rotAmp: rand(0.14, 0.32),
      scaleMul: rand(0.46, 0.72),
      trailTimer: 0,
    };
  }

  // Trạng thái sân khấu & camera 5D
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let unitScale = 160;
  let focalLength = 860;

  let camRotY = 0;
  let camRotX = 0.22; // Góc nhìn hơi nghiêng nhẹ thấy rõ vòng ảnh xoay quanh trái tim!
  let velY = 0;
  let velX = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let zoom = 1;
  let targetZoom = 1;

  const heartParticles = create3DHeartParticles(2300);
  const orbitDust = createOrbitDust(260);
  const stars = createStarfield(130);
  const orbitPhotos = createOrbitPhotos(cfg.orbitPhotoCount);
  const fallingPhotos = Array.from({ length: cfg.fallingPhotoCount }, () => createFallingPhoto(true));

  const bursts = [];
  const shockwaves = [];
  const renderQueue = [];
  let clickableCards = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const minDim = Math.min(width, height);
    unitScale = Math.max(92, Math.min(185, minDim * 0.225));
    focalLength = Math.max(620, minDim * 1.45);
  }
  resize();
  window.addEventListener('resize', resize);

  // Phép chiếu phối cảnh 3D -> 2D với camera xoay 360°
  function project3D(wx, wy, wz, cosY, sinY, cosX, sinX) {
    // Xoay quanh trục Y
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;
    // Xoay quanh trục X
    const y2 = wy * cosX - z1 * sinX;
    const z2 = wy * sinX + z1 * cosX;

    const camDist = 5.2 / zoom;
    const pz = z2 + camDist;
    if (pz <= 0.35) return null;

    const scale = (focalLength / (pz * unitScale)) * (unitScale / 145);
    const sx = width * 0.5 + x1 * unitScale * scale;
    const sy = height * 0.5 + y2 * unitScale * scale;
    return { sx, sy, z: pz, scale };
  }

  // Hiệu ứng bắn tim 5D tại điểm chạm
  function spawnTapBurst(x, y, count = 20) {
    shockwaves.push({ x, y, r: 8, maxR: 135, life: 0, maxLife: 0.72 });
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + rand(-0.22, 0.22);
      const sp = rand(75, 260);
      bursts.push({
        kind: i % 4 === 0 ? 'star' : 'heart',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(25, 95),
        gravity: 170,
        drag: 0.96,
        size: i % 4 === 0 ? rand(4, 9) : rand(9, 20),
        rot: rand(-0.5, 0.5),
        rotSpeed: rand(-3, 3),
        color: pick(HEART_PALETTE),
        life: 0,
        maxLife: rand(0.85, 1.55),
      });
    }
  }

  // Sóng xung kích lan tỏa từ nhịp đập trái tim trung tâm
  let lastBeatPulse = 0;

  // ============================================================
  // 4. TƯƠNG TÁC 5D: XOAY 360°, ZOOM, CHẠM BẮN TIM & MỞ ẢNH
  // ============================================================
  let hasInteracted = false;
  let isDragging = false;
  let dragMoved = 0;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  const activePointers = new Map();

  function hideHintAndStartMusic() {
    if (!hasInteracted) {
      hasInteracted = true;
      gestureHint.classList.add('is-hidden');
      music.tryAutoStart();
    }
  }

  setTimeout(() => {
    gestureHint.classList.add('is-hidden');
  }, 6500);

  canvas.addEventListener('pointerdown', (e) => {
    hideHintAndStartMusic();
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      isDragging = true;
      dragMoved = 0;
      downX = e.clientX;
      downY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      velY = 0;
      velX = 0;
    } else if (activePointers.size === 2) {
      isDragging = false;
      const pts = Array.from(activePointers.values());
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDist > 0) {
        targetZoom = Math.max(0.68, Math.min(1.65, targetZoom * (dist / pinchDist)));
      }
      pinchDist = dist;
      return;
    }

    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      dragMoved += Math.hypot(dx, dy);

      camRotY += dx * 0.0065;
      camRotX = Math.max(-0.85, Math.min(0.85, camRotX + dy * 0.0055));
      velY = dx * 0.0045;
      velX = dy * 0.0035;
    } else if (e.pointerType === 'mouse') {
      // Hiệu ứng thị sai 5D mượt theo con trỏ chuột trên laptop
      targetParallaxX = (e.clientX / width - 0.5) * 0.24;
      targetParallaxY = (e.clientY / height - 0.5) * 0.18;
    }
  });

  function onPointerRelease(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchDist = 0;

    if (isDragging && activePointers.size === 0) {
      isDragging = false;
      // Nếu là chạm nhẹ (không phải kéo xoay) -> bắn tim hoặc mở ảnh vừa chạm
      if (dragMoved < 10) {
        let hitPhoto = null;
        for (let i = clickableCards.length - 1; i >= 0; i -= 1) {
          const box = clickableCards[i];
          if (
            downX >= box.x - box.w / 2 &&
            downX <= box.x + box.w / 2 &&
            downY >= box.y - box.h / 2 &&
            downY <= box.y + box.h / 2
          ) {
            hitPhoto = box.src;
            break;
          }
        }
        spawnTapBurst(downX, downY, 22);
        if (navigator.vibrate) navigator.vibrate(15);
        if (hitPhoto) {
          photoModalImg.src = hitPhoto;
          photoModal.hidden = false;
        }
      }
    }
  }

  canvas.addEventListener('pointerup', onPointerRelease);
  canvas.addEventListener('pointercancel', onPointerRelease);

  // Cuộn chuột để phóng to / thu nhỏ không gian 5D
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      targetZoom = Math.max(0.68, Math.min(1.65, targetZoom - e.deltaY * 0.0008));
    },
    { passive: false }
  );

  // Cảm biến nghiêng điện thoại tạo chiều sâu 5D chân thực
  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (typeof e.gamma === 'number' && typeof e.beta === 'number') {
        targetParallaxX = Math.max(-0.28, Math.min(0.28, (e.gamma / 45) * 0.24));
        targetParallaxY = Math.max(-0.22, Math.min(0.22, ((e.beta - 45) / 45) * 0.18));
      }
    },
    { passive: true }
  );

  photoModal.addEventListener('click', () => {
    photoModal.hidden = true;
  });

  // ============================================================
  // 5. VÒNG LẶP KẾT XUẤT 60FPS
  // ============================================================
  let lastTime = performance.now();

  function render(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const t = now / 1000;

    // Nhịp đập trái tim "thình-thịch" mềm mại chân thực
    const beatCycle = (t * 1.15) % 1;
    const beat1 = Math.exp(-Math.pow((beatCycle - 0.12) / 0.075, 2));
    const beat2 = 0.65 * Math.exp(-Math.pow((beatCycle - 0.3) / 0.09, 2));
    const beat = beat1 + beat2;
    const heartPulse = 1 + beat * 0.095;

    if (beat1 > 0.92 && t - lastBeatPulse > 0.7) {
      lastBeatPulse = t;
      shockwaves.push({
        x: width * 0.5,
        y: height * 0.5,
        r: unitScale * 0.65,
        maxR: unitScale * 2.4,
        life: 0,
        maxLife: 1.15,
      });
    }

    // Cập nhật góc xoay camera 3D mượt mà + quán tính
    if (!isDragging) {
      camRotY += cfg.autoRotateSpeed * dt + velY;
      camRotX = Math.max(-0.85, Math.min(0.85, camRotX + velX));
      velY *= Math.pow(0.92, dt * 60);
      velX *= Math.pow(0.92, dt * 60);
    }
    parallaxX += (targetParallaxX - parallaxX) * Math.min(1, dt * 5);
    parallaxY += (targetParallaxY - parallaxY) * Math.min(1, dt * 5);
    zoom += (targetZoom - zoom) * Math.min(1, dt * 7);

    const viewY = camRotY + parallaxX;
    const viewX = camRotX + parallaxY;
    const cosY = Math.cos(viewY);
    const sinY = Math.sin(viewY);
    const cosX = Math.cos(viewX);
    const sinX = Math.sin(viewX);

    // 1. Vẽ nền vũ trụ hồng tím mộng mơ 5D
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      10,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.85
    );
    bgGrad.addColorStop(0, '#360d3b');
    bgGrad.addColorStop(0.38, '#1b0622');
    bgGrad.addColorStop(0.75, '#0d0314');
    bgGrad.addColorStop(1, '#06010a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Đám mây ánh sáng hồng thở nhẹ theo nhịp tim
    const nebulaR = unitScale * (2.6 + beat * 0.38);
    const neb = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, nebulaR);
    neb.addColorStop(0, `rgba(255, 62, 148, ${0.22 + beat * 0.1})`);
    neb.addColorStop(0.45, 'rgba(218, 46, 138, 0.09)');
    neb.addColorStop(1, 'rgba(255, 62, 148, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, width, height);

    // 2. Các ngôi sao nền lấp lánh có thị sai 5D
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const sx = (s.nx * width - parallaxX * 140 * s.depth + width) % width;
      const sy = (s.ny * height - parallaxY * 140 * s.depth + height) % height;
      const alpha = 0.22 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Xây hàng đợi sắp xếp theo chiều sâu Z thực sự (3D occlusion!)
    renderQueue.length = 0;

    // 3a. Lõi phát sáng trung tâm của trái tim
    const coreProj = project3D(0, 0, 0, cosY, sinY, cosX, sinX);
    if (coreProj) {
      renderQueue.push({ type: 'core', z: coreProj.z, proj: coreProj });
    }

    // 3b. Toàn bộ hạt cấu thành trái tim 3D ở giữa
    const heartTiltY = Math.sin(t * 0.6) * 0.18;
    const hCos = Math.cos(heartTiltY);
    const hSin = Math.sin(heartTiltY);

    for (let i = 0; i < heartParticles.length; i += 1) {
      const p = heartParticles[i];
      const scale = heartPulse * (p.isAura ? 1 + 0.04 * Math.sin(t * 2 + p.twinklePhase) : 1);
      const rx = (p.bx * hCos - p.bz * hSin) * scale;
      const rz = (p.bx * hSin + p.bz * hCos) * scale;
      const ry = p.by * scale;

      const proj = project3D(rx, ry, rz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({
        type: 'heartDot',
        z: proj.z,
        proj,
        p,
      });
    }

    // 3c. Vòng bụi sao xoay nghiêng quanh trái tim
    const ringTilt = 0.24;
    const rCos = Math.cos(ringTilt);
    const rSin = Math.sin(ringTilt);

    for (let i = 0; i < orbitDust.length; i += 1) {
      const d = orbitDust[i];
      const ang = d.angle + t * d.speed;
      const ox = Math.cos(ang) * d.radius;
      const oz = Math.sin(ang) * d.radius;
      const oy = d.yOffset + Math.sin(ang * 2 + t) * 0.06;

      // Nghiêng nhẹ mặt phẳng quỹ đạo
      const wy = oy * rCos - oz * rSin;
      const wz = oy * rSin + oz * rCos;

      const proj = project3D(ox, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'dust', z: proj.z, proj, d });
    }

    // 3d. Các tấm ảnh xoay quanh trái tim (quỹ đạo 3D thật)
    const orbitSpeed = 0.44;
    for (let i = 0; i < orbitPhotos.length; i += 1) {
      const item = orbitPhotos[i];
      const ang = item.baseAngle + t * orbitSpeed;
      const ox = Math.cos(ang) * item.radiusMul;
      const oz = Math.sin(ang) * item.radiusMul;
      const oy = (item.yOffset || 0) + Math.sin(t * 1.4 + item.yBobPhase) * item.yBobAmp;

      const wy = oy * rCos - oz * rSin;
      const wz = oy * rSin + oz * rCos;

      const proj = project3D(ox, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({
        type: 'orbitPhoto',
        z: proj.z,
        proj,
        photo: loadedPhotos[item.photoIndex],
        tilt: Math.sin(t * 1.2 + item.tiltPhase) * 0.09,
        yawCos: 0.78 + 0.22 * Math.cos(ang + viewY),
      });
    }

    // 3e. Dòng ảnh rơi từ trên xuống dưới theo chiều sâu 5D
    for (let i = 0; i < fallingPhotos.length; i += 1) {
      const f = fallingPhotos[i];
      f.y += f.vy * dt;
      f.spinPhase += f.spinSpeed * dt;
      f.trailTimer += dt;

      const wx = f.x + Math.sin(t * f.swayFreq + f.swayPhase) * f.swayAmp;
      const wy = f.y;
      const wz = f.z;

      // Rơi qua đáy màn hình thì quay lại từ đỉnh màn hình
      if (f.y > 3.9) {
        fallingPhotos[i] = createFallingPhoto(false);
        continue;
      }

      // Chiếu theo không gian 3D chung để xoay camera thấy chiều sâu 5D đồng bộ!
      const worldProj = project3D(wx, wy, wz, cosY, sinY, cosX, sinX);
      if (!worldProj) continue;

      // Thỉnh thoảng rắc hạt tim nhỏ phía sau tấm ảnh đang rơi
      if (f.trailTimer > 0.28 && bursts.length < 180) {
        f.trailTimer = 0;
        bursts.push({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: worldProj.sx + rand(-14, 14),
          y: worldProj.sy - 14,
          vx: rand(-12, 12),
          vy: rand(-25, -6),
          gravity: 12,
          drag: 0.98,
          size: rand(4, 9),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-1.5, 1.5),
          color: pick(['#ffb3d9', '#ffe0f0', '#ff6eb0', '#ffe6a7']),
          life: 0,
          maxLife: rand(0.6, 1.05),
        });
      }

      renderQueue.push({
        type: 'fallingPhoto',
        z: worldProj.z,
        proj: worldProj,
        photo: loadedPhotos[f.photoIndex],
        rot: Math.sin(f.spinPhase) * f.rotAmp,
        flutterX: 0.68 + 0.32 * Math.abs(Math.cos(f.spinPhase * 0.85)),
        scaleMul: f.scaleMul,
        yWorld: f.y,
      });
    }

    // Sắp xếp từ xa đến gần (Painter's Algorithm -> chiều sâu 3D/5D chân thực!)
    renderQueue.sort((a, b) => b.z - a.z);

    clickableCards = [];

    for (let i = 0; i < renderQueue.length; i += 1) {
      const node = renderQueue[i];
      const { sx, sy, scale, z } = node.proj;

      if (node.type === 'core') {
        const coreR = unitScale * 1.18 * scale * heartPulse;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
        g.addColorStop(0, `rgba(255, 190, 228, ${0.46 + beat * 0.22})`);
        g.addColorStop(0.38, `rgba(255, 52, 142, ${0.3 + beat * 0.14})`);
        g.addColorStop(1, 'rgba(255, 46, 122, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.type === 'heartDot') {
        const p = node.p;
        const depthAlpha = Math.max(0.22, Math.min(1, 1.48 - z * 0.12));
        const tw = 0.62 + 0.38 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        const r = Math.max(0.8, p.size * scale * 0.78);

        if (p.sparkle && r > 1.7) {
          drawStarGlint(ctx, sx, sy, r * 2.1, p.color, depthAlpha * tw);
        } else {
          ctx.globalAlpha = depthAlpha * tw * (p.isAura ? 0.68 : 0.96);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (node.type === 'dust') {
        const d = node.d;
        const alpha = Math.max(0.15, Math.min(0.95, 1.35 - z * 0.11)) * (0.55 + 0.45 * Math.sin(t * 3 + d.phase));
        const r = Math.max(0.7, d.size * scale * 0.7);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (node.type === 'orbitPhoto') {
        const cardW = unitScale * 0.66 * scale;
        const cardH = cardW * (304 / 256);
        const depthAlpha = Math.max(0.38, Math.min(1, 1.55 - z * 0.13));

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(node.tilt);
        ctx.scale(node.yawCos, 1);
        ctx.globalAlpha = depthAlpha;
        ctx.drawImage(node.photo.card, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();

        clickableCards.push({ x: sx, y: sy, w: cardW * node.yawCos, h: cardH, src: node.photo.src });
      } else if (node.type === 'fallingPhoto') {
        const cardW = unitScale * 0.56 * scale * node.scaleMul;
        const cardH = cardW * (304 / 256);
        let fadeEdge = 1;
        if (node.yWorld < -2.6) fadeEdge = Math.max(0, (node.yWorld + 3.9) / 1.3);
        else if (node.yWorld > 2.6) fadeEdge = Math.max(0, (3.9 - node.yWorld) / 1.3);
        const depthAlpha = Math.max(0.22, Math.min(0.96, 1.45 - z * 0.12)) * fadeEdge;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(node.rot);
        ctx.scale(node.flutterX, 1);
        ctx.globalAlpha = depthAlpha;
        ctx.drawImage(node.photo.card, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();

        if (depthAlpha > 0.35) {
          clickableCards.push({ x: sx, y: sy, w: cardW * node.flutterX, h: cardH, src: node.photo.src });
        }
      }
    }

    // 4. Vòng sóng năng lượng từ nhịp đập trái tim & điểm chạm
    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const wv = shockwaves[i];
      wv.life += dt;
      if (wv.life >= wv.maxLife) {
        shockwaves.splice(i, 1);
        continue;
      }
      const p = wv.life / wv.maxLife;
      const curR = wv.r + (wv.maxR - wv.r) * (1 - Math.pow(1 - p, 3));
      ctx.save();
      ctx.strokeStyle = `rgba(255, 134, 198, ${(1 - p) * 0.45})`;
      ctx.lineWidth = Math.max(1, 3 * (1 - p));
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Hạt trái tim & sao lấp lánh khi chạm màn hình / vệt ảnh rơi
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const b = bursts[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        bursts.splice(i, 1);
        continue;
      }
      b.vx *= Math.pow(b.drag, dt * 60);
      b.vy = b.vy * Math.pow(b.drag, dt * 60) + b.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.rotSpeed * dt;

      const prog = b.life / b.maxLife;
      const alpha = prog < 0.15 ? prog / 0.15 : 1 - (prog - 0.15) / 0.85;
      if (b.kind === 'star') {
        drawStarGlint(ctx, b.x, b.y, b.size, b.color, alpha);
      } else {
        drawMiniHeart(ctx, b.x, b.y, b.size, b.color, alpha, b.rot);
      }
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
