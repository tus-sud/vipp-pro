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
    orbitPhotoCount: Math.max(6, Math.min(14, rawCfg.orbitPhotoCount || Math.max(8, photoList.length))),
    fallingPhotoCount: Math.max(8, Math.min(24, rawCfg.fallingPhotoCount || 16)),
    autoRotateSpeed: typeof rawCfg.autoRotateSpeed === 'number' ? rawCfg.autoRotateSpeed : 0.32,
  };

  const canvas = document.getElementById('scene5d');
  const ctx = canvas.getContext('2d');
  const musicToggle = document.getElementById('musicToggle');
  const musicLabel = document.getElementById('musicLabel');
  const burstTrigger = document.getElementById('burstTrigger');
  const customAudio = document.getElementById('customAudio');
  const gestureHint = document.getElementById('gestureHint');
  const photoModal = document.getElementById('photoModal');
  const photoModalImg = document.getElementById('photoModalImg');

  // ============================================================
  // 1. NHẠC NỀN LÃNG MẠN ĐA LỚP (PAD MƠ MÀNG + PIANO + HỘP NHẠC / MP3)
  // ============================================================
  class RomanticSoundtrack {
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

      // Bản hòa âm 32 nhịp giàu cảm xúc (Cmaj7 -> Em7 -> Am7 -> Fmaj7 -> Dm7 -> G7 -> Cmaj7)
      this.sequence = [
        // Cmaj7
        { pad: [261.63, 329.63, 392.0, 493.88], bass: 130.81, lead: 659.25, arp: 523.25 },
        { lead: 783.99, arp: 392.0 },
        { lead: 1046.5, arp: 493.88 },
        { bass: 130.81, lead: 987.77, arp: 392.0 },
        { lead: 783.99, arp: 523.25 },
        { lead: 659.25, arp: 493.88 },
        // Em7
        { pad: [246.94, 293.66, 392.0, 493.88], bass: 164.81, lead: 783.99, arp: 392.0 },
        { lead: 987.77, arp: 493.88 },
        { lead: 1174.66, arp: 587.33 },
        { bass: 164.81, lead: 1046.5, arp: 493.88 },
        { lead: 987.77, arp: 392.0 },
        { lead: 783.99, arp: 493.88 },
        // Am7
        { pad: [220.0, 261.63, 329.63, 392.0], bass: 110.0, lead: 880.0, arp: 329.63 },
        { lead: 783.99, arp: 392.0 },
        { lead: 659.25, arp: 523.25 },
        { bass: 110.0, lead: 587.33, arp: 392.0 },
        { lead: 523.25, arp: 329.63 },
        { lead: 659.25, arp: 392.0 },
        // Fmaj7
        { pad: [174.61, 220.0, 261.63, 329.63], bass: 87.31, lead: 698.46, arp: 349.23 },
        { lead: 880.0, arp: 440.0 },
        { lead: 1046.5, arp: 523.25 },
        { bass: 87.31, lead: 880.0, arp: 440.0 },
        { lead: 783.99, arp: 349.23 },
        { lead: 659.25, arp: 440.0 },
        // Dm7 -> G7sus4 -> G7
        { pad: [196.0, 261.63, 293.66, 349.23], bass: 146.83, lead: 587.33, arp: 349.23 },
        { lead: 698.46, arp: 440.0 },
        { lead: 880.0, arp: 523.25 },
        { bass: 98.0, lead: 783.99, arp: 392.0 },
        { lead: 659.25, arp: 493.88 },
        { lead: 587.33, arp: 392.0 },
        { bass: 98.0, lead: 523.25, arp: 293.66 },
        { lead: 587.33, arp: 392.0 },
      ];

      if (this.useCustomFile) {
        this.audioEl.src = this.musicFile;
        this.audioEl.volume = 0.88;
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

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;

      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.36;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.3;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;

      this.delayNode.connect(filter);
      filter.connect(feedback);
      feedback.connect(this.delayNode);
      filter.connect(this.masterGain);

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);
    }

    playPad(freqs, dur) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      freqs.forEach((f) => {
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.065, now + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + dur + 0.08);
      });
    }

    playTone(freq, vol, dur, offset = 0, warm = false) {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + offset;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      const osc1 = this.ctx.createOscillator();
      osc1.type = warm ? 'triangle' : 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);
      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(warm ? 0.12 : 0.24, now);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.55, dur * 0.5));

      osc1.connect(gain);
      osc2.connect(hGain);
      hGain.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(this.delayNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur + 0.06);
      osc2.stop(now + dur + 0.06);
    }

    async startSynth() {
      this.initAudioCtx();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch {
          return false;
        }
      }
      if (this.ctx.state !== 'running') return false;
      if (this.stepTimer) clearInterval(this.stepTimer);

      const tick = () => {
        if (!this.isPlaying || !this.ctx || this.ctx.state !== 'running') return;
        const step = this.sequence[this.stepIndex % this.sequence.length];
        this.stepIndex += 1;
        if (step.pad) this.playPad(step.pad, 2.75);
        if (step.bass) this.playTone(step.bass, 0.34, 2.2, 0, true);
        if (step.arp) this.playTone(step.arp, 0.22, 1.5, 0.06, true);
        if (step.lead) this.playTone(step.lead, 0.48, 2.05, 0.01, false);
      };
      tick();
      this.stepTimer = setInterval(tick, 430);
      return true;
    }

    stopSynth() {
      if (this.stepTimer) {
        clearInterval(this.stepTimer);
        this.stepTimer = null;
      }
    }

    async play() {
      if (this.isPlaying) return;
      if (this.useCustomFile) {
        try {
          await this.audioEl.play();
          this.isPlaying = true;
          this.updateUI();
          return;
        } catch {
          if (this.audioEl.error) {
            this.useCustomFile = false;
          } else {
            this.isPlaying = false;
            this.updateUI();
            return;
          }
        }
      }
      this.isPlaying = true;
      const ok = await this.startSynth();
      if (!ok) this.isPlaying = false;
      this.updateUI();
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
      if (musicLabel) {
        musicLabel.textContent = this.isPlaying ? 'Đang phát' : 'Bật nhạc';
      }
    }
  }

  const music = new RomanticSoundtrack(customAudio, cfg.musicFile);
  musicToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    music.toggle();
  });

  music.tryAutoStart();
  ['click', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(
      evt,
      (e) => {
        if (e.target && e.target.closest && e.target.closest('#musicToggle')) return;
        music.tryAutoStart();
      },
      { passive: true }
    );
  });

  // ============================================================
  // 2. PRE-BAKED NEON BLOOM SPRITES (HIỆU ỨNG PHÁT SÁNG 5D SIÊU MƯỢT)
  // ============================================================
  function makeGlowSprite(innerColor, midColor, outerRgba) {
    const S = 48;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.2, innerColor);
    grad.addColorStop(0.42, midColor);
    grad.addColorStop(0.72, outerRgba);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    return c;
  }

  const BLOOM_SPRITES = {
    hotPink: makeGlowSprite('#ffffff', '#ff5ca8', 'rgba(255, 36, 132, 0.35)'),
    rose: makeGlowSprite('#fff4fa', '#ff82c4', 'rgba(255, 76, 168, 0.32)'),
    orchid: makeGlowSprite('#fff0ff', '#d97aff', 'rgba(186, 62, 255, 0.28)'),
    gold: makeGlowSprite('#ffffff', '#ffe08a', 'rgba(255, 180, 90, 0.34)'),
    pearl: makeGlowSprite('#ffffff', '#ffdbf0', 'rgba(255, 160, 214, 0.3)'),
  };
  const SPRITE_KEYS = Object.keys(BLOOM_SPRITES);

  // ============================================================
  // 3. KHUNG THẺ ẢNH HOLOGRAM PHÁT SÁNG (CACHED CHO 60FPS)
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

  function drawStarGlint(c, x, y, r, color, alpha, rot = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      const am = a + Math.PI / 4;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(am) * r * 0.22, Math.sin(am) * r * 0.22);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  function createFallbackCard() {
    const c = document.createElement('canvas');
    c.width = 264;
    c.height = 316;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 264, 316);
    bg.addColorStop(0, '#ff85c0');
    bg.addColorStop(1, '#b82570');
    drawRoundedRect(g, 18, 18, 228, 280, 24);
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(255, 232, 246, 0.92)';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '700 84px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('♥', 132, 160);
    return c;
  }

  function buildHologramPhotoCard(img) {
    const W = 268;
    const H = 318;
    const PAD = 20;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    // Hào quang kép hồng - vàng kim sang trọng quanh khung ảnh
    g.save();
    g.shadowColor = 'rgba(255, 78, 174, 0.85)';
    g.shadowBlur = 22;
    drawRoundedRect(g, PAD, PAD, W - PAD * 2, H - PAD * 2, 22);
    const borderGrad = g.createLinearGradient(PAD, PAD, W - PAD, H - PAD);
    borderGrad.addColorStop(0, '#fff0f8');
    borderGrad.addColorStop(0.32, '#ff8ec8');
    borderGrad.addColorStop(0.68, '#ffe3a8');
    borderGrad.addColorStop(1, '#ffc2e4');
    g.fillStyle = borderGrad;
    g.fill();
    g.restore();

    const ix = PAD + 6;
    const iy = PAD + 6;
    const iw = W - (PAD + 6) * 2;
    const ih = H - (PAD + 6) * 2;

    g.save();
    drawRoundedRect(g, ix, iy, iw, ih, 17);
    g.clip();

    const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const boxRatio = iw / ih;
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

    g.drawImage(img, sx, sy, sw, sh, ix, iy, iw, ih);

    // Ánh kính hologram lướt chéo nhẹ
    const sheen = g.createLinearGradient(ix, iy, ix + iw * 0.85, iy + ih * 0.65);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    sheen.addColorStop(0.35, 'rgba(255, 210, 238, 0.08)');
    sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(ix, iy, iw, ih);
    g.restore();

    // Ngôi sao kim tuyến nhỏ gắn ở 2 góc khung ảnh
    drawStarGlint(g, PAD + 6, PAD + 8, 9, '#ffffff', 0.95);
    drawStarGlint(g, W - PAD - 6, H - PAD - 8, 7, '#ffe6a8', 0.9);

    return c;
  }

  const fallbackCard = createFallbackCard();
  const loadedPhotos = cfg.photos.map((src) => {
    const entry = { src, card: fallbackCard, loaded: false };
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      entry.card = buildHologramPhotoCard(img);
      entry.loaded = true;
    };
    img.src = src;
    return entry;
  });

  // ============================================================
  // 4. HỆ THỐNG ĐỒ HỌA 5D (TRÁI TIM CỰC QUANG + VÒNG THIÊN HÀ + SAO BĂNG)
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

  const HEART_COLORS = ['#ff3b93', '#ff69b4', '#ff99cc', '#e07bff', '#ffd6eb', '#ffe299'];

  // Tạo 2.600 hạt trái tim 3D với điểm xuất phát xoáy thiên hà (mở màn 5D cực mượt!)
  function create3DHeartParticles(count) {
    const SAMPLES = 720;
    const pts = [];
    const cumLen = [0];
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = (Math.PI * 2 * i) / SAMPLES;
      const hx = (16 * Math.pow(Math.sin(t), 3)) / 16;
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 1.2) / 16;
      pts.push([hx, hy]);
      if (i > 0) {
        cumLen.push(cumLen[i - 1] + Math.hypot(hx - pts[i - 1][0], hy - pts[i - 1][1]));
      }
    }
    const totalLen = cumLen[SAMPLES];

    function sampleRim() {
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
    const rimCount = Math.floor(count * 0.44);
    const auraStart = Math.floor(count * 0.9);

    for (let i = 0; i < count; i += 1) {
      const [hx, hy] = sampleRim();
      const isRim = i < rimCount;
      const isAura = i >= auraStart;

      let r;
      let z;
      let jitter;
      if (isRim) {
        r = rand(0.96, 1.02);
        z = rand(-0.14, 0.14);
        jitter = 0.008;
      } else if (isAura) {
        r = rand(1.04, 1.24);
        z = rand(-0.34, 0.34);
        jitter = 0.045;
      } else {
        r = Math.pow(Math.random(), 0.44);
        const dome = Math.sqrt(Math.max(0, 1 - r * r)) * 0.56;
        z = (Math.random() < 0.5 ? 1 : -1) * dome * rand(0.86, 1.04);
        jitter = 0.016;
      }

      const bx = hx * r + rand(-jitter, jitter);
      const by = hy * r + rand(-jitter, jitter);
      const bz = z;

      // Vị trí ban đầu cho hoạt ảnh mở màn hội tụ xoáy thiên hà siêu nhanh mượt
      const introAng = rand(0, Math.PI * 2);
      const introRad = rand(2.2, 4.0);
      const spriteKey = isRim
        ? pick(['hotPink', 'pearl', 'rose', 'gold'])
        : isAura
          ? pick(['orchid', 'gold', 'pearl'])
          : pick(SPRITE_KEYS);

      list.push({
        bx,
        by,
        bz,
        sx0: Math.cos(introAng) * introRad,
        sy0: rand(-2.8, 2.8),
        sz0: Math.sin(introAng) * introRad,
        delay: rand(0, 0.25),
        size: isRim ? rand(3.2, 6.2) : isAura ? rand(2.8, 5.4) : rand(3.0, 5.8),
        sprite: BLOOM_SPRITES[spriteKey],
        twinklePhase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(2.2, 5.6),
        sparkle: isRim ? Math.random() < 0.14 : Math.random() < 0.05,
        isAura,
        isRim,
      });
    }
    return list;
  }

  // Vòng sáng kép thiên hà xoay quanh trái tim (2 dải năng lượng nghiêng đan chéo 3D!)
  function createGalaxyRings() {
    const rings = [
      { radius: 1.72, tiltX: 0.34, tiltZ: -0.22, speed: 0.55, color: 'rgba(255, 118, 198, ', glow: BLOOM_SPRITES.hotPink, count: 150 },
      { radius: 2.38, tiltX: -0.28, tiltZ: 0.26, speed: -0.38, color: 'rgba(255, 214, 146, ', glow: BLOOM_SPRITES.gold, count: 160 },
    ];
    rings.forEach((ring) => {
      ring.particles = [];
      for (let i = 0; i < ring.count; i += 1) {
        ring.particles.push({
          angle: (Math.PI * 2 * i) / ring.count + rand(-0.08, 0.08),
          radOffset: rand(-0.14, 0.14),
          yOffset: rand(-0.08, 0.08),
          size: rand(3.8, 8.5),
          phase: rand(0, Math.PI * 2),
          bright: Math.random() < 0.18,
        });
      }
    });
    return rings;
  }

  // Các ngôi sao sâu trong không gian
  function createStarfield(count) {
    return Array.from({ length: count }, () => ({
      nx: rand(0, 1),
      ny: rand(0, 1),
      depth: rand(0.18, 1.0),
      r: rand(0.7, 2.3),
      phase: rand(0, Math.PI * 2),
      speed: rand(1.4, 4.0),
      color: pick(['#ffffff', '#ffd6ec', '#ffb3df', '#fff0c2', '#e5b8ff']),
    }));
  }

  // Đốm bokeh ánh sáng mờ điện ảnh trôi bồng bềnh
  function createBokehOrbs(count) {
    return Array.from({ length: count }, () => ({
      nx: rand(0, 1),
      ny: rand(0, 1),
      r: rand(26, 78),
      vx: rand(-8, 8),
      vy: rand(-14, -4),
      color: pick([
        'rgba(255, 84, 168, 0.11)',
        'rgba(210, 92, 255, 0.10)',
        'rgba(255, 206, 138, 0.09)',
        'rgba(255, 142, 204, 0.10)',
      ]),
      phase: rand(0, Math.PI * 2),
    }));
  }

  // Trái tim mini 3D bay lơ lửng khắp không gian
  function createFloatingMiniHearts(count) {
    return Array.from({ length: count }, () => ({
      x: rand(-3.4, 3.4),
      y: rand(-3.4, 3.4),
      z: rand(-2.8, 2.2),
      vy: rand(-0.34, -0.14),
      swayAmp: rand(0.15, 0.4),
      swayPhase: rand(0, Math.PI * 2),
      size: rand(7, 16),
      rot: rand(-0.4, 0.4),
      rotSpeed: rand(-0.8, 0.8),
      color: pick(HEART_COLORS),
      alpha: rand(0.35, 0.82),
    }));
  }

  // Danh sách 11 ảnh xoay quanh trái tim theo dải sóng lượn 5D
  function createOrbitPhotos(count) {
    const list = [];
    const baseRadius = count >= 10 ? 2.28 : 2.08;
    for (let i = 0; i < count; i += 1) {
      list.push({
        photoIndex: i % loadedPhotos.length,
        baseAngle: (Math.PI * 2 * i) / count,
        radiusMul: baseRadius + (i % 2 === 0 ? 0.12 : -0.1),
        yOffset: i % 2 === 0 ? 0.24 : -0.24,
        yBobAmp: rand(0.08, 0.15),
        yBobPhase: rand(0, Math.PI * 2),
        tiltPhase: rand(0, Math.PI * 2),
        trailTimer: rand(0, 0.18),
      });
    }
    return list;
  }

  // Dòng ảnh rơi 5D từ trên xuống dưới qua 3 tầng chiều sâu
  function createFallingPhoto(randomY) {
    const layer = Math.random();
    const zDepth = layer < 0.42 ? rand(-2.9, -1.3) : layer < 0.8 ? rand(-1.2, 0.8) : rand(0.9, 1.9);
    return {
      photoIndex: (Math.random() * loadedPhotos.length) | 0,
      x: rand(-3.2, 3.2),
      y: randomY ? rand(-3.7, 3.7) : rand(-4.4, -3.3),
      z: zDepth,
      vy: rand(0.38, 0.78) * (zDepth > 0.6 ? 1.12 : 0.88),
      swayAmp: rand(0.24, 0.56),
      swayFreq: rand(0.6, 1.4),
      swayPhase: rand(0, Math.PI * 2),
      spinPhase: rand(0, Math.PI * 2),
      spinSpeed: rand(0.75, 1.65),
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
  let camRotX = 0.22;
  let velY = 0;
  let velX = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let zoom = 1;
  let targetZoom = 1;
  let supernovaBoost = 0;

  const startTime = performance.now();
  const heartParticles = create3DHeartParticles(2500);
  const galaxyRings = createGalaxyRings();
  const stars = createStarfield(160);
  const bokehOrbs = createBokehOrbs(14);
  const miniHearts = createFloatingMiniHearts(28);
  const orbitPhotos = createOrbitPhotos(cfg.orbitPhotoCount);
  const fallingPhotos = Array.from({ length: cfg.fallingPhotoCount }, () => createFallingPhoto(true));

  const bursts = [];
  const shockwaves = [];
  const meteors = [];
  const renderQueue = [];
  let clickableCards = [];
  let nextMeteorTime = 1.6;
  let lastBeatPulse = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const minDim = Math.min(width, height);
    unitScale = Math.max(94, Math.min(188, minDim * 0.225));
    focalLength = Math.max(640, minDim * 1.48);
  }
  resize();
  window.addEventListener('resize', resize);

  function project3D(wx, wy, wz, cosY, sinY, cosX, sinX) {
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;
    const y2 = wy * cosX - z1 * sinX;
    const z2 = wy * sinX + z1 * cosX;

    const camDist = 5.25 / zoom;
    const pz = z2 + camDist;
    if (pz <= 0.35) return null;

    const scale = (focalLength / (pz * unitScale)) * (unitScale / 145);
    const sx = width * 0.5 + x1 * unitScale * scale;
    const sy = height * 0.5 + y2 * unitScale * scale;
    return { sx, sy, z: pz, scale };
  }

  function spawnMeteor() {
    const fromLeft = Math.random() < 0.55;
    meteors.push({
      x: fromLeft ? rand(-40, width * 0.55) : rand(width * 0.45, width + 40),
      y: rand(-20, height * 0.38),
      vx: (fromLeft ? 1 : -1) * rand(520, 880),
      vy: rand(220, 420),
      len: rand(90, 170),
      life: 0,
      maxLife: rand(0.65, 1.15),
      color: pick(['#fff4fa', '#ffc2e5', '#ffe8a8']),
    });
  }

  function spawnTapBurst(x, y, count = 24) {
    shockwaves.push({ x, y, r: 10, maxR: 155, life: 0, maxLife: 0.78, color: '255, 130, 204' });
    shockwaves.push({ x, y, r: 4, maxR: 105, life: 0, maxLife: 0.56, color: '255, 224, 150' });
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + rand(-0.24, 0.24);
      const sp = rand(80, 290);
      bursts.push({
        kind: i % 3 === 0 ? 'star' : 'heart',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(28, 105),
        gravity: 165,
        drag: 0.962,
        size: i % 3 === 0 ? rand(5, 11) : rand(9, 22),
        rot: rand(-0.5, 0.5),
        rotSpeed: rand(-3.2, 3.2),
        color: pick(HEART_COLORS),
        life: 0,
        maxLife: rand(0.9, 1.65),
      });
    }
  }

  function triggerHeartSupernova() {
    supernovaBoost = 1.0;
    const cx = width * 0.5;
    const cy = height * 0.5;
    shockwaves.push({ x: cx, y: cy, r: 22, maxR: Math.max(width, height) * 0.65, life: 0, maxLife: 1.25, color: '255, 112, 198' });
    shockwaves.push({ x: cx, y: cy, r: 12, maxR: Math.max(width, height) * 0.45, life: 0, maxLife: 0.95, color: '255, 228, 152' });
    spawnTapBurst(cx, cy, 48);
    spawnMeteor();
    setTimeout(spawnMeteor, 220);
    if (navigator.vibrate) navigator.vibrate([22, 30, 35]);
  }

  burstTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    music.tryAutoStart();
    triggerHeartSupernova();
  });

  // ============================================================
  // 5. TƯƠNG TÁC 5D (XOAY 360°, VỆT SAO CHỔI KHI KÉO, ZOOM, MỞ ẢNH)
  // ============================================================
  let hasInteracted = false;
  let isDragging = false;
  let dragMoved = 0;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastDragSparkle = 0;
  let pinchDist = 0;
  const activePointers = new Map();

  function markInteracted() {
    if (!hasInteracted) {
      hasInteracted = true;
      gestureHint.classList.add('is-hidden');
      music.tryAutoStart();
    }
  }

  setTimeout(() => {
    gestureHint.classList.add('is-hidden');
  }, 7000);

  canvas.addEventListener('pointerdown', (e) => {
    markInteracted();
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
        targetZoom = Math.max(0.68, Math.min(1.68, targetZoom * (dist / pinchDist)));
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
      camRotX = Math.max(-0.88, Math.min(0.88, camRotX + dy * 0.0055));
      velY = dx * 0.0046;
      velX = dy * 0.0036;

      // Vệt kim tuyến sao chổi đi theo ngón tay khi kéo xoay 360°
      const now = performance.now();
      if (now - lastDragSparkle > 24 && bursts.length < 240) {
        lastDragSparkle = now;
        bursts.push({
          kind: Math.random() < 0.45 ? 'star' : 'heart',
          x: e.clientX + rand(-6, 6),
          y: e.clientY + rand(-6, 6),
          vx: rand(-22, 22),
          vy: rand(-35, 10),
          gravity: 20,
          drag: 0.96,
          size: rand(5, 11),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-2, 2),
          color: pick(HEART_COLORS),
          life: 0,
          maxLife: rand(0.55, 0.95),
        });
      }
    } else if (e.pointerType === 'mouse') {
      targetParallaxX = (e.clientX / width - 0.5) * 0.25;
      targetParallaxY = (e.clientY / height - 0.5) * 0.18;
    }
  });

  function onPointerRelease(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchDist = 0;

    if (isDragging && activePointers.size === 0) {
      isDragging = false;
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
        spawnTapBurst(downX, downY, 26);
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

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      targetZoom = Math.max(0.68, Math.min(1.68, targetZoom - e.deltaY * 0.0008));
    },
    { passive: false }
  );

  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (typeof e.gamma === 'number' && typeof e.beta === 'number') {
        targetParallaxX = Math.max(-0.28, Math.min(0.28, (e.gamma / 45) * 0.25));
        targetParallaxY = Math.max(-0.22, Math.min(0.22, ((e.beta - 45) / 45) * 0.18));
      }
    },
    { passive: true }
  );

  photoModal.addEventListener('click', () => {
    photoModal.hidden = true;
  });

  // ============================================================
  // 6. VẼ DẢI CỰC QUANG HỒNG TÍM CHUYỂN ĐỘNG DỊU NHẸ
  // ============================================================
  function drawAuroraBackdrop(t, beat) {
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      10,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.9
    );
    bgGrad.addColorStop(0, '#360b42');
    bgGrad.addColorStop(0.35, '#190624');
    bgGrad.addColorStop(0.72, '#0c0214');
    bgGrad.addColorStop(1, '#040109');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2 dải cực quang mềm uốn lượn phía sau bầu trời
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const ax1 = width * (0.28 + 0.12 * Math.sin(t * 0.28));
    const ay1 = height * (0.24 + 0.08 * Math.cos(t * 0.22));
    const g1 = ctx.createRadialGradient(ax1, ay1, 10, ax1, ay1, Math.max(width, height) * 0.52);
    g1.addColorStop(0, 'rgba(255, 62, 168, 0.16)');
    g1.addColorStop(0.5, 'rgba(168, 52, 245, 0.08)');
    g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    const ax2 = width * (0.74 + 0.1 * Math.cos(t * 0.25));
    const ay2 = height * (0.76 + 0.08 * Math.sin(t * 0.2));
    const g2 = ctx.createRadialGradient(ax2, ay2, 10, ax2, ay2, Math.max(width, height) * 0.48);
    g2.addColorStop(0, 'rgba(255, 168, 118, 0.11)');
    g2.addColorStop(0.5, 'rgba(255, 56, 152, 0.09)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);

    // Hào quang hồng ở tâm thở theo nhịp tim + bùng nổ Supernova
    const nebR = unitScale * (2.8 + beat * 0.42 + supernovaBoost * 1.4);
    const neb = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, nebR);
    neb.addColorStop(0, `rgba(255, 76, 166, ${0.26 + beat * 0.12 + supernovaBoost * 0.2})`);
    neb.addColorStop(0.45, `rgba(196, 46, 186, ${0.11 + supernovaBoost * 0.08})`);
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  // ============================================================
  // 7. VÒNG LẶP KẾT XUẤT 5D 60FPS
  // ============================================================
  let elapsed = 0;
  let lastTime = performance.now();

  // Vẽ đường viền dải sáng 3D mượt chạy dọc 2 vòng thiên hà
  function drawGalaxyRibbonLines(cosY, sinY, cosX, sinX, ringIntro) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let rIdx = 0; rIdx < galaxyRings.length; rIdx += 1) {
      const ring = galaxyRings[rIdx];
      const cxT = Math.cos(ring.tiltX);
      const sxT = Math.sin(ring.tiltX);
      const czT = Math.cos(ring.tiltZ);
      const szT = Math.sin(ring.tiltZ);
      const rad = ring.radius * (0.45 + 0.55 * ringIntro);

      ctx.beginPath();
      const STEPS = 84;
      let started = false;
      for (let i = 0; i <= STEPS; i += 1) {
        const ang = (Math.PI * 2 * i) / STEPS;
        const x0 = Math.cos(ang) * rad;
        const z0 = Math.sin(ang) * rad;
        const y1 = -z0 * sxT;
        const z1 = z0 * cxT;
        const x2 = x0 * czT - y1 * szT;
        const y2 = x0 * szT + y1 * czT;
        const p = project3D(x2, y2, z1, cosY, sinY, cosX, sinX);
        if (!p) continue;
        if (!started) {
          ctx.moveTo(p.sx, p.sy);
          started = true;
        } else {
          ctx.lineTo(p.sx, p.sy);
        }
      }
      ctx.strokeStyle = `${ring.color}${0.22 * ringIntro})`;
      ctx.lineWidth = rIdx === 0 ? 2.2 : 1.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    const t = elapsed;

    supernovaBoost = Math.max(0, supernovaBoost - dt * 1.15);

    // Nhịp đập trái tim chân thực + bùng nổ
    const beatCycle = (t * 1.16) % 1;
    const beat1 = Math.exp(-Math.pow((beatCycle - 0.12) / 0.072, 2));
    const beat2 = 0.68 * Math.exp(-Math.pow((beatCycle - 0.3) / 0.088, 2));
    const beat = beat1 + beat2;
    const heartPulse = 1 + beat * 0.095 + supernovaBoost * 0.18;

    if (beat1 > 0.92 && t - lastBeatPulse > 0.72) {
      lastBeatPulse = t;
      shockwaves.push({
        x: width * 0.5,
        y: height * 0.5,
        r: unitScale * 0.62,
        maxR: unitScale * 2.55,
        life: 0,
        maxLife: 1.25,
        color: '255, 128, 206',
      });
    }

    // Tự động bắn sao băng ngẫu nhiên
    if (elapsed > nextMeteorTime) {
      spawnMeteor();
      nextMeteorTime = elapsed + rand(2.2, 4.8);
    }

    // Xoay camera 360° + quán tính + thị sai 5D
    if (!isDragging) {
      camRotY += cfg.autoRotateSpeed * dt + velY;
      camRotX = Math.max(-0.88, Math.min(0.88, camRotX + velX));
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

    // 1. Nền vũ trụ + cực quang chuyển động
    drawAuroraBackdrop(t, beat);

    // 2. Các đốm bokeh mờ điện ảnh
    for (let i = 0; i < bokehOrbs.length; i += 1) {
      const b = bokehOrbs[i];
      b.nx = (b.nx + (b.vx * dt) / width + 1) % 1;
      b.ny = (b.ny + (b.vy * dt) / height + 1) % 1;
      const bx = b.nx * width;
      const by = b.ny * height;
      const r = b.r * (0.88 + 0.16 * Math.sin(t * 1.1 + b.phase));
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0, b.color);
      bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Sao nền lấp lánh
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const sx = (s.nx * width - parallaxX * 160 * s.depth + width) % width;
      const sy = (s.ny * height - parallaxY * 160 * s.depth + height) % height;
      const alpha = 0.24 + 0.72 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Sao băng lướt ngang bầu trời
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const m = meteors[i];
      m.life += dt;
      if (m.life >= m.maxLife) {
        meteors.splice(i, 1);
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const prog = m.life / m.maxLife;
      const alpha = prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) / 0.8;
      const spd = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / spd) * m.len;
      const ty = m.y - (m.vy / spd) * m.len;

      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255, 245, 252, ${alpha})`);
      grad.addColorStop(0.35, `rgba(255, 146, 214, ${alpha * 0.65})`);
      grad.addColorStop(1, 'rgba(255, 120, 200, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      drawStarGlint(ctx, m.x, m.y, 7, '#ffffff', alpha, t * 4);
    }
    ctx.restore();

    // 5. Xây hàng đợi Z-sort 3D thống nhất
    renderQueue.length = 0;

    // 5a. Lõi phát sáng trung tâm
    const coreProj = project3D(0, 0, 0, cosY, sinY, cosX, sinX);
    if (coreProj) {
      renderQueue.push({ type: 'core', z: coreProj.z, proj: coreProj });
    }

    // 5b. 2.500 hạt trái tim 3D (mở màn xoáy hội tụ nhanh sắc nét trong 0.95 giây!)
    const heartTiltY = Math.sin(t * 0.55) * 0.16;
    const hCos = Math.cos(heartTiltY);
    const hSin = Math.sin(heartTiltY);

    for (let i = 0; i < heartParticles.length; i += 1) {
      const p = heartParticles[i];
      const rawIntro = Math.max(0, Math.min(1, (elapsed - p.delay) / 0.85));
      const ease = 1 - Math.pow(1 - rawIntro, 3);

      const scale = heartPulse * (p.isAura ? 1 + 0.05 * Math.sin(t * 2.2 + p.twinklePhase) : 1);
      const tx = (p.bx * hCos - p.bz * hSin) * scale;
      const tz = (p.bx * hSin + p.bz * hCos) * scale;
      const ty = p.by * scale;

      const wx = p.sx0 + (tx - p.sx0) * ease;
      const wy = p.sy0 + (ty - p.sy0) * ease;
      const wz = p.sz0 + (tz - p.sz0) * ease;

      const proj = project3D(wx, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'heartBloom', z: proj.z, proj, p, ease });
    }

    // 5c. Hai vòng năng lượng thiên hà 3D nghiêng đan chéo quanh trái tim
    const ringIntro = Math.min(1, elapsed / 0.85);
    drawGalaxyRibbonLines(cosY, sinY, cosX, sinX, ringIntro);
    for (let rIdx = 0; rIdx < galaxyRings.length; rIdx += 1) {
      const ring = galaxyRings[rIdx];
      const cxT = Math.cos(ring.tiltX);
      const sxT = Math.sin(ring.tiltX);
      const czT = Math.cos(ring.tiltZ);
      const szT = Math.sin(ring.tiltZ);

      for (let i = 0; i < ring.particles.length; i += 1) {
        const rp = ring.particles[i];
        const ang = rp.angle + t * ring.speed;
        const rad = (ring.radius + rp.radOffset) * (0.45 + 0.55 * ringIntro);
        const x0 = Math.cos(ang) * rad;
        const z0 = Math.sin(ang) * rad;
        const y0 = rp.yOffset;

        // Xoay nghiêng mặt phẳng vòng 3D
        const y1 = y0 * cxT - z0 * sxT;
        const z1 = y0 * sxT + z0 * cxT;
        const x2 = x0 * czT - y1 * szT;
        const y2 = x0 * szT + y1 * czT;

        const proj = project3D(x2, y2, z1, cosY, sinY, cosX, sinX);
        if (!proj) continue;
        renderQueue.push({ type: 'ringBloom', z: proj.z, proj, rp, glow: ring.glow });
      }
    }

    // 5d. Trái tim mini 3D bay lơ lửng khắp không gian
    for (let i = 0; i < miniHearts.length; i += 1) {
      const mh = miniHearts[i];
      mh.y += mh.vy * dt;
      mh.rot += mh.rotSpeed * dt;
      if (mh.y < -3.8) {
        mh.y = 3.8;
        mh.x = rand(-3.4, 3.4);
      }
      const wx = mh.x + Math.sin(t * 0.9 + mh.swayPhase) * mh.swayAmp;
      const proj = project3D(wx, mh.y, mh.z, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'miniHeart', z: proj.z, proj, mh });
    }

    // 5e. Toàn bộ ảnh xoay quanh trái tim kèm vệt bụi sao 5D
    const orbitSpeed = 0.44;
    const orbitTilt = 0.25;
    const oCos = Math.cos(orbitTilt);
    const oSin = Math.sin(orbitTilt);
    const photoBloom = Math.min(1, Math.max(0, (elapsed - 0.15) / 0.75));
    const photoEase = 1 - Math.pow(1 - photoBloom, 3);

    for (let i = 0; i < orbitPhotos.length; i += 1) {
      const item = orbitPhotos[i];
      const ang = item.baseAngle + t * orbitSpeed;
      const rad = item.radiusMul * (0.3 + 0.7 * photoEase);
      const ox = Math.cos(ang) * rad;
      const oz = Math.sin(ang) * rad;
      const oy = (item.yOffset || 0) + Math.sin(t * 1.45 + item.yBobPhase) * item.yBobAmp;

      const wy = oy * oCos - oz * oSin;
      const wz = oy * oSin + oz * oCos;

      const proj = project3D(ox, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;

      // Nhả vệt bụi kim tuyến phía sau mỗi tấm ảnh đang xoay
      item.trailTimer += dt;
      if (item.trailTimer > 0.22 && bursts.length < 220 && photoEase > 0.8) {
        item.trailTimer = 0;
        bursts.push({
          kind: 'star',
          x: proj.sx + rand(-14, 14),
          y: proj.sy + rand(-14, 14),
          vx: rand(-14, 14),
          vy: rand(-14, 14),
          gravity: 4,
          drag: 0.96,
          size: rand(3.5, 7.5),
          rot: rand(0, Math.PI),
          rotSpeed: rand(-2, 2),
          color: pick(['#ffe6a8', '#ffb8e2', '#ffffff']),
          life: 0,
          maxLife: rand(0.45, 0.85),
        });
      }

      renderQueue.push({
        type: 'orbitPhoto',
        z: proj.z,
        proj,
        photo: loadedPhotos[item.photoIndex],
        tilt: Math.sin(t * 1.2 + item.tiltPhase) * 0.085,
        yawCos: 0.78 + 0.22 * Math.cos(ang + viewY),
        alphaMul: photoEase,
      });
    }

    // 5f. Dòng ảnh rơi 5D từ trên xuống dưới kèm vệt sao
    for (let i = 0; i < fallingPhotos.length; i += 1) {
      const f = fallingPhotos[i];
      f.y += f.vy * dt;
      f.spinPhase += f.spinSpeed * dt;
      f.trailTimer += dt;

      if (f.y > 4.0) {
        fallingPhotos[i] = createFallingPhoto(false);
        continue;
      }

      const wx = f.x + Math.sin(t * f.swayFreq + f.swayPhase) * f.swayAmp;
      const worldProj = project3D(wx, f.y, f.z, cosY, sinY, cosX, sinX);
      if (!worldProj) continue;

      if (f.trailTimer > 0.26 && bursts.length < 220) {
        f.trailTimer = 0;
        bursts.push({
          kind: Math.random() < 0.55 ? 'star' : 'heart',
          x: worldProj.sx + rand(-14, 14),
          y: worldProj.sy - 14,
          vx: rand(-12, 12),
          vy: rand(-26, -6),
          gravity: 10,
          drag: 0.98,
          size: rand(4, 9),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-1.5, 1.5),
          color: pick(HEART_COLORS),
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

    // Sắp xếp xa -> gần cho chiều sâu 3D/5D thật
    renderQueue.sort((a, b) => b.z - a.z);
    clickableCards = [];
    let additiveOn = false;

    for (let i = 0; i < renderQueue.length; i += 1) {
      const node = renderQueue[i];
      const { sx, sy, scale, z } = node.proj;
      const needsAdditive =
        node.type === 'core' || node.type === 'heartBloom' || node.type === 'ringBloom';

      if (needsAdditive !== additiveOn) {
        additiveOn = needsAdditive;
        ctx.globalCompositeOperation = additiveOn ? 'lighter' : 'source-over';
        ctx.globalAlpha = 1;
      }

      if (node.type === 'core') {
        const coreR = unitScale * (1.28 + supernovaBoost * 0.5) * scale * heartPulse;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
        g.addColorStop(0, `rgba(255, 224, 244, ${0.42 + beat * 0.2 + supernovaBoost * 0.25})`);
        g.addColorStop(0.32, `rgba(255, 58, 154, ${0.28 + beat * 0.14})`);
        g.addColorStop(0.7, 'rgba(190, 42, 185, 0.08)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.type === 'heartBloom') {
        const p = node.p;
        const depthAlpha = Math.max(0.24, Math.min(1, 1.5 - z * 0.115));
        const tw = 0.6 + 0.4 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        const s = Math.max(3, p.size * scale * 0.82 * (p.isRim ? 1.08 : 0.94));

        ctx.globalAlpha = depthAlpha * tw * (p.isAura ? 0.6 : 0.92) * Math.min(1, node.ease * 1.4);
        ctx.drawImage(p.sprite, sx - s, sy - s, s * 2, s * 2);
        if (p.sparkle && s > 4.5) {
          drawStarGlint(ctx, sx, sy, s * 1.05, '#ffffff', depthAlpha * tw * 0.9, t * 1.5 + p.twinklePhase);
        }
      } else if (node.type === 'ringBloom') {
        const rp = node.rp;
        const depthAlpha = Math.max(0.16, Math.min(0.95, 1.4 - z * 0.11));
        const tw = 0.55 + 0.45 * Math.sin(t * 3.4 + rp.phase);
        const s = Math.max(2.6, rp.size * scale * 0.72 * (rp.bright ? 1.35 : 0.9));

        ctx.globalAlpha = depthAlpha * tw * (rp.bright ? 0.95 : 0.62);
        ctx.drawImage(node.glow, sx - s, sy - s, s * 2, s * 2);
      } else if (node.type === 'miniHeart') {
        const mh = node.mh;
        const depthAlpha = Math.max(0.18, Math.min(0.88, 1.4 - z * 0.12)) * mh.alpha;
        drawMiniHeart(ctx, sx, sy, mh.size * scale * 0.72, mh.color, depthAlpha, mh.rot);
      } else if (node.type === 'orbitPhoto') {
        const cardW = unitScale * 0.68 * scale;
        const cardH = cardW * (318 / 268);
        const depthAlpha = Math.max(0.4, Math.min(1, 1.58 - z * 0.13)) * node.alphaMul;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(node.tilt);
        ctx.scale(node.yawCos, 1);
        ctx.globalAlpha = depthAlpha;
        ctx.drawImage(node.photo.card, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();

        clickableCards.push({ x: sx, y: sy, w: cardW * node.yawCos, h: cardH, src: node.photo.src });
      } else if (node.type === 'fallingPhoto') {
        const cardW = unitScale * 0.58 * scale * node.scaleMul;
        const cardH = cardW * (318 / 268);
        let fadeEdge = 1;
        if (node.yWorld < -2.7) fadeEdge = Math.max(0, (node.yWorld + 4.0) / 1.3);
        else if (node.yWorld > 2.7) fadeEdge = Math.max(0, (4.0 - node.yWorld) / 1.3);
        const depthAlpha = Math.max(0.24, Math.min(0.96, 1.48 - z * 0.12)) * fadeEdge;

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
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // 6. Vòng sóng năng lượng phát sáng
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const wv = shockwaves[i];
      wv.life += dt;
      if (wv.life >= wv.maxLife) {
        shockwaves.splice(i, 1);
        continue;
      }
      const p = wv.life / wv.maxLife;
      const curR = wv.r + (wv.maxR - wv.r) * (1 - Math.pow(1 - p, 3));
      ctx.strokeStyle = `rgba(${wv.color}, ${(1 - p) * 0.55})`;
      ctx.lineWidth = Math.max(1, 3.2 * (1 - p));
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, curR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Pháo hoa trái tim & sao chổi kim tuyến
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
      const alpha = prog < 0.14 ? prog / 0.14 : 1 - (prog - 0.14) / 0.86;
      if (b.kind === 'star') {
        drawStarGlint(ctx, b.x, b.y, b.size, b.color, alpha, b.rot);
      } else {
        drawMiniHeart(ctx, b.x, b.y, b.size, b.color, alpha, b.rot);
      }
    }
    ctx.restore();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
