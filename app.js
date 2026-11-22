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
  const themeTrigger = document.getElementById('themeTrigger');
  const customAudio = document.getElementById('customAudio');
  const gestureHint = document.getElementById('gestureHint');
  const photoModal = document.getElementById('photoModal');
  const photoModalImg = document.getElementById('photoModalImg');

  // ============================================================
  // 1. NHẠC NỀN LÃNG MẠN ĐA LỚP (SYNTH PAD + PIANO + HỘP NHẠC / MP3)
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

      this.sequence = [
        { pad: [261.63, 329.63, 392.0, 493.88], bass: 130.81, lead: 659.25, arp: 523.25 },
        { lead: 783.99, arp: 392.0 },
        { lead: 1046.5, arp: 493.88 },
        { bass: 130.81, lead: 987.77, arp: 392.0 },
        { lead: 783.99, arp: 523.25 },
        { lead: 659.25, arp: 493.88 },
        { pad: [246.94, 293.66, 392.0, 493.88], bass: 164.81, lead: 783.99, arp: 392.0 },
        { lead: 987.77, arp: 493.88 },
        { lead: 1174.66, arp: 587.33 },
        { bass: 164.81, lead: 1046.5, arp: 493.88 },
        { lead: 987.77, arp: 392.0 },
        { lead: 783.99, arp: 493.88 },
        { pad: [220.0, 261.63, 329.63, 392.0], bass: 110.0, lead: 880.0, arp: 329.63 },
        { lead: 783.99, arp: 392.0 },
        { lead: 659.25, arp: 523.25 },
        { bass: 110.0, lead: 587.33, arp: 392.0 },
        { lead: 523.25, arp: 329.63 },
        { lead: 659.25, arp: 392.0 },
        { pad: [174.61, 220.0, 261.63, 329.63], bass: 87.31, lead: 698.46, arp: 349.23 },
        { lead: 880.0, arp: 440.0 },
        { lead: 1046.5, arp: 523.25 },
        { bass: 87.31, lead: 880.0, arp: 440.0 },
        { lead: 783.99, arp: 349.23 },
        { lead: 659.25, arp: 440.0 },
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
        if (e.target && e.target.closest && e.target.closest('.hud-bar')) return;
        music.tryAutoStart();
      },
      { passive: true }
    );
  });

  // ============================================================
  // 2. BỘ MÀU HOLOGRAM (XANH BĂNG NHƯ VIDEO / HỒNG PHA LÊ / TỰ ĐỔI)
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

  const PALETTES = {
    // Tông xanh dương - băng sáng hologram giống video mẫu
    blue: {
      bgCenter: '#0d1e46',
      bgMid: '#050c22',
      bgEdge: '#01030a',
      aurora1: 'rgba(42, 168, 255, 0.16)',
      aurora2: 'rgba(110, 88, 255, 0.13)',
      coreRgb: '78, 198, 255',
      coreInner: '230, 248, 255',
      discInner: '215, 246, 255',
      discMid: '56, 178, 255',
      discOuter: '37, 99, 235',
      streakRgb: '115, 212, 255',
      ring1: 'rgba(92, 206, 255, ',
      ring2: 'rgba(182, 148, 255, ',
      sprites: [
        makeGlowSprite('#ffffff', '#67d8ff', 'rgba(37, 138, 255, 0.36)'),
        makeGlowSprite('#eefaff', '#38bdf8', 'rgba(29, 78, 216, 0.34)'),
        makeGlowSprite('#f5f3ff', '#93c5fd', 'rgba(99, 102, 241, 0.32)'),
        makeGlowSprite('#ffffff', '#a5f3fc', 'rgba(56, 189, 248, 0.35)'),
      ],
      heartColors: ['#7dd3fc', '#38bdf8', '#a5f3fc', '#93c5fd', '#c4b5fd', '#ffffff'],
    },
    // Tông hồng pha lê cực quang lãng mạn
    pink: {
      bgCenter: '#340b42',
      bgMid: '#170524',
      bgEdge: '#05010a',
      aurora1: 'rgba(255, 68, 172, 0.17)',
      aurora2: 'rgba(255, 176, 122, 0.12)',
      coreRgb: '255, 82, 174',
      coreInner: '255, 232, 246',
      discInner: '255, 224, 244',
      discMid: '255, 84, 176',
      discOuter: '198, 42, 158',
      streakRgb: '255, 148, 216',
      ring1: 'rgba(255, 118, 198, ',
      ring2: 'rgba(255, 216, 148, ',
      sprites: [
        makeGlowSprite('#ffffff', '#ff5ca8', 'rgba(255, 36, 132, 0.36)'),
        makeGlowSprite('#fff4fa', '#ff82c4', 'rgba(255, 76, 168, 0.34)'),
        makeGlowSprite('#fff0ff', '#d97aff', 'rgba(186, 62, 255, 0.30)'),
        makeGlowSprite('#ffffff', '#ffe08a', 'rgba(255, 180, 90, 0.34)'),
      ],
      heartColors: ['#ff4da6', '#ff80c0', '#ffb8e0', '#e085ff', '#ffe299', '#ffffff'],
    },
  };

  // 0: Tự chuyển Xanh Hologram <-> Hồng Pha Lê | 1: Khóa Xanh Hologram | 2: Khóa Hồng Pha Lê
  let themeMode = 0;
  function getActivePalette(t) {
    if (themeMode === 1) return PALETTES.blue;
    if (themeMode === 2) return PALETTES.pink;
    // Bắt đầu bằng tông Xanh Hologram đúng chất video, sau mỗi chu kỳ 20s tự chuyển sang Hồng Pha Lê rồi quay lại!
    return Math.floor(t / 20) % 2 === 0 ? PALETTES.blue : PALETTES.pink;
  }

  themeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    themeMode = (themeMode + 1) % 3;
    themeTrigger.textContent = themeMode === 1 ? '💙' : themeMode === 2 ? '💖' : '💎';
    spawnTapBurst(width * 0.5, height * 0.5, 28);
  });

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
    bg.addColorStop(0, '#58c8ff');
    bg.addColorStop(1, '#d84ea8');
    drawRoundedRect(g, 18, 18, 228, 280, 24);
    g.fillStyle = bg;
    g.fill();
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

    g.save();
    g.shadowColor = 'rgba(130, 200, 255, 0.85)';
    g.shadowBlur = 22;
    drawRoundedRect(g, PAD, PAD, W - PAD * 2, H - PAD * 2, 22);
    const borderGrad = g.createLinearGradient(PAD, PAD, W - PAD, H - PAD);
    borderGrad.addColorStop(0, '#eefaff');
    borderGrad.addColorStop(0.35, '#8ee0ff');
    borderGrad.addColorStop(0.7, '#ff9cd6');
    borderGrad.addColorStop(1, '#fff0f8');
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

    const sheen = g.createLinearGradient(ix, iy, ix + iw * 0.85, iy + ih * 0.65);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
    sheen.addColorStop(0.4, 'rgba(190, 236, 255, 0.06)');
    sheen.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(ix, iy, iw, ih);
    g.restore();

    drawStarGlint(g, PAD + 6, PAD + 8, 9, '#ffffff', 0.95);
    drawStarGlint(g, W - PAD - 6, H - PAD - 8, 7, '#a5f3fc', 0.9);
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
  // 4. ĐỘNG CƠ HOLOGRAM 5D (Y HỆT VIDEO + ẢNH XOAY + ẢNH RƠI 5D)
  // ============================================================
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
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

  const PEDESTAL_Y = 1.18; // Đĩa bệ ánh sáng hologram nằm ngay dưới mũi trái tim, cân đẹp cả laptop & điện thoại

  // Tạo 2.400 hạt trái tim 3D với đầy đủ tọa độ cho 3 pha:
  // (1) Đổ thác xuống đĩa bệ -> (2) Cột ánh sáng bốc lên kết tinh trái tim -> (3) Dòng xoáy cực quang & pháo hoa bồ công anh!
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

    // 4 tâm pháo hoa bồ công anh (dandelion star-bursts giống 00:13-00:16 trong video!)
    const bloomCenters = [
      [-0.46, -0.62, 0.05],
      [0.46, -0.62, -0.05],
      [0.0, -0.28, 0.15],
      [0.0, 0.22, -0.08],
    ];

    const list = [];
    const rimCount = Math.floor(count * 0.42);
    const auraStart = Math.floor(count * 0.88);

    for (let i = 0; i < count; i += 1) {
      const [hx, hy] = sampleRim();
      const isRim = i < rimCount;
      const isAura = i >= auraStart;

      let r;
      let z;
      let jitter;
      if (isRim) {
        r = rand(0.95, 1.02);
        z = rand(-0.15, 0.15);
        jitter = 0.008;
      } else if (isAura) {
        r = rand(1.03, 1.22);
        z = rand(-0.34, 0.34);
        jitter = 0.04;
      } else {
        r = Math.pow(Math.random(), 0.44);
        const dome = Math.sqrt(Math.max(0, 1 - r * r)) * 0.56;
        z = (Math.random() < 0.5 ? 1 : -1) * dome * rand(0.84, 1.04);
        jitter = 0.016;
      }

      // Nâng tim lên (-0.30) để bay lơ lửng cực đẹp phía trên bệ ánh sáng PEDESTAL_Y
      const bx = hx * r * 0.94 + rand(-jitter, jitter);
      const by = hy * r * 0.94 - 0.30 + rand(-jitter, jitter);
      const bz = z * 0.94;

      // Vị trí nằm trải trên đĩa bệ ánh sáng (Pha 1: 00:02 trong video)
      const discAng = rand(0, Math.PI * 2);
      const discRad = Math.sqrt(Math.random()) * 1.18;
      const dx0 = Math.cos(discAng) * discRad;
      const dz0 = Math.sin(discAng) * discRad;

      // Nhánh xoáy dòng chảy plasma (Pha 3: 00:10-00:15 trong video)
      const streamBranch = i % 3;
      const bc = bloomCenters[i % bloomCenters.length];
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const bloomR = rand(0.18, 0.62);

      list.push({
        bx,
        by,
        bz,
        dx0,
        dz0,
        pillarRad: rand(0.12, 0.56),
        pillarAng: discAng,
        riseDelay: rand(0, 0.38),
        // Mục tiêu bung pháo hoa bồ công anh 3D
        fx: bc[0] + Math.sin(phi) * Math.cos(theta) * bloomR,
        fy: bc[1] + Math.cos(phi) * bloomR,
        fz: bc[2] + Math.sin(phi) * Math.sin(theta) * bloomR,
        streamBranch,
        streamPhase: rand(0, Math.PI * 2),
        streamSpeed: rand(1.6, 3.2),
        spriteIdx: i % 4,
        size: isRim ? rand(2.9, 5.6) : isAura ? rand(2.5, 4.8) : rand(2.7, 5.2),
        twinklePhase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(2.4, 5.8),
        sparkle: isRim ? Math.random() < 0.12 : Math.random() < 0.05,
        isRim,
        isAura,
        prevSx: null,
        prevSy: null,
      });
    }
    return list;
  }

  // Các hạt ánh sáng xoáy liên tục trên đĩa bệ hologram phía dưới tim & bốc lên cột sáng
  function createPedestalParticles(count) {
    return Array.from({ length: count }, (_, i) => ({
      angle: rand(0, Math.PI * 2),
      radius: Math.sqrt(Math.random()) * 1.12,
      speed: rand(0.5, 1.4) * (i % 2 === 0 ? 1 : -0.6),
      rise: Math.random() < 0.34,
      riseProg: rand(0, 1),
      riseSpeed: rand(0.28, 0.68),
      size: rand(2.2, 5.0),
      spriteIdx: i % 4,
      phase: rand(0, Math.PI * 2),
    }));
  }

  // Hai vòng thiên hà 3D xoay quanh trái tim
  function createGalaxyRings() {
    const rings = [
      { radius: 1.82, tiltX: 0.34, tiltZ: -0.2, speed: 0.52, count: 120 },
      { radius: 2.46, tiltX: -0.26, tiltZ: 0.24, speed: -0.36, count: 130 },
    ];
    rings.forEach((ring) => {
      ring.particles = [];
      for (let i = 0; i < ring.count; i += 1) {
        ring.particles.push({
          angle: (Math.PI * 2 * i) / ring.count + rand(-0.08, 0.08),
          radOffset: rand(-0.12, 0.12),
          yOffset: rand(-0.07, 0.07),
          size: rand(3.0, 6.8),
          phase: rand(0, Math.PI * 2),
          bright: Math.random() < 0.16,
        });
      }
    });
    return rings;
  }

  function createStarfield(count) {
    return Array.from({ length: count }, () => ({
      nx: rand(0, 1),
      ny: rand(0, 1),
      depth: rand(0.18, 1.0),
      r: rand(0.7, 2.2),
      phase: rand(0, Math.PI * 2),
      speed: rand(1.4, 4.0),
      color: pick(['#ffffff', '#d6f4ff', '#ffd6ec', '#c4b5fd', '#fff0c2']),
    }));
  }

  function createFloatingMiniHearts(count) {
    return Array.from({ length: count }, () => ({
      x: rand(-3.5, 3.5),
      y: rand(-3.5, 3.5),
      z: rand(-2.8, 2.2),
      vy: rand(-0.32, -0.14),
      swayAmp: rand(0.15, 0.38),
      swayPhase: rand(0, Math.PI * 2),
      size: rand(7, 15),
      rot: rand(-0.4, 0.4),
      rotSpeed: rand(-0.8, 0.8),
      colorIdx: (Math.random() * 6) | 0,
      alpha: rand(0.32, 0.78),
    }));
  }

  // 11 ảnh xoay quanh trái tim (quỹ đạo rộng thoáng để lộ trọn bệ ánh sáng & trái tim 3D!)
  function createOrbitPhotos(count) {
    const list = [];
    const baseRadius = count >= 10 ? 2.38 : 2.16;
    for (let i = 0; i < count; i += 1) {
      list.push({
        photoIndex: i % loadedPhotos.length,
        baseAngle: (Math.PI * 2 * i) / count,
        radiusMul: baseRadius + (i % 2 === 0 ? 0.12 : -0.1),
        yOffset: (i % 2 === 0 ? 0.24 : -0.24) - 0.1,
        yBobAmp: rand(0.08, 0.14),
        yBobPhase: rand(0, Math.PI * 2),
        tiltPhase: rand(0, Math.PI * 2),
        trailTimer: rand(0, 0.2),
      });
    }
    return list;
  }

  // Dòng ảnh rơi 5D từ trên xuống dưới
  function createFallingPhoto(randomY) {
    const layer = Math.random();
    const zDepth = layer < 0.44 ? rand(-3.0, -1.4) : layer < 0.82 ? rand(-1.3, 0.8) : rand(0.9, 1.9);
    return {
      photoIndex: (Math.random() * loadedPhotos.length) | 0,
      x: rand(-3.3, 3.3),
      y: randomY ? rand(-3.7, 3.7) : rand(-4.4, -3.3),
      z: zDepth,
      vy: rand(0.38, 0.76) * (zDepth > 0.6 ? 1.1 : 0.88),
      swayAmp: rand(0.24, 0.56),
      swayFreq: rand(0.6, 1.4),
      swayPhase: rand(0, Math.PI * 2),
      spinPhase: rand(0, Math.PI * 2),
      spinSpeed: rand(0.75, 1.6),
      rotAmp: rand(0.14, 0.32),
      scaleMul: rand(0.45, 0.7),
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
  let camRotX = 0.24; // Góc nhìn thấy cực rõ bệ ánh sáng 3D bên dưới trái tim!
  let velY = 0;
  let velX = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let zoom = 1;
  let targetZoom = 1;

  let manualSwirlBoost = 0;
  let elapsed = parseFloat(new URLSearchParams(location.search).get('t')) || 0;
  let lastTime = performance.now();
  let nextMeteorTime = 1.8;
  let lastBeatPulse = 0;

  const heartParticles = create3DHeartParticles(2400);
  const pedestalParticles = createPedestalParticles(260);
  const galaxyRings = createGalaxyRings();
  const stars = createStarfield(160);
  const miniHearts = createFloatingMiniHearts(24);
  const orbitPhotos = createOrbitPhotos(cfg.orbitPhotoCount);
  const fallingPhotos = Array.from({ length: cfg.fallingPhotoCount }, () => createFallingPhoto(true));

  const bursts = [];
  const shockwaves = [];
  const meteors = [];
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
    unitScale = Math.max(88, Math.min(168, minDim * 0.195));
    focalLength = Math.max(620, minDim * 1.46);
  }
  resize();
  window.addEventListener('resize', resize);

  function project3D(wx, wy, wz, cosY, sinY, cosX, sinX) {
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;
    const y2 = wy * cosX - z1 * sinX;
    const z2 = wy * sinX + z1 * cosX;

    const camDist = 5.4 / zoom;
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
      y: rand(-20, height * 0.36),
      vx: (fromLeft ? 1 : -1) * rand(520, 880),
      vy: rand(220, 420),
      len: rand(95, 175),
      life: 0,
      maxLife: rand(0.65, 1.15),
    });
  }

  function spawnTapBurst(x, y, count = 24) {
    const pal = getActivePalette(elapsed);
    shockwaves.push({ x, y, r: 10, maxR: 155, life: 0, maxLife: 0.78, color: pal.coreRgb });
    shockwaves.push({ x, y, r: 4, maxR: 105, life: 0, maxLife: 0.56, color: pal.coreInner });
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
        color: pick(pal.heartColors),
        life: 0,
        maxLife: rand(0.9, 1.65),
      });
    }
  }

  function triggerVortexSupernova() {
    const pal = getActivePalette(elapsed);
    manualSwirlBoost = 1.0;
    const cx = width * 0.5;
    const cy = height * 0.48;
    shockwaves.push({ x: cx, y: cy, r: 22, maxR: Math.max(width, height) * 0.62, life: 0, maxLife: 1.25, color: pal.coreRgb });
    shockwaves.push({ x: cx, y: cy, r: 10, maxR: Math.max(width, height) * 0.42, life: 0, maxLife: 0.95, color: pal.coreInner });
    spawnTapBurst(cx, cy, 46);
    spawnMeteor();
    setTimeout(spawnMeteor, 240);
    if (navigator.vibrate) navigator.vibrate([22, 30, 35]);
  }

  burstTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    music.tryAutoStart();
    triggerVortexSupernova();
  });

  // ============================================================
  // 5. TƯƠNG TÁC 5D (XOAY 360°, VỆT SAO CHỔI, ZOOM, MỞ ẢNH)
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
  }, 7500);

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
      camRotX = Math.max(-0.85, Math.min(0.85, camRotX + dy * 0.0055));
      velY = dx * 0.0046;
      velX = dy * 0.0036;

      const now = performance.now();
      if (now - lastDragSparkle > 24 && bursts.length < 240) {
        lastDragSparkle = now;
        const pal = getActivePalette(elapsed);
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
          color: pick(pal.heartColors),
          life: 0,
          maxLife: rand(0.55, 0.95),
        });
      }
    } else if (e.pointerType === 'mouse') {
      targetParallaxX = (e.clientX / width - 0.5) * 0.25;
      targetParallaxY = (e.clientY / height - 0.5) * 0.16;
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
        targetParallaxY = Math.max(-0.2, Math.min(0.2, ((e.beta - 45) / 45) * 0.16));
      }
    },
    { passive: true }
  );

  photoModal.addEventListener('click', () => {
    photoModal.hidden = true;
  });

  // ============================================================
  // 6. VẼ NỀN CỰC QUANG, ĐĨA BỆ HOLOGRAM & VÒNG THIÊN HÀ 3D
  // ============================================================
  function drawAuroraBackdrop(t, beat, pal, energyBoost) {
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      10,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.9
    );
    bgGrad.addColorStop(0, pal.bgCenter);
    bgGrad.addColorStop(0.42, pal.bgMid);
    bgGrad.addColorStop(1, pal.bgEdge);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const ax1 = width * (0.28 + 0.12 * Math.sin(t * 0.28));
    const ay1 = height * (0.24 + 0.08 * Math.cos(t * 0.22));
    const g1 = ctx.createRadialGradient(ax1, ay1, 10, ax1, ay1, Math.max(width, height) * 0.52);
    g1.addColorStop(0, pal.aurora1);
    g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    const ax2 = width * (0.74 + 0.1 * Math.cos(t * 0.25));
    const ay2 = height * (0.76 + 0.08 * Math.sin(t * 0.2));
    const g2 = ctx.createRadialGradient(ax2, ay2, 10, ax2, ay2, Math.max(width, height) * 0.48);
    g2.addColorStop(0, pal.aurora2);
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);

    const nebR = unitScale * (2.6 + beat * 0.35 + energyBoost * 1.1);
    const neb = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, nebR);
    neb.addColorStop(0, `rgba(${pal.coreRgb}, ${0.2 + beat * 0.1 + energyBoost * 0.18})`);
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  // Đĩa bệ phóng ánh sáng hologram 3D phát sáng rực rỡ ngay dưới trái tim (giống 00:05-00:20 trong video!)
  function drawHologramPedestal(cosY, sinY, cosX, sinX, t, beat, pal, pillarGlow) {
    const center = project3D(0, PEDESTAL_Y, 0, cosY, sinY, cosX, sinX);
    if (!center) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Luồng sáng mềm dạng sương hologram hắt từ đĩa bệ lên trái tim (không có cạnh cứng)
    const midP = project3D(0, (PEDESTAL_Y - 0.35) * 0.5, 0, cosY, sinY, cosX, sinX);
    if (midP) {
      const beamRx = unitScale * 0.95 * center.scale;
      const beamRy = unitScale * 1.15 * center.scale;
      ctx.save();
      ctx.translate(midP.sx, midP.sy);
      ctx.scale(beamRx, beamRy);
      const beamGrad = ctx.createRadialGradient(0, 0.25, 0, 0, 0.1, 1);
      beamGrad.addColorStop(0, `rgba(${pal.discMid}, ${0.26 + pillarGlow * 0.22 + beat * 0.06})`);
      beamGrad.addColorStop(0.55, `rgba(${pal.discOuter}, ${0.1 + pillarGlow * 0.1})`);
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lõi đĩa ánh sáng plasma nằm ngang phát sáng rực
    const flatRatio = Math.max(0.22, Math.abs(sinX) * 0.95 + 0.12);
    const rx = unitScale * (1.22 + beat * 0.08) * center.scale;
    const ry = rx * flatRatio;

    ctx.save();
    ctx.translate(center.sx, center.sy);
    ctx.scale(1, flatRatio);
    const discGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    discGrad.addColorStop(0, `rgba(${pal.discInner}, ${0.78 + beat * 0.18})`);
    discGrad.addColorStop(0.32, `rgba(${pal.discMid}, ${0.52 + beat * 0.12})`);
    discGrad.addColorStop(0.68, `rgba(${pal.discOuter}, 0.2)`);
    discGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3 vòng sáng đồng tâm 3D thực trên bề mặt đĩa bệ
    const ringRadii = [0.46, 0.82, 1.14];
    for (let rIdx = 0; rIdx < ringRadii.length; rIdx += 1) {
      const rad = ringRadii[rIdx] * (1 + 0.03 * Math.sin(t * 2.5 - rIdx));
      ctx.beginPath();
      const STEPS = 64;
      let started = false;
      for (let i = 0; i <= STEPS; i += 1) {
        const ang = (Math.PI * 2 * i) / STEPS;
        const p = project3D(Math.cos(ang) * rad, PEDESTAL_Y, Math.sin(ang) * rad, cosY, sinY, cosX, sinX);
        if (!p) continue;
        if (!started) {
          ctx.moveTo(p.sx, p.sy);
          started = true;
        } else {
          ctx.lineTo(p.sx, p.sy);
        }
      }
      ctx.strokeStyle =
        rIdx === 0
          ? `rgba(${pal.discInner}, ${0.75 + beat * 0.2})`
          : `rgba(${pal.discMid}, ${0.5 - rIdx * 0.12})`;
      ctx.lineWidth = rIdx === 0 ? 2.4 : 1.7;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawGalaxyRibbonLines(cosY, sinY, cosX, sinX, pal, ringIntro) {
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
      const STEPS = 80;
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
      ctx.strokeStyle = `${rIdx === 0 ? pal.ring1 : pal.ring2}${0.22 * ringIntro})`;
      ctx.lineWidth = rIdx === 0 ? 2.0 : 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ============================================================
  // 7. VÒNG LẶP KẾT XUẤT 5D 60FPS (ĐẦY ĐỦ CHU KỲ BIẾN HÌNH VIDEO!)
  // ============================================================
  function render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    const t = elapsed;
    const pal = getActivePalette(t);

    manualSwirlBoost = Math.max(0, manualSwirlBoost - dt * 0.42);

    // Chu kỳ hoạt ảnh 20 giây y hệt video hi.mp4:
    // 0.0 - 0.5s  : Hạt phủ kín đĩa bệ sáng phía dưới (00:02)
    // 0.5 - 2.9s  : Cột ánh sáng xoáy bay vọt từ bệ lên kết tinh thành Trái Tim 3D (00:03-00:05)
    // 2.9 - 9.0s  : Trái Tim 3D pha lê đập nhịp tỏa sáng trên đĩa bệ (00:05-00:09)
    // 9.0 - 15.2s : Dòng xoáy cực quang uốn lượn + pháo hoa bồ công anh bùng nở (00:09-00:16)
    // 15.2 - 18.2s: Tái hội tụ mượt về Trái Tim 3D nguyên vẹn (00:16-00:20)
    // 18.2 - 20.0s: Đổ thác hạt lấp lánh nhẹ xuống đĩa bệ để lặp chu kỳ mới!
    const cycleT = t % 20.0;
    const isInitialRise = cycleT < 3.2;
    const riseProgress = smoothstep(0.35, 2.75, cycleT);
    const collapseAmount = smoothstep(18.2, 19.65, cycleT) * (1 - smoothstep(19.85, 20.0, cycleT));

    // Cường độ dòng xoáy cực quang & pháo hoa bồ công anh (00:09 -> 00:16 trong video!)
    const autoSwirl = smoothstep(9.0, 11.0, cycleT) * (1 - smoothstep(13.8, 16.4, cycleT));
    const autoBloom = smoothstep(11.6, 13.4, cycleT) * (1 - smoothstep(14.8, 16.8, cycleT));
    const swirlAmt = Math.max(autoSwirl, manualSwirlBoost);
    const bloomAmt = Math.max(autoBloom, manualSwirlBoost * 0.85);
    const pillarGlow = (isInitialRise ? 1 - Math.abs(riseProgress - 0.5) * 1.8 : 0) + collapseAmount * 0.8;

    // Nhịp đập trái tim chân thực
    const beatCycle = (t * 1.16) % 1;
    const beat1 = Math.exp(-Math.pow((beatCycle - 0.12) / 0.072, 2));
    const beat2 = 0.68 * Math.exp(-Math.pow((beatCycle - 0.3) / 0.088, 2));
    const beat = beat1 + beat2;
    const heartPulse = 1 + beat * 0.09 + manualSwirlBoost * 0.12;

    if (beat1 > 0.92 && t - lastBeatPulse > 0.72) {
      lastBeatPulse = t;
      shockwaves.push({
        x: width * 0.5,
        y: height * 0.48,
        r: unitScale * 0.6,
        maxR: unitScale * 2.45,
        life: 0,
        maxLife: 1.2,
        color: pal.coreRgb,
      });
    }

    if (elapsed > nextMeteorTime) {
      spawnMeteor();
      nextMeteorTime = elapsed + rand(2.4, 5.0);
    }

    // Xoay camera 360° + quán tính + thị sai 5D
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

    // 1. Nền vũ trụ & cực quang
    drawAuroraBackdrop(t, beat, pal, swirlAmt);

    // 2. Sao nền lấp lánh
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const sx = (s.nx * width - parallaxX * 160 * s.depth + width) % width;
      const sy = (s.ny * height - parallaxY * 160 * s.depth + height) % height;
      const alpha = 0.22 + 0.72 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Sao băng lướt ngang
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
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.35, `rgba(${pal.coreRgb}, ${alpha * 0.65})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
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

    // 4. Vẽ Đĩa Bệ Hologram 3D phát sáng + Dải sáng vòng thiên hà
    drawHologramPedestal(cosY, sinY, cosX, sinX, t, beat, pal, Math.max(0, pillarGlow));
    const ringIntro = Math.min(1, elapsed / 1.1);
    drawGalaxyRibbonLines(cosY, sinY, cosX, sinX, pal, ringIntro);

    // 5. Xây hàng đợi Z-sort 3D thống nhất
    renderQueue.length = 0;

    // 5a. Lõi phát sáng trung tâm trái tim
    const coreProj = project3D(0, -0.30, 0, cosY, sinY, cosX, sinX);
    if (coreProj) {
      renderQueue.push({ type: 'core', z: coreProj.z, proj: coreProj });
    }

    // 5b. Hạt xoáy trên đĩa bệ & cột bụi ánh sáng dâng lên thân tim
    for (let i = 0; i < pedestalParticles.length; i += 1) {
      const pp = pedestalParticles[i];
      pp.angle += pp.speed * dt;
      let px = Math.cos(pp.angle) * pp.radius;
      let pz = Math.sin(pp.angle) * pp.radius;
      let py = PEDESTAL_Y + Math.sin(t * 2 + pp.phase) * 0.03;
      let pAlpha = 0.85;

      if (pp.rise) {
        pp.riseProg = (pp.riseProg + pp.riseSpeed * dt) % 1;
        const rr = pp.radius * (0.25 + 0.55 * (1 - pp.riseProg));
        const swirl = pp.angle + pp.riseProg * 3.2;
        px = Math.cos(swirl) * rr;
        pz = Math.sin(swirl) * rr;
        py = PEDESTAL_Y - pp.riseProg * 2.15;
        pAlpha = Math.sin(pp.riseProg * Math.PI) * 0.85;
      }

      const proj = project3D(px, py, pz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({
        type: 'pedestalDot',
        z: proj.z,
        proj,
        sprite: pal.sprites[pp.spriteIdx],
        size: pp.size,
        alpha: pAlpha,
      });
    }

    // 5c. 2.400 hạt Trái Tim 3D (Đổ thác <-> Cột sáng bốc lên <-> Trái tim pha lê <-> Xoáy lửa & pháo hoa bồ công anh!)
    const heartSpin = Math.sin(t * 0.55) * 0.18;
    const hCos = Math.cos(heartSpin);
    const hSin = Math.sin(heartSpin);

    for (let i = 0; i < heartParticles.length; i += 1) {
      const p = heartParticles[i];

      // Vị trí chuẩn của trái tim pha lê 3D
      const sc = heartPulse * (p.isAura ? 1 + 0.04 * Math.sin(t * 2.2 + p.twinklePhase) : 1);
      let wx = (p.bx * hCos - p.bz * hSin) * sc;
      let wz = (p.bx * hSin + p.bz * hCos) * sc;
      let wy = p.by * sc;

      // Pha mở màn: Từ đĩa bệ dưới đáy -> bốc lên qua cột ánh sáng xoáy -> tạo hình trái tim!
      if (isInitialRise) {
        const pProg = clamp01((riseProgress - p.riseDelay * 0.55) / (1 - p.riseDelay * 0.55));
        const ease = pProg * pProg * (3 - 2 * pProg);
        const midArc = Math.sin(ease * Math.PI); // Đỉnh ở giữa khi đang bay lên qua cột sáng
        const swirlAng = p.pillarAng + (1 - ease) * 4.5 + t * 1.4;
        const colX = Math.cos(swirlAng) * p.pillarRad;
        const colZ = Math.sin(swirlAng) * p.pillarRad;

        wx = p.dx0 * (1 - ease) + wx * ease + (colX - wx) * midArc * 0.55;
        wz = p.dz0 * (1 - ease) + wz * ease + (colZ - wz) * midArc * 0.55;
        wy = PEDESTAL_Y * (1 - ease) + wy * ease;
      }

      // Pha cuối chu kỳ: Đổ thác hạt ánh sáng nhẹ xuống đĩa bệ phía dưới (00:01-00:02 trong video)
      if (collapseAmount > 0.001) {
        const drop = clamp01((collapseAmount - p.riseDelay * 0.35) / (1 - p.riseDelay * 0.35));
        const dEase = drop * drop;
        wx = wx * (1 - dEase) + p.dx0 * dEase;
        wz = wz * (1 - dEase) + p.dz0 * dEase;
        wy = wy * (1 - dEase) + PEDESTAL_Y * dEase;
      }

      // Pha cao trào (00:09-00:16 trong video): Dòng xoáy cực quang uốn lượn & Pháo hoa bồ công anh!
      if (swirlAmt > 0.005 || bloomAmt > 0.005) {
        // Sóng xoáy chất lỏng kiểu cánh lửa / cực quang cuốn quanh trái tim
        const curlAngle = (wy + 1.2) * 2.6 + t * p.streamSpeed + p.streamPhase * 0.35;
        const swirlR = swirlAmt * (0.28 + 0.34 * Math.sin(t * 2.1 + p.streamPhase));
        const wingX = Math.sin(curlAngle) * swirlR * (p.streamBranch === 0 ? 1.35 : 0.95);
        const wingZ = Math.cos(curlAngle) * swirlR * 1.1;
        const wingY = Math.sin(curlAngle * 1.4 + p.streamBranch) * swirlAmt * 0.24;

        // Kéo một phần hạt thành 4 chùm pháo hoa bồ công anh nở bung phía trên tim!
        const bFactor = bloomAmt * (p.streamBranch === 2 ? 0.95 : 0.55);
        wx = wx * (1 - bFactor) + p.fx * bFactor + wingX;
        wy = wy * (1 - bFactor) + p.fy * bFactor + wingY;
        wz = wz * (1 - bFactor) + p.fz * bFactor + wingZ;
      }

      const proj = project3D(wx, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) {
        p.prevSx = null;
        p.prevSy = null;
        continue;
      }

      const drawStreak = swirlAmt > 0.14 || (isInitialRise && riseProgress > 0.05 && riseProgress < 0.95) || collapseAmount > 0.08;
      renderQueue.push({
        type: 'heartBloom',
        z: proj.z,
        proj,
        p,
        sprite: pal.sprites[p.spriteIdx],
        drawStreak,
        prevSx: p.prevSx,
        prevSy: p.prevSy,
      });

      p.prevSx = proj.sx;
      p.prevSy = proj.sy;
    }

    // 5d. Hạt sáng chạy dọc 2 vòng thiên hà 3D
    for (let rIdx = 0; rIdx < galaxyRings.length; rIdx += 1) {
      const ring = galaxyRings[rIdx];
      const cxT = Math.cos(ring.tiltX);
      const sxT = Math.sin(ring.tiltX);
      const czT = Math.cos(ring.tiltZ);
      const szT = Math.sin(ring.tiltZ);
      const ringSprite = pal.sprites[rIdx === 0 ? 0 : 2];

      for (let i = 0; i < ring.particles.length; i += 1) {
        const rp = ring.particles[i];
        const ang = rp.angle + t * ring.speed;
        const rad = (ring.radius + rp.radOffset) * (0.45 + 0.55 * ringIntro);
        const x0 = Math.cos(ang) * rad;
        const z0 = Math.sin(ang) * rad;
        const y0 = rp.yOffset;

        const y1 = y0 * cxT - z0 * sxT;
        const z1 = y0 * sxT + z0 * cxT;
        const x2 = x0 * czT - y1 * szT;
        const y2 = x0 * szT + y1 * czT;

        const proj = project3D(x2, y2, z1, cosY, sinY, cosX, sinX);
        if (!proj) continue;
        renderQueue.push({ type: 'ringBloom', z: proj.z, proj, rp, glow: ringSprite });
      }
    }

    // 5e. Trái tim mini 3D bay lơ lửng
    for (let i = 0; i < miniHearts.length; i += 1) {
      const mh = miniHearts[i];
      mh.y += mh.vy * dt;
      mh.rot += mh.rotSpeed * dt;
      if (mh.y < -3.8) {
        mh.y = 3.8;
        mh.x = rand(-3.5, 3.5);
      }
      const wx = mh.x + Math.sin(t * 0.9 + mh.swayPhase) * mh.swayAmp;
      const proj = project3D(wx, mh.y, mh.z, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'miniHeart', z: proj.z, proj, mh, color: pal.heartColors[mh.colorIdx % pal.heartColors.length] });
    }

    // 5f. 11 ảnh xoay quanh trái tim kèm vệt bụi sao
    const orbitSpeed = 0.42;
    const orbitTilt = 0.24;
    const oCos = Math.cos(orbitTilt);
    const oSin = Math.sin(orbitTilt);
    const photoBloom = smoothstep(0.25, 1.4, elapsed);

    for (let i = 0; i < orbitPhotos.length; i += 1) {
      const item = orbitPhotos[i];
      const ang = item.baseAngle + t * orbitSpeed;
      const rad = item.radiusMul * (0.38 + 0.62 * photoBloom);
      const ox = Math.cos(ang) * rad;
      const oz = Math.sin(ang) * rad;
      const oy = (item.yOffset || 0) + Math.sin(t * 1.4 + item.yBobPhase) * item.yBobAmp;

      const wy = oy * oCos - oz * oSin;
      const wz = oy * oSin + oz * oCos;

      const proj = project3D(ox, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;

      item.trailTimer += dt;
      if (item.trailTimer > 0.26 && bursts.length < 210 && photoBloom > 0.8) {
        item.trailTimer = 0;
        bursts.push({
          kind: 'star',
          x: proj.sx + rand(-14, 14),
          y: proj.sy + rand(-14, 14),
          vx: rand(-14, 14),
          vy: rand(-14, 14),
          gravity: 4,
          drag: 0.96,
          size: rand(3.5, 7),
          rot: rand(0, Math.PI),
          rotSpeed: rand(-2, 2),
          color: pick(pal.heartColors),
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
        alphaMul: photoBloom,
      });
    }

    // 5g. 16 ảnh rơi 5D từ trên xuống dưới
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

      if (f.trailTimer > 0.28 && bursts.length < 210) {
        f.trailTimer = 0;
        bursts.push({
          kind: Math.random() < 0.55 ? 'star' : 'heart',
          x: worldProj.sx + rand(-14, 14),
          y: worldProj.sy - 14,
          vx: rand(-12, 12),
          vy: rand(-26, -6),
          gravity: 10,
          drag: 0.98,
          size: rand(4, 8.5),
          rot: rand(-0.4, 0.4),
          rotSpeed: rand(-1.5, 1.5),
          color: pick(pal.heartColors),
          life: 0,
          maxLife: rand(0.6, 1.0),
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
        node.type === 'core' ||
        node.type === 'heartBloom' ||
        node.type === 'ringBloom' ||
        node.type === 'pedestalDot';

      if (needsAdditive !== additiveOn) {
        additiveOn = needsAdditive;
        ctx.globalCompositeOperation = additiveOn ? 'lighter' : 'source-over';
        ctx.globalAlpha = 1;
      }

      if (node.type === 'core') {
        const coreR = unitScale * (1.22 + swirlAmt * 0.45) * scale * heartPulse;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
        g.addColorStop(0, `rgba(${pal.coreInner}, ${0.38 + beat * 0.18 + swirlAmt * 0.2})`);
        g.addColorStop(0.35, `rgba(${pal.coreRgb}, ${0.24 + beat * 0.12})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.type === 'pedestalDot') {
        const s = Math.max(2.2, node.size * scale * 0.72);
        ctx.globalAlpha = node.alpha * Math.max(0.2, Math.min(1, 1.45 - z * 0.11));
        ctx.drawImage(node.sprite, sx - s, sy - s, s * 2, s * 2);
      } else if (node.type === 'heartBloom') {
        const p = node.p;
        const depthAlpha = Math.max(0.24, Math.min(1, 1.5 - z * 0.115));
        const tw = 0.6 + 0.4 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        const s = Math.max(2.6, p.size * scale * 0.8 * (p.isRim ? 1.06 : 0.92));

        // Vệt tia sáng chất lỏng cực ảo trong lúc bay cột sáng / xoáy cực quang / pháo hoa!
        if (node.drawStreak && node.prevSx !== null) {
          const dist = Math.hypot(sx - node.prevSx, sy - node.prevSy);
          if (dist > 1.2 && dist < 55) {
            ctx.globalAlpha = depthAlpha * 0.48;
            ctx.strokeStyle = `rgb(${pal.streakRgb})`;
            ctx.lineWidth = Math.max(1, s * 0.36);
            ctx.beginPath();
            ctx.moveTo(node.prevSx, node.prevSy);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
        }

        ctx.globalAlpha = depthAlpha * tw * (p.isAura ? 0.58 : 0.92);
        ctx.drawImage(node.sprite, sx - s, sy - s, s * 2, s * 2);
        if (p.sparkle && s > 3.8) {
          drawStarGlint(ctx, sx, sy, s * 1.08, '#ffffff', depthAlpha * tw * 0.9, t * 1.6 + p.twinklePhase);
        }
      } else if (node.type === 'ringBloom') {
        const rp = node.rp;
        const depthAlpha = Math.max(0.16, Math.min(0.95, 1.4 - z * 0.11));
        const tw = 0.55 + 0.45 * Math.sin(t * 3.4 + rp.phase);
        const s = Math.max(2.4, rp.size * scale * 0.7 * (rp.bright ? 1.32 : 0.88));
        ctx.globalAlpha = depthAlpha * tw * (rp.bright ? 0.92 : 0.58);
        ctx.drawImage(node.glow, sx - s, sy - s, s * 2, s * 2);
      } else if (node.type === 'miniHeart') {
        const mh = node.mh;
        const depthAlpha = Math.max(0.18, Math.min(0.86, 1.4 - z * 0.12)) * mh.alpha;
        drawMiniHeart(ctx, sx, sy, mh.size * scale * 0.72, node.color, depthAlpha, mh.rot);
      } else if (node.type === 'orbitPhoto') {
        const cardW = unitScale * 0.66 * scale;
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
        const cardW = unitScale * 0.56 * scale * node.scaleMul;
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

    // 6. Vòng sóng năng lượng & pháo hoa chạm màn hình
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
