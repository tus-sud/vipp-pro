(() => {
  'use strict';

  const cfg = Object.assign(
    {
      photo: 'assets/photo.jpg',
      frameStyle: 'polaroid',
      badge: 'Dành riêng cho cậu ✨',
      title: 'Gửi người đặc biệt nhất',
      subtitle: 'Mỗi khoảnh khắc bên cậu đều ngọt ngào như mơ',
      message:
        'Cảm ơn cậu vì đã xuất hiện và làm những ngày bình thường trở nên thật rực rỡ.',
      signature: '— Luôn nghĩ về cậu ♥',
      photoCaption: 'Sweetest Memory 💕',
      musicFile: '',
      musicTitle: 'Hộp nhạc ngọt ngào',
      heartButtonText: 'Thả tim ngay',
      tapHint: 'Chạm vào màn hình để bắn tim & mở nhạc nhé 💕',
    },
    window.HEART_PAGE_CONFIG || {}
  );

  // ============================================================
  // 1. ÁP DỤNG CẤU HÌNH VÀO GIAO DIỆN
  // ============================================================
  const $ = (id) => document.getElementById(id);

  const badgeWrap = $('badgeWrap');
  const badgeText = $('badgeText');
  const titleText = $('titleText');
  const subtitleText = $('subtitleText');
  const mainPhoto = $('mainPhoto');
  const photoFallback = $('photoFallback');
  const photoCaption = $('photoCaption');
  const photoFrameBtn = $('photoFrameBtn');
  const frameToggle = $('frameToggle');
  const frameToggleLabel = $('frameToggleLabel');
  const messageBox = $('messageBox');
  const messageText = $('messageText');
  const signatureText = $('signatureText');
  const heartBtn = $('heartBtn');
  const heartBtnText = $('heartBtnText');
  const heartCountEl = $('heartCount');
  const tapHintEl = $('tapHint');
  const musicToggle = $('musicToggle');
  const musicTitleEl = $('musicTitle');
  const customAudio = $('customAudio');
  const milestoneToast = $('milestoneToast');

  if (cfg.title) {
    titleText.textContent = cfg.title;
    document.title = `${cfg.title} 💕`;
  } else {
    titleText.hidden = true;
  }

  if (cfg.badge) {
    badgeText.textContent = cfg.badge;
  } else {
    badgeWrap.hidden = true;
  }

  if (cfg.subtitle) {
    subtitleText.textContent = cfg.subtitle;
  } else {
    subtitleText.hidden = true;
  }

  if (cfg.message || cfg.signature) {
    messageText.textContent = cfg.message || '';
    signatureText.textContent = cfg.signature || '';
    if (!cfg.message) messageText.hidden = true;
    if (!cfg.signature) signatureText.hidden = true;
  } else {
    messageBox.hidden = true;
  }

  photoCaption.textContent = cfg.photoCaption || '';
  if (!cfg.photoCaption) photoCaption.style.display = 'none';

  heartBtnText.textContent = cfg.heartButtonText || 'Thả tim ngay';
  musicTitleEl.textContent = cfg.musicTitle || 'Hộp nhạc ngọt ngào';

  if (cfg.tapHint) {
    tapHintEl.textContent = cfg.tapHint;
  } else {
    tapHintEl.classList.add('is-hidden');
  }

  // Tải ảnh chính & xử lý dự phòng nếu sai đường dẫn
  mainPhoto.addEventListener('error', () => {
    mainPhoto.hidden = true;
    photoFallback.hidden = false;
  });
  mainPhoto.addEventListener('load', () => {
    mainPhoto.hidden = false;
    photoFallback.hidden = true;
  });
  mainPhoto.src = cfg.photo;

  // Kiểu khung ảnh (Polaroid <-> Trái tim)
  let currentFrame = cfg.frameStyle === 'heart' ? 'heart' : 'polaroid';
  function applyFrameStyle(style) {
    currentFrame = style === 'heart' ? 'heart' : 'polaroid';
    photoFrameBtn.classList.toggle('frame-heart', currentFrame === 'heart');
    photoFrameBtn.classList.toggle('frame-polaroid', currentFrame === 'polaroid');
    frameToggleLabel.textContent = currentFrame === 'heart' ? 'Khung Polaroid' : 'Khung tim';
  }
  applyFrameStyle(currentFrame);

  frameToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    applyFrameStyle(currentFrame === 'heart' ? 'polaroid' : 'heart');
    const rect = photoFrameBtn.getBoundingClientRect();
    scene.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);
  });

  // ============================================================
  // 2. BỘ PHÁT NHẠC LÃNG MẠN (FILE MP3 HOẶC HỘP NHẠC WEB AUDIO)
  // ============================================================
  class RomanticMusicBox {
    constructor(audioEl, musicFile) {
      this.audioEl = audioEl;
      this.musicFile = (musicFile || '').trim();
      this.useCustomFile = Boolean(this.musicFile);
      this.isPlaying = false;
      this.userMuted = false;

      this.ctx = null;
      this.masterGain = null;
      this.delayNode = null;
      this.stepTimer = null;
      this.stepIndex = 0;

      // Giai điệu hộp nhạc êm dịu (tông Đô trưởng / La thứ lãng mạn)
      // Mỗi bước = [nốt giai điệu Hz hoặc null, hợp âm đệm Hz[]]
      this.sequence = [
        // Cmaj7
        { lead: 659.25, chord: [261.63, 329.63, 392.0] }, // E5
        { lead: 783.99, chord: [493.88] }, // G5
        { lead: 1046.5, chord: [392.0] }, // C6
        { lead: 987.77, chord: [329.63] }, // B5
        { lead: 783.99, chord: [261.63, 392.0] }, // G5
        { lead: 659.25, chord: [493.88] }, // E5
        // Am7
        { lead: 880.0, chord: [220.0, 261.63, 329.63] }, // A5
        { lead: 783.99, chord: [392.0] }, // G5
        { lead: 659.25, chord: [329.63] }, // E5
        { lead: 587.33, chord: [261.63] }, // D5
        { lead: 523.25, chord: [220.0, 329.63] }, // C5
        { lead: null, chord: [392.0] },
        // Fmaj7
        { lead: 698.46, chord: [174.61, 261.63, 329.63] }, // F5
        { lead: 880.0, chord: [349.23] }, // A5
        { lead: 783.99, chord: [329.63] }, // G5
        { lead: 659.25, chord: [261.63] }, // E5
        { lead: 587.33, chord: [174.61, 329.63] }, // D5
        { lead: 523.25, chord: [349.23] }, // C5
        // G6 -> G7
        { lead: 587.33, chord: [196.0, 246.94, 293.66] }, // D5
        { lead: 659.25, chord: [392.0] }, // E5
        { lead: 783.99, chord: [293.66] }, // G5
        { lead: 659.25, chord: [246.94] }, // E5
        { lead: 587.33, chord: [196.0, 392.0] }, // D5
        { lead: null, chord: [293.66] },
      ];

      if (this.useCustomFile) {
        this.audioEl.src = this.musicFile;
        this.audioEl.volume = 0.65;
        this.audioEl.addEventListener('error', () => {
          // Tự động chuyển sang hộp nhạc nếu file MP3 không tải được
          this.useCustomFile = false;
          if (this.isPlaying) {
            this.startSynth();
          }
        });
      }
    }

    initAudioCtx() {
      if (this.ctx) return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      this.ctx = new AudioContextCtor();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.24;

      // Hiệu ứng vang nhẹ ấm áp như hộp nhạc thật
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.34;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.24;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2100;

      this.delayNode.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(this.delayNode);
      delayFilter.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
    }

    playBellNote(freq, volume, duration, delayOffset = 0) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + delayOffset;

      const noteGain = this.ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Âm cơ bản sine mềm mại
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Họa âm chuông nhẹ tạo màu hộp nhạc lấp lánh
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);
      const harmonicGain = this.ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.14, now);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.45, duration * 0.45));

      osc1.connect(noteGain);
      osc2.connect(harmonicGain);
      harmonicGain.connect(noteGain);

      noteGain.connect(this.masterGain);
      noteGain.connect(this.delayNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + duration + 0.05);
    }

    startSynth() {
      this.initAudioCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.stepTimer) clearInterval(this.stepTimer);

      const playStep = () => {
        if (!this.isPlaying) return;
        const step = this.sequence[this.stepIndex % this.sequence.length];
        this.stepIndex += 1;

        if (step.chord) {
          step.chord.forEach((f, idx) => {
            this.playBellNote(f, 0.14, 1.5, idx * 0.035);
          });
        }
        if (step.lead) {
          this.playBellNote(step.lead, 0.28, 1.9, 0.01);
        }
      };

      playStep();
      this.stepTimer = setInterval(playStep, 460);
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
          // Nếu trình duyệt chặn hoặc lỗi file -> thử hộp nhạc
          this.useCustomFile = false;
        }
      }
      this.startSynth();
    }

    pause() {
      this.isPlaying = false;
      this.updateUI();
      if (this.useCustomFile) {
        this.audioEl.pause();
      }
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

    tryAutoStartOnGesture() {
      if (!this.isPlaying && !this.userMuted) {
        this.play();
      }
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
    const rect = musicToggle.getBoundingClientRect();
    scene.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
  });

  // ============================================================
  // 3. CANVAS HIỆU ỨNG TRÁI TIM 60FPS (MƯA TIM + TIM BAY + BẮN TIM)
  // ============================================================
  const HEART_COLORS = [
    '#ff5c93',
    '#ff7aa8',
    '#ff99be',
    '#ffb8d2',
    '#f24b8a',
    '#ff85b3',
    '#ffc6dc',
    '#ff6b9d',
  ];

  const SPARKLE_COLORS = ['#ffffff', '#ffe5f0', '#ffd6e8', '#fff4cc', '#ff9ec2'];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function drawHeartPath(ctx, size) {
    const topY = -size * 0.32;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.52);
    ctx.bezierCurveTo(-size * 0.78, size * 0.05, -size * 0.82, -size * 0.56, -size * 0.36, -size * 0.56);
    ctx.bezierCurveTo(-size * 0.12, -size * 0.56, 0, topY, 0, topY);
    ctx.bezierCurveTo(0, topY, size * 0.12, -size * 0.56, size * 0.36, -size * 0.56);
    ctx.bezierCurveTo(size * 0.82, -size * 0.56, size * 0.78, size * 0.05, 0, size * 0.52);
    ctx.closePath();
  }

  function drawSparkle(ctx, x, y, r, color, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      const aMid = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(aMid) * r * 0.28, Math.sin(aMid) * r * 0.28);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  class HeartScene {
    constructor(bgCanvas, fgCanvas) {
      this.canvas = bgCanvas;
      this.ctx = bgCanvas.getContext('2d');
      this.fgCanvas = fgCanvas;
      this.fgCtx = fgCanvas.getContext('2d');
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.ambient = [];
      this.bursts = [];
      this.twinkles = [];
      this.lastTime = performance.now();

      this.resize();
      this.seedAmbient();
      window.addEventListener('resize', () => this.resize());
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.floor(this.width * this.dpr);
      const ph = Math.floor(this.height * this.dpr);
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.fgCanvas.width = pw;
      this.fgCanvas.height = ph;
      this.fgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    createAmbientHeart(randomY = false) {
      // Kết hợp hài hòa giữa mưa tim rơi dịu dàng và tim bay lơ lửng lên cao
      const isFalling = Math.random() < 0.56;
      const size = rand(10, 26);
      return {
        mode: isFalling ? 'fall' : 'rise',
        x: rand(-20, this.width + 20),
        y: randomY ? rand(-20, this.height + 20) : isFalling ? rand(-60, -16) : rand(this.height + 16, this.height + 65),
        size,
        vy: isFalling ? rand(26, 62) : -rand(22, 54),
        vx: isFalling ? rand(-12, 18) : rand(-8, 8),
        swayAmp: rand(12, 34),
        swayFreq: rand(0.7, 1.8),
        phase: rand(0, Math.PI * 2),
        rot: rand(-0.35, 0.35),
        rotSpeed: rand(-0.6, 0.6),
        flipPhase: rand(0, Math.PI * 2),
        flipSpeed: rand(0.9, 2.2),
        color: pick(HEART_COLORS),
        alpha: rand(0.32, 0.78),
        outline: Math.random() < 0.18,
      };
    }

    seedAmbient() {
      const targetCount = Math.max(26, Math.min(46, Math.floor((this.width * this.height) / 16000)));
      this.ambient = [];
      for (let i = 0; i < targetCount; i += 1) {
        this.ambient.push(this.createAmbientHeart(true));
      }

      const twinkleCount = Math.max(14, Math.min(26, Math.floor(this.width / 32)));
      this.twinkles = [];
      for (let i = 0; i < twinkleCount; i += 1) {
        this.twinkles.push({
          x: rand(10, this.width - 10),
          y: rand(10, this.height - 10),
          r: rand(3.5, 7.5),
          phase: rand(0, Math.PI * 2),
          speed: rand(1.4, 3.2),
          color: pick(SPARKLE_COLORS),
        });
      }
    }

    spawnBurst(x, y, count = 16) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + rand(-0.25, 0.25);
        const speed = rand(70, 230);
        const isSparkle = i % 4 === 0;
        this.bursts.push({
          kind: isSparkle ? 'sparkle' : 'heart',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(40, 110),
          gravity: isSparkle ? 140 : 195,
          drag: 0.965,
          size: isSparkle ? rand(4, 8) : rand(11, 24),
          rot: rand(-0.5, 0.5),
          rotSpeed: rand(-2.8, 2.8),
          color: isSparkle ? pick(SPARKLE_COLORS) : pick(HEART_COLORS),
          life: 0,
          maxLife: rand(0.95, 1.65),
          glossy: !isSparkle && Math.random() < 0.7,
        });
      }
    }

    spawnFountain(x, y, count = 18) {
      for (let i = 0; i < count; i += 1) {
        const spread = rand(-0.65, 0.65);
        const speed = rand(170, 340);
        this.bursts.push({
          kind: i % 5 === 0 ? 'sparkle' : 'heart',
          x: x + rand(-24, 24),
          y: y + rand(-8, 8),
          vx: Math.sin(spread) * speed * 0.72,
          vy: -Math.cos(spread) * speed,
          gravity: 240,
          drag: 0.982,
          size: i % 5 === 0 ? rand(4, 8) : rand(13, 26),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-2.2, 2.2),
          color: i % 5 === 0 ? pick(SPARKLE_COLORS) : pick(HEART_COLORS),
          life: 0,
          maxLife: rand(1.15, 1.9),
          glossy: true,
        });
      }
    }

    spawnTrailHeart(x, y) {
      this.bursts.push({
        kind: Math.random() < 0.28 ? 'sparkle' : 'heart',
        x: x + rand(-6, 6),
        y: y + rand(-6, 6),
        vx: rand(-26, 26),
        vy: rand(-55, -18),
        gravity: 35,
        drag: 0.97,
        size: rand(8, 16),
        rot: rand(-0.4, 0.4),
        rotSpeed: rand(-1.6, 1.6),
        color: pick(HEART_COLORS),
        life: 0,
        maxLife: rand(0.7, 1.15),
        glossy: false,
      });
    }

    spawnShower() {
      const cols = 10;
      for (let i = 0; i < cols; i += 1) {
        const px = ((i + 0.5) / cols) * this.width + rand(-24, 24);
        this.bursts.push({
          kind: 'heart',
          x: px,
          y: rand(-40, 20),
          vx: rand(-35, 35),
          vy: rand(70, 150),
          gravity: 60,
          drag: 0.992,
          size: rand(16, 30),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-2, 2),
          color: pick(HEART_COLORS),
          life: 0,
          maxLife: rand(2.2, 3.2),
          glossy: true,
        });
      }
    }

    drawHeart(ctx, x, y, size, rot, scaleX, color, alpha, outline, glossy) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scaleX, 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      drawHeartPath(ctx, size);
      if (outline) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();

        if (glossy && size >= 13) {
          ctx.beginPath();
          ctx.ellipse(-size * 0.24, -size * 0.22, size * 0.12, size * 0.07, -0.55, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const t = now / 1000;

      const ctx = this.ctx;
      const fgCtx = this.fgCtx;
      ctx.clearRect(0, 0, this.width, this.height);
      fgCtx.clearRect(0, 0, this.width, this.height);

      // 1. Ánh sao lấp lánh nhẹ (lớp nền)
      for (let i = 0; i < this.twinkles.length; i += 1) {
        const s = this.twinkles[i];
        const a = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        drawSparkle(ctx, s.x, s.y, s.r, s.color, a, t * 0.4 + s.phase);
      }

      // 2. Mưa trái tim & trái tim bay lơ lửng (lớp nền)
      for (let i = 0; i < this.ambient.length; i += 1) {
        const h = this.ambient[i];
        h.y += h.vy * dt;
        h.x += (h.vx + Math.cos(t * h.swayFreq + h.phase) * h.swayAmp) * dt;
        h.rot += h.rotSpeed * dt;
        h.flipPhase += h.flipSpeed * dt;

        // Hiệu ứng lật cánh nhẹ cho tim rơi
        const scaleX = h.mode === 'fall' ? 0.52 + 0.48 * Math.abs(Math.cos(h.flipPhase)) : 1;

        // Mờ dần mượt mà ở mép trên & dưới
        let edgeFade = 1;
        if (h.y < 60) edgeFade = Math.max(0, (h.y + 30) / 90);
        else if (h.y > this.height - 60) edgeFade = Math.max(0, (this.height + 30 - h.y) / 90);

        this.drawHeart(
          ctx,
          h.x,
          h.y,
          h.size,
          h.rot,
          scaleX,
          h.color,
          h.alpha * edgeFade,
          h.outline,
          !h.outline && h.size > 16
        );

        const outBottom = h.mode === 'fall' && h.y > this.height + 50;
        const outTop = h.mode === 'rise' && h.y < -50;
        if (outBottom || outTop || h.x < -70 || h.x > this.width + 70) {
          this.ambient[i] = this.createAmbientHeart(false);
        }
      }

      // 3. Hiệu ứng chạm bắn tim & đài phun tim (lớp phía trước rực rỡ)
      for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
        const p = this.bursts[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          this.bursts.splice(i, 1);
          continue;
        }
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;

        const progress = p.life / p.maxLife;
        const alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
        const scale = progress < 0.2 ? 0.65 + (progress / 0.2) * 0.45 : 1.1 - progress * 0.25;

        if (p.kind === 'sparkle') {
          drawSparkle(fgCtx, p.x, p.y, p.size * scale, p.color, alpha, p.rot);
        } else {
          this.drawHeart(fgCtx, p.x, p.y, p.size * scale, p.rot, 1, p.color, alpha, false, p.glossy);
        }
      }

      // Giới hạn số hạt tối đa để điện thoại luôn mượt 60fps
      if (this.bursts.length > 260) {
        this.bursts.splice(0, this.bursts.length - 260);
      }

      requestAnimationFrame(this.loop);
    }
  }

  const scene = new HeartScene($('heartCanvas'), $('burstCanvas'));

  // ============================================================
  // 4. TƯƠNG TÁC CHẠM BẮN TIM, KÉO VỆT TIM & ĐẾM MỐC TIM
  // ============================================================
  let heartCount = 0;
  let toastTimer = null;
  let hasInteracted = false;

  const MILESTONES = {
    10: '10 trái tim rồi nè! Ngọt ngào quá 💖',
    25: '25 trái tim! Tràn ngập yêu thương 🌸',
    50: '50 trái tim! Tan chảy mất thôi 💘',
    100: '100 trái tim! Mãi bên nhau nhé 💞',
  };

  function showToast(text) {
    milestoneToast.textContent = text;
    milestoneToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      milestoneToast.classList.remove('show');
    }, 2600);
  }

  function registerFirstInteraction() {
    if (!hasInteracted) {
      hasInteracted = true;
      tapHintEl.classList.add('is-hidden');
      music.tryAutoStartOnGesture();
    }
  }

  function addHeartCount(amount = 1) {
    heartCount += amount;
    heartCountEl.textContent = String(heartCount);
    if (MILESTONES[heartCount]) {
      showToast(MILESTONES[heartCount]);
      scene.spawnShower();
      setTimeout(() => scene.spawnShower(), 350);
    }
    if (navigator.vibrate) {
      navigator.vibrate(18);
    }
  }

  // Nút "Thả tim ngay"
  heartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    registerFirstInteraction();
    addHeartCount(1);

    heartBtn.classList.remove('is-bouncing');
    void heartBtn.offsetWidth;
    heartBtn.classList.add('is-bouncing');

    const rect = heartBtn.getBoundingClientRect();
    scene.spawnFountain(rect.left + rect.width / 2, rect.top + 8, 20);
  });

  // Chạm trực tiếp vào khung ảnh -> ảnh đập nhịp tim + bung hoa trái tim
  photoFrameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    registerFirstInteraction();
    addHeartCount(1);

    photoFrameBtn.classList.remove('is-popping');
    void photoFrameBtn.offsetWidth;
    photoFrameBtn.classList.add('is-popping');

    const rect = photoFrameBtn.getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    scene.spawnBurst(cx, cy, 24);
  });

  // Chạm bất kỳ đâu trên màn hình -> bắn tim tại chỗ chạm
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    registerFirstInteraction();
    scene.spawnBurst(e.clientX, e.clientY, 16);
  });

  // Kéo tay hoặc di chuột khi giữ -> vẽ dải tim lấp lánh
  let isPointerDown = false;
  let lastTrailTime = 0;
  let lastTrailX = 0;
  let lastTrailY = 0;

  document.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    lastTrailX = e.clientX;
    lastTrailY = e.clientY;
  });
  window.addEventListener('pointerup', () => {
    isPointerDown = false;
  });
  window.addEventListener('pointercancel', () => {
    isPointerDown = false;
  });

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!isPointerDown && e.pointerType !== 'mouse') return;
      const now = performance.now();
      const dist = Math.hypot(e.clientX - lastTrailX, e.clientY - lastTrailY);
      const minGap = isPointerDown ? 26 : 55;
      const minDist = isPointerDown ? 18 : 34;

      if (now - lastTrailTime > minGap && dist > minDist) {
        lastTrailTime = now;
        lastTrailX = e.clientX;
        lastTrailY = e.clientY;
        scene.spawnTrailHeart(e.clientX, e.clientY);
      }
    },
    { passive: true }
  );

  // Màn chào mừng nhẹ nhàng ngay khi vừa mở trang
  setTimeout(() => {
    const rect = photoFrameBtn.getBoundingClientRect();
    scene.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);
  }, 500);
})();
