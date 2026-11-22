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
    orbitPhotoCount: Math.max(8, Math.min(14, rawCfg.orbitPhotoCount || Math.max(11, photoList.length))),
    fallingPhotoCount: Math.max(18, Math.min(28, (rawCfg.fallingPhotoCount || 16) + 6)),
    autoRotateSpeed: typeof rawCfg.autoRotateSpeed === 'number' ? rawCfg.autoRotateSpeed : 0.34,
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
  // 1. NHẠC NỀN LÃNG MẠN (PAD + PIANO + HỘP NHẠC / MP3)
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
  // 2. KHUNG THẺ ẢNH ÁNH XANH BĂNG SANG TRỌNG
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
    c.width = 248;
    c.height = 296;
    const g = c.getContext('2d');
    drawRoundedRect(g, 14, 14, 220, 268, 20);
    g.fillStyle = '#0f2552';
    g.fill();
    g.strokeStyle = 'rgba(147, 210, 255, 0.78)';
    g.lineWidth = 3;
    g.stroke();
    return c;
  }

  function buildSleekPhotoCard(img) {
    const W = 252;
    const H = 300;
    const PAD = 14;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    g.save();
    g.shadowColor = 'rgba(72, 184, 255, 0.72)';
    g.shadowBlur = 18;
    drawRoundedRect(g, PAD, PAD, W - PAD * 2, H - PAD * 2, 18);
    g.fillStyle = 'rgba(190, 234, 255, 0.88)';
    g.fill();
    g.restore();

    const ix = PAD + 3.5;
    const iy = PAD + 3.5;
    const iw = W - (PAD + 3.5) * 2;
    const ih = H - (PAD + 3.5) * 2;

    g.save();
    drawRoundedRect(g, ix, iy, iw, ih, 15);
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
    g.restore();

    return c;
  }

  const fallbackCard = createFallbackCard();
  const loadedPhotos = cfg.photos.map((src) => {
    const entry = { src, card: fallbackCard, loaded: false };
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      entry.card = buildSleekPhotoCard(img);
      entry.loaded = true;
    };
    img.src = src;
    return entry;
  });

  // ============================================================
  // 3. HỆ HẠT TRÁI TIM XANH + HIỆU ỨNG PHỦ KÍN 100% TOÀN MÀN HÌNH
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

  function smoothstep(e0, e1, x) {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }

  function makePinpointSprite(core, mid, outer, size = 32) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, core);
    grad.addColorStop(0.28, mid);
    grad.addColorStop(0.64, outer);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  const STAR_SPRITES = [
    makePinpointSprite('#ffffff', '#bae6fd', 'rgba(56, 189, 248, 0.38)', 28),
    makePinpointSprite('#f0f9ff', '#60a5fa', 'rgba(37, 99, 235, 0.38)', 28),
    makePinpointSprite('#e0f2fe', '#38bdf8', 'rgba(29, 78, 216, 0.35)', 28),
    makePinpointSprite('#ffffff', '#93c5fd', 'rgba(59, 130, 246, 0.36)', 28),
  ];

  const BLUE_SMOKE_SPRITES = [
    makePinpointSprite('rgba(186, 236, 255, 0.65)', 'rgba(56, 189, 248, 0.28)', 'rgba(29, 78, 216, 0.06)', 40),
    makePinpointSprite('rgba(147, 197, 253, 0.58)', 'rgba(37, 130, 255, 0.26)', 'rgba(30, 64, 175, 0.05)', 40),
    makePinpointSprite('rgba(224, 244, 255, 0.72)', 'rgba(96, 195, 255, 0.3)', 'rgba(37, 99, 235, 0.06)', 40),
  ];

  // Sprite trái tim phát sáng mềm phủ khắp không gian toàn màn hình
  function makeGlowingHeartSprite(coreColor, glowColor) {
    const S = 44;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2 + 2);
    g.shadowColor = glowColor;
    g.shadowBlur = 10;
    g.fillStyle = coreColor;
    const sz = 14;
    g.beginPath();
    g.moveTo(0, sz * 0.5);
    g.bezierCurveTo(-sz * 0.78, sz * 0.04, -sz * 0.82, -sz * 0.56, -sz * 0.36, -sz * 0.56);
    g.bezierCurveTo(-sz * 0.12, -sz * 0.56, 0, -sz * 0.32, 0, -sz * 0.32);
    g.bezierCurveTo(0, -sz * 0.32, sz * 0.12, -sz * 0.56, sz * 0.36, -sz * 0.56);
    g.bezierCurveTo(sz * 0.82, -sz * 0.56, sz * 0.78, sz * 0.04, 0, sz * 0.5);
    g.closePath();
    g.fill();
    return c;
  }

  const HEART_SPRITES = [
    makeGlowingHeartSprite('#bae6fd', '#38bdf8'),
    makeGlowingHeartSprite('#7dd3fc', '#2563eb'),
    makeGlowingHeartSprite('#e0f2fe', '#60a5fa'),
    makeGlowingHeartSprite('#93c5fd', '#3b82f6'),
  ];

  const PEDESTAL_Y = 1.24;
  const HEART_CENTER_Y = -0.18;

  // Trạng thái màn hình & độ phủ không gian 3D theo đúng tỷ lệ màn hình (rộng hết cỡ trên laptop 16:9!)
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let unitScale = 220;
  let focalLength = 900;
  let worldSpanX = 5.4;
  let worldSpanY = 3.8;

  function updateDimensions() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Tỷ lệ tuyến tính chuẩn xác cho mọi kích cỡ màn hình (điện thoại, laptop, màn rời 2K/4K)
    const aspect = width / Math.max(1, height);
    unitScale = aspect >= 1 ? height * 0.225 : width * 0.255;

    // Biên thế giới 3D tính chính xác theo số pixel màn hình để hiệu ứng phủ kín 100% từ mép này sang mép kia!
    worldSpanX = (width * 0.5) / Math.max(1, unitScale) * 1.22;
    worldSpanY = (height * 0.5) / Math.max(1, unitScale) * 1.22;
  }
  updateDimensions();

  // 1) 4.000 hạt sao mịn tạo Trái Tim 3D lớn ở trung tâm + hạt tỏa rộng ra toàn màn hình
  function createHeartStardust(count) {
    const SAMPLES = 720;
    const pts = [];
    const cumLen = [0];
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = (Math.PI * 2 * i) / SAMPLES;
      const hx = (16 * Math.pow(Math.sin(t), 3)) / 16;
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 1.2) / 16;
      pts.push([hx, hy]);
      if (i > 0) cumLen.push(cumLen[i - 1] + Math.hypot(hx - pts[i - 1][0], hy - pts[i - 1][1]));
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

    const dandelionCenters = [
      [-0.42, HEART_CENTER_Y - 0.26, 0.05],
      [0.42, HEART_CENTER_Y - 0.26, -0.05],
      [0.0, HEART_CENTER_Y + 0.1, 0.08],
    ];

    const list = [];
    for (let i = 0; i < count; i += 1) {
      const [hx, hy] = sampleRim();
      const shellType = Math.random();
      let r;
      let z;
      let jitter;

      if (shellType < 0.36) {
        r = rand(0.93, 1.02);
        const dome = Math.sqrt(Math.max(0.02, 1 - Math.min(0.98, r * r))) * 0.58;
        z = (Math.random() < 0.5 ? 1 : -1) * dome * rand(0.5, 1.0);
        jitter = 0.015;
      } else if (shellType < 0.88) {
        r = Math.pow(Math.random(), 0.48);
        const dome = Math.sqrt(Math.max(0, 1 - r * r)) * 0.6;
        z = (Math.random() < 0.5 ? 1 : -1) * dome * rand(0.7, 1.04);
        jitter = 0.024;
      } else {
        r = rand(0.15, 0.85);
        const dome = Math.sqrt(Math.max(0, 1 - r * r)) * 0.48;
        z = rand(-dome, dome);
        jitter = 0.03;
      }

      // Phóng to kích thước trái tim 3D thêm 18% cho nổi bật giữa màn hình lớn
      const bx = hx * r * 1.14 + rand(-jitter, jitter);
      const by = hy * r * 1.14 + HEART_CENTER_Y + rand(-jitter, jitter);
      const bz = z * 1.14;

      const floorAng = rand(0, Math.PI * 2);
      const floorRad = Math.pow(Math.random(), 0.58) * 2.1;
      const fx0 = Math.cos(floorAng) * floorRad;
      const fz0 = Math.sin(floorAng) * floorRad;

      const dc = dandelionCenters[i % dandelionCenters.length];
      const u = Math.random();
      const v = Math.random();
      const th = u * Math.PI * 2;
      const ph = Math.acos(2 * v - 1);
      const dr = Math.pow(Math.random(), 0.42) * 0.68;

      list.push({
        bx,
        by,
        bz,
        fx0,
        fz0,
        colRad: rand(0.08, 0.62),
        colAng: floorAng,
        delay: rand(0, 0.45),
        dx: dc[0] + Math.sin(ph) * Math.cos(th) * dr,
        dy: dc[1] + Math.cos(ph) * dr,
        dz: dc[2] + Math.sin(ph) * Math.sin(th) * dr,
        isDandelion: i % 3 !== 0,
        size: rand(1.0, 2.5),
        glowy: Math.random() < 0.25,
        spriteIdx: i % STAR_SPRITES.length,
        color: pick(['#ffffff', '#e0f2fe', '#93c5fd', '#60a5fa', '#38bdf8', '#3b82f6']),
        twPhase: rand(0, Math.PI * 2),
        twSpeed: rand(2.2, 5.5),
      });
    }
    return list;
  }

  // 2) LÀN SƯƠNG LỬA XANH CUỘN CHẢY QUANH TRÁI TIM (00:09 -> 00:15 video)
  function createBlueSilkFlameRibbons(count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const p = {
        x: 0,
        y: 0,
        z: 0,
        life: rand(0, 1),
        maxLife: rand(1.6, 3.0),
        seed: rand(0, Math.PI * 2),
        stream: i % 5,
        side: i % 2 === 0 ? 1 : -1,
        speed: rand(0.72, 1.28),
        size: rand(6, 18),
        isSpark: i % 3 === 0,
        spriteIdx: i % BLUE_SMOKE_SPRITES.length,
      };
      resetFluidParticle(p, true);
      list.push(p);
    }
    return list;
  }

  function resetFluidParticle(p, randomProgress) {
    const a = rand(0, Math.PI * 2);
    const r = rand(0.08, 0.75);
    p.x = Math.cos(a) * r;
    p.z = Math.sin(a) * r - 0.16;
    p.y = PEDESTAL_Y - rand(0.02, 0.24);
    p.life = randomProgress ? rand(0, p.maxLife) : 0;
  }

  // 3) DẢI NGÂN HÀ & BỤI SAO 3D PHỦ KÍN 100% TOÀN MÀN HÌNH (xóa sổ hoàn toàn vùng đen trống!)
  //    Gồm 1.400 hạt bụi sao xanh + đom đóm phát sáng + trái tim xanh mini bay khắp mọi góc màn hình!
  function createFullScreenGalaxyField(starCount, heartCount) {
    const field = [];
    for (let i = 0; i < starCount; i += 1) {
      const isRiver = i < starCount * 0.55; // 55% tạo thành 3 dải sông ngân hà xanh chảy uốn lượn ngang dọc toàn màn hình
      const band = i % 3;
      field.push({
        isRiver,
        band,
        u: rand(-1, 1), // Tỷ lệ chuẩn hóa theo worldSpanX / worldSpanY
        v: rand(-1, 1),
        z: rand(-3.6, 2.1),
        speed: rand(0.04, 0.14) * (i % 2 === 0 ? 1 : -1),
        swayPhase: rand(0, Math.PI * 2),
        swaySpeed: rand(0.8, 2.2),
        size: isRiver ? rand(1.6, 4.4) : rand(1.2, 3.8),
        glowy: Math.random() < 0.48,
        spriteIdx: i % STAR_SPRITES.length,
        color: pick(['#ffffff', '#bae6fd', '#7dd3fc', '#60a5fa', '#38bdf8']),
      });
    }

    const floatingHearts = [];
    for (let i = 0; i < heartCount; i += 1) {
      floatingHearts.push({
        u: rand(-1.05, 1.05),
        v: rand(-1.05, 1.05),
        z: rand(-3.2, 1.9),
        vy: rand(0.05, 0.14),
        swayAmp: rand(0.04, 0.12),
        swayPhase: rand(0, Math.PI * 2),
        size: rand(9, 24),
        rot: rand(-0.45, 0.45),
        rotSpeed: rand(-0.7, 0.7),
        spriteIdx: i % HEART_SPRITES.length,
        alpha: rand(0.35, 0.85),
      });
    }

    return { field, floatingHearts };
  }

  // 4) 11 ảnh xoay 3D rộng quanh trái tim + 22 ảnh rơi 5D trải đều từ mép trái sang mép phải màn hình!
  function createOrbitPhotos(count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        photoIndex: i % loadedPhotos.length,
        baseAngle: (Math.PI * 2 * i) / count,
        radiusOffset: i % 2 === 0 ? 0.14 : -0.1,
        yOffset: (i % 2 === 0 ? 0.28 : -0.28) + HEART_CENTER_Y,
        yBobAmp: rand(0.08, 0.16),
        yBobPhase: rand(0, Math.PI * 2),
        tiltPhase: rand(0, Math.PI * 2),
      });
    }
    return list;
  }

  function createFallingPhoto(randomY, idx = 0, total = 22) {
    const layer = Math.random();
    const zDepth = layer < 0.42 ? rand(-3.0, -1.3) : layer < 0.8 ? rand(-1.2, 0.8) : rand(0.9, 1.85);
    // Chia đều theo chiều ngang toàn màn hình để góc trái, giữa, phải đều luôn có ảnh rơi!
    const laneU = ((idx + rand(0.15, 0.85)) / Math.max(1, total)) * 2 - 1;
    return {
      photoIndex: (idx + ((Math.random() * loadedPhotos.length) | 0)) % loadedPhotos.length,
      u: laneU * 0.96,
      y: randomY ? rand(-worldSpanY, worldSpanY) : rand(-worldSpanY - 0.9, -worldSpanY),
      z: zDepth,
      vy: rand(0.38, 0.76) * (zDepth > 0.6 ? 1.12 : 0.9),
      swayAmp: rand(0.14, 0.36),
      swayFreq: rand(0.6, 1.35),
      swayPhase: rand(0, Math.PI * 2),
      spinPhase: rand(0, Math.PI * 2),
      spinSpeed: rand(0.7, 1.5),
      rotAmp: rand(0.14, 0.3),
      scaleMul: rand(0.46, 0.72),
    };
  }

  let camRotY = 0;
  let camRotX = 0.2;
  let velY = 0;
  let velX = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let zoom = 1;
  let targetZoom = 1;

  let elapsed = parseFloat(new URLSearchParams(location.search).get('t')) || 3.5;
  let manualAuraBoost = 0;
  let lastTime = performance.now();
  let nextMeteorTime = 0.8;

  const heartDust = createHeartStardust(3800);
  const blueFlames = createBlueSilkFlameRibbons(920);
  const { field: galaxyField, floatingHearts } = createFullScreenGalaxyField(1350, 68);
  const orbitPhotos = createOrbitPhotos(cfg.orbitPhotoCount);
  const fallingPhotos = Array.from({ length: cfg.fallingPhotoCount }, (_, idx) =>
    createFallingPhoto(true, idx, cfg.fallingPhotoCount)
  );

  const tapSparks = [];
  const meteors = [];
  const fireworkRockets = [];
  const fireworkSparks = [];
  const fireworkFlashes = [];
  const renderQueue = [];
  let clickableCards = [];
  let nextFireworkTime = 0.25;

  const FIREWORK_PALETTES = [
    ['#ffffff', '#bae6fd', '#38bdf8', '#0284c7'], // Xanh băng kim cương
    ['#fff0f7', '#ff77bc', '#ff2e88', '#fde047'], // Hồng ánh kim
    ['#fef9c3', '#fde047', '#fbbf24', '#38bdf8'], // Vàng hoàng kim & xanh
    ['#f5f3ff', '#c084fc', '#818cf8', '#67e8f9'], // Tím ngân hà & lam
  ];

  // Nổ 1 quả pháo hoa rực rỡ (kiểu Hoa Cúc Liễu Rủ, Trái Tim, hoặc Sao Bồ Công Anh)
  function detonateFirework(x, y, forceStyle) {
    const pal = pick(FIREWORK_PALETTES);
    const style = forceStyle || (Math.random() < 0.34 ? 'heart' : Math.random() < 0.68 ? 'willow' : 'starburst');

    // Chớp sáng mềm tại tâm nổ
    fireworkFlashes.push({
      x,
      y,
      r: rand(95, 165),
      color: pal[1],
      life: 0,
      maxLife: 0.42,
    });

    if (style === 'heart') {
      // Pháo hoa nở thành hình Trái Tim lớn trên bầu trời
      const count = 64;
      const baseSpd = rand(9.5, 13.5);
      const tilt = rand(-0.22, 0.22);
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      for (let i = 0; i < count; i += 1) {
        const t = (Math.PI * 2 * i) / count;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const rx = hx * cosT - hy * sinT;
        const ry = hx * sinT + hy * cosT;
        const jitter = rand(0.92, 1.08);
        fireworkSparks.push({
          x,
          y,
          vx: rx * baseSpd * jitter,
          vy: ry * baseSpd * jitter,
          gravity: 85,
          drag: 0.952,
          size: rand(1.6, 2.9),
          color: i % 5 === 0 ? pal[0] : pal[1 + (i % (pal.length - 1))],
          life: 0,
          maxLife: rand(1.25, 1.85),
          crackle: i % 3 === 0,
          starTip: i % 6 === 0,
          trail: [[x, y]],
        });
      }
    } else {
      // Pháo hoa Hoa Cúc 2 tầng & Liễu Rủ kéo đuôi cong mềm mại
      const outerCount = style === 'willow' ? 72 : 60;
      const maxSpd = style === 'willow' ? rand(170, 260) : rand(150, 235);

      for (let i = 0; i < outerCount; i += 1) {
        const a = (Math.PI * 2 * i) / outerCount + rand(-0.08, 0.08);
        const ringLayer = i % 3 === 0 ? rand(0.45, 0.68) : rand(0.82, 1.08);
        const sp = maxSpd * ringLayer;
        fireworkSparks.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          gravity: style === 'willow' ? 135 : 95,
          drag: style === 'willow' ? 0.962 : 0.955,
          size: rand(1.5, 3.0),
          color: ringLayer < 0.7 ? pal[0] : pal[1 + (i % (pal.length - 1))],
          life: 0,
          maxLife: style === 'willow' ? rand(1.45, 2.2) : rand(1.15, 1.75),
          crackle: Math.random() < 0.4,
          starTip: style === 'starburst' && i % 4 === 0,
          trail: [[x, y]],
        });
      }
    }
  }

  // Bắn quả đạn pháo hoa từ dưới bay vọt lên trời rồi phát nổ
  function launchFireworkRocket(targetX, targetY, forceStyle) {
    const tx = typeof targetX === 'number' ? targetX : rand(width * 0.08, width * 0.92);
    const ty = typeof targetY === 'number' ? targetY : rand(height * 0.12, height * 0.56);
    const sx = tx + rand(-width * 0.08, width * 0.08);
    const sy = height + 10;
    const dur = rand(0.55, 0.85);
    fireworkRockets.push({
      x: sx,
      y: sy,
      sx,
      sy,
      tx,
      ty,
      life: 0,
      maxLife: dur,
      color: pick(['#bae6fd', '#fde047', '#ff80c0', '#ffffff']),
      forceStyle,
      trail: [[sx, sy]],
    });
  }

  function launchGrandFinale() {
    detonateFirework(width * 0.5, height * 0.34, 'heart');
    detonateFirework(width * 0.2, height * 0.28, 'willow');
    detonateFirework(width * 0.8, height * 0.28, 'willow');
    launchFireworkRocket(width * 0.34, height * 0.22, 'starburst');
    launchFireworkRocket(width * 0.66, height * 0.22, 'heart');
  }

  // Mở sẵn 3 bông pháo hoa rực rỡ ngay giây đầu tiên trên màn hình!
  detonateFirework(width * 0.18, height * 0.26, 'willow');
  detonateFirework(width * 0.82, height * 0.24, 'heart');
  detonateFirework(width * 0.5, height * 0.18, 'starburst');
  for (let pre = 0; pre < 18; pre += 1) {
    for (let i = fireworkSparks.length - 1; i >= 0; i -= 1) {
      const s = fireworkSparks[i];
      s.life += 0.025;
      s.vx *= Math.pow(s.drag, 1.5);
      s.vy = s.vy * Math.pow(s.drag, 1.5) + s.gravity * 0.025;
      s.x += s.vx * 0.025;
      s.y += s.vy * 0.025;
      s.trail.push([s.x, s.y]);
      if (s.trail.length > 7) s.trail.shift();
    }
  }

  window.addEventListener('resize', updateDimensions);

  // Làm nóng sẵn dòng chảy khói xanh
  for (let w = 0; w < 35; w += 1) {
    for (let i = 0; i < blueFlames.length; i += 1) {
      const p = blueFlames[i];
      p.life += 0.04 * p.speed;
      if (p.life >= p.maxLife || p.y < -1.55) resetFluidParticle(p, false);
      const prog = p.life / p.maxLife;
      const heartEnv = Math.sin(prog * Math.PI);
      const targetAngle = prog * 4.4 + p.stream * 1.25;
      const targetRadius = 0.24 + heartEnv * 0.82;
      p.x += (Math.cos(targetAngle) * targetRadius - p.x) * 0.14;
      p.z += (Math.sin(targetAngle) * targetRadius * 0.65 - 0.16 - p.z) * 0.14;
      p.y -= 0.85 * 0.04;
    }
  }

  function project3D(wx, wy, wz, cosY, sinY, cosX, sinX) {
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;
    const y2 = wy * cosX - z1 * sinX;
    const z2 = wy * sinX + z1 * cosX;

    const camDist = 5.3 / zoom;
    const pz = z2 + camDist;
    if (pz <= 0.35) return null;

    // Phép chiếu phối cảnh chuẩn: tại tâm (z2 = 0) thì scale = 1.0 * zoom
    const scale = 5.3 / pz;
    const sx = width * 0.5 + x1 * unitScale * scale;
    const sy = height * 0.5 + y2 * unitScale * scale;
    return { sx, sy, z: pz, scale };
  }

  function spawnMeteor() {
    const fromLeft = Math.random() < 0.55;
    meteors.push({
      x: fromLeft ? rand(-20, width * 0.7) : rand(width * 0.3, width + 20),
      y: rand(-20, height * 0.65),
      vx: (fromLeft ? 1 : -1) * rand(540, 920),
      vy: rand(200, 420),
      len: rand(110, 190),
      life: 0,
      maxLife: rand(0.65, 1.15),
    });
  }

  function spawnBlueSparkBurst(x, y, count = 36) {
    detonateFirework(x, y);
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
      const sp = rand(50, 240);
      tapSparks.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(10, 60),
        gravity: 110,
        drag: 0.96,
        size: rand(1.3, 3.0),
        color: pick(['#ffffff', '#bae6fd', '#60a5fa', '#38bdf8']),
        life: 0,
        maxLife: rand(0.65, 1.35),
      });
    }
  }

  burstTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    music.tryAutoStart();
    manualAuraBoost = 1.0;
    launchGrandFinale();
    spawnMeteor();
    if (navigator.vibrate) navigator.vibrate(20);
  });

  // ============================================================
  // 4. TƯƠNG TÁC 5D (XOAY 360°, ZOOM, CHẠM BẮN HẠT SÁNG, BẤM ẢNH PHÓNG TO)
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

  function markInteracted() {
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
      camRotX = Math.max(-0.82, Math.min(0.82, camRotX + dy * 0.0052));
      velY = dx * 0.0046;
      velX = dy * 0.0034;
    } else if (e.pointerType === 'mouse') {
      targetParallaxX = (e.clientX / width - 0.5) * 0.22;
      targetParallaxY = (e.clientY / height - 0.5) * 0.14;
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
        spawnBlueSparkBurst(downX, downY, 32);
        if (navigator.vibrate) navigator.vibrate(14);
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
        targetParallaxX = Math.max(-0.26, Math.min(0.26, (e.gamma / 45) * 0.22));
        targetParallaxY = Math.max(-0.18, Math.min(0.18, ((e.beta - 45) / 45) * 0.14));
      }
    },
    { passive: true }
  );

  photoModal.addEventListener('click', () => {
    photoModal.hidden = true;
  });

  // ============================================================
  // 5. NỀN CỰC QUANG XANH ĐA TẦNG PHỦ KÍN 4 GÓC MÀN HÌNH + ĐĨA SÁNG
  // ============================================================
  function drawFullScreenCosmicBlueNebula(t, beat, flameIntensity) {
    const bg = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      0,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.95
    );
    bg.addColorStop(0, '#091d46');
    bg.addColorStop(0.45, '#040d24');
    bg.addColorStop(1, '#01040d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 5 đám mây tinh vân xanh lam / xanh băng trôi bồng bềnh ở cả 4 góc và trung tâm (không còn góc nào đen xì!)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const clouds = [
      {
        x: width * (0.18 + 0.08 * Math.sin(t * 0.24)),
        y: height * (0.24 + 0.07 * Math.cos(t * 0.2)),
        r: Math.max(width, height) * 0.46,
        c1: 'rgba(37, 130, 255, 0.16)',
        c2: 'rgba(14, 65, 175, 0.06)',
      },
      {
        x: width * (0.82 + 0.08 * Math.cos(t * 0.22)),
        y: height * (0.26 + 0.08 * Math.sin(t * 0.19)),
        r: Math.max(width, height) * 0.44,
        c1: 'rgba(56, 189, 248, 0.15)',
        c2: 'rgba(29, 78, 216, 0.06)',
      },
      {
        x: width * (0.2 + 0.09 * Math.cos(t * 0.21)),
        y: height * (0.78 + 0.07 * Math.sin(t * 0.25)),
        r: Math.max(width, height) * 0.45,
        c1: 'rgba(59, 130, 246, 0.15)',
        c2: 'rgba(30, 58, 138, 0.06)',
      },
      {
        x: width * (0.8 + 0.08 * Math.sin(t * 0.26)),
        y: height * (0.76 + 0.07 * Math.cos(t * 0.23)),
        r: Math.max(width, height) * 0.46,
        c1: 'rgba(34, 175, 255, 0.15)',
        c2: 'rgba(37, 99, 235, 0.06)',
      },
      {
        x: width * 0.5,
        y: height * 0.46,
        r: unitScale * (2.4 + flameIntensity * 0.7 + beat * 0.25),
        c1: `rgba(56, 178, 255, ${0.18 + flameIntensity * 0.16})`,
        c2: 'rgba(29, 78, 216, 0.07)',
      },
    ];

    for (let i = 0; i < clouds.length; i += 1) {
      const cl = clouds[i];
      const g = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
      g.addColorStop(0, cl.c1);
      g.addColorStop(0.55, cl.c2);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  function drawSoftBluePedestalPool(cosY, sinY, cosX, sinX, beat, visibility) {
    if (visibility <= 0.01) return;
    const p = project3D(0, PEDESTAL_Y, 0, cosY, sinY, cosX, sinX);
    if (!p) return;

    const flat = Math.max(0.2, Math.abs(sinX) * 0.92 + 0.14);
    const rx = unitScale * (1.12 + beat * 0.06) * p.scale;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(p.sx, p.sy);
    ctx.scale(1, flat);

    const outerG = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.48);
    outerG.addColorStop(0, `rgba(120, 210, 255, ${0.44 * visibility})`);
    outerG.addColorStop(0.38, `rgba(37, 128, 255, ${0.28 * visibility})`);
    outerG.addColorStop(0.75, `rgba(29, 78, 216, ${0.09 * visibility})`);
    outerG.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = outerG;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.48, 0, Math.PI * 2);
    ctx.fill();

    const innerG = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.74);
    innerG.addColorStop(0, `rgba(235, 249, 255, ${(0.9 + beat * 0.1) * visibility})`);
    innerG.addColorStop(0.45, `rgba(96, 195, 255, ${0.6 * visibility})`);
    innerG.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = innerG;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.74, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function stepAndDrawBlueSilkAura(dt, t, auraIntensity, cosY, sinY, cosX, sinX) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < blueFlames.length; i += 1) {
      const p = blueFlames[i];
      p.life += dt * p.speed;
      if (p.life >= p.maxLife || p.y < -1.55) {
        resetFluidParticle(p, false);
      }

      const prog = p.life / p.maxLife;
      const heartEnv = Math.sin(prog * Math.PI);
      const targetAngle = prog * 4.4 + p.stream * 1.25 + t * 0.9;
      const targetRadius = 0.24 + heartEnv * (0.62 + auraIntensity * 0.48);
      const tx = Math.cos(targetAngle) * targetRadius + p.side * heartEnv * auraIntensity * 0.24;
      const tz = Math.sin(targetAngle) * targetRadius * 0.65 - 0.16;

      p.x += (tx - p.x) * Math.min(1, dt * 2.8) + Math.sin(p.y * 3.2 + t * 2.0 + p.seed) * dt * 0.28;
      p.z += (tz - p.z) * Math.min(1, dt * 2.8) + Math.cos(p.y * 3.0 - t * 1.8 + p.seed) * dt * 0.25;
      p.y -= (0.72 + auraIntensity * 0.36) * dt;

      if (auraIntensity < 0.08 && !p.isSpark) continue;

      const proj = project3D(p.x, p.y, p.z, cosY, sinY, cosX, sinX);
      if (!proj) continue;

      const fade = Math.sin(prog * Math.PI);
      if (p.isSpark) {
        const s = Math.max(1.6, (1.8 + auraIntensity * 2.4) * proj.scale);
        ctx.globalAlpha = fade * (0.22 + auraIntensity * 0.7);
        ctx.drawImage(STAR_SPRITES[p.spriteIdx % STAR_SPRITES.length], proj.sx - s, proj.sy - s, s * 2, s * 2);
      } else {
        const s = Math.max(4.5, p.size * proj.scale * (0.7 + auraIntensity * 0.68));
        ctx.globalAlpha = fade * (0.08 + auraIntensity * 0.32);
        ctx.drawImage(BLUE_SMOKE_SPRITES[p.spriteIdx], proj.sx - s, proj.sy - s, s * 2, s * 2);
      }
    }

    ctx.restore();
  }

  // ============================================================
  // 6. VÒNG LẶP KẾT XUẤT 60FPS — HIỆU ỨNG TRÀN KÍN 100% MÀN HÌNH
  // ============================================================
  function render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    const t = elapsed;

    manualAuraBoost = Math.max(0, manualAuraBoost - dt * 0.35);

    const cycleT = t % 21.0;
    const isRising = cycleT < 4.2;
    const riseP = smoothstep(0.7, 3.9, cycleT);
    const fallP = smoothstep(19.2, 20.7, cycleT) * (1 - smoothstep(20.9, 21.0, cycleT));

    const autoFlameAura = 0.26 + 0.74 * smoothstep(8.2, 10.2, cycleT) * (1 - smoothstep(13.8, 16.0, cycleT));
    const autoDandelion = smoothstep(12.0, 13.6, cycleT) * (1 - smoothstep(14.8, 16.6, cycleT));
    const flameIntensity = Math.max(autoFlameAura, manualAuraBoost);
    const dandelionAmt = Math.max(autoDandelion, manualAuraBoost * 0.72);
    const pedestalVis = smoothstep(2.6, 4.3, cycleT) * (1 - smoothstep(19.3, 20.5, cycleT));

    const beatCycle = (t * 1.1) % 1;
    const beat =
      Math.exp(-Math.pow((beatCycle - 0.14) / 0.08, 2)) +
      0.55 * Math.exp(-Math.pow((beatCycle - 0.32) / 0.095, 2));
    const heartScale = 1 + beat * 0.055;

    if (elapsed > nextMeteorTime) {
      spawnMeteor();
      nextMeteorTime = elapsed + rand(1.4, 3.2);
    }

    // Tự động bắn pháo hoa liên tục khắp màn hình (trái, phải, trên, góc)
    if (elapsed > nextFireworkTime && fireworkSparks.length < 520) {
      if (Math.random() < 0.45) {
        detonateFirework(rand(width * 0.1, width * 0.9), rand(height * 0.14, height * 0.55));
      } else {
        launchFireworkRocket();
      }
      nextFireworkTime = elapsed + rand(0.75, 1.45);
    }

    if (!isDragging) {
      camRotY += cfg.autoRotateSpeed * dt + velY;
      camRotX = Math.max(-0.82, Math.min(0.82, camRotX + velX));
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

    // 1. Tinh vân xanh sâu phủ kín cả 4 góc màn hình
    drawFullScreenCosmicBlueNebula(t, beat, flameIntensity);

    // 2. Sao băng xanh xẹt ngang bầu trời
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
      grad.addColorStop(0.38, `rgba(96, 195, 255, ${alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Đĩa quầng sáng xanh & Làn khói lửa xanh mềm mại sau trái tim
    drawSoftBluePedestalPool(cosY, sinY, cosX, sinX, beat, pedestalVis);
    stepAndDrawBlueSilkAura(dt, t, flameIntensity, cosY, sinY, cosX, sinX);

    // 4. Hàng đợi Z-sort 3D toàn màn hình
    renderQueue.length = 0;

    // 4a. DẢI NGÂN HÀ XANH & ĐOM ĐÓM SAO 3D TRẢI KÍN 100% MÀN HÌNH (trái, phải, trên, dưới!)
    for (let i = 0; i < galaxyField.length; i += 1) {
      const gf = galaxyField[i];
      gf.u += gf.speed * dt;
      if (gf.u > 1.15) gf.u = -1.15;
      else if (gf.u < -1.15) gf.u = 1.15;

      let wx = gf.u * worldSpanX;
      let wy = gf.v * worldSpanY;
      const wz = gf.z;

      if (gf.isRiver) {
        // Tạo thành 3 dải ngân hà sao xanh uốn lượn mềm mại vắt ngang từ mép trái sang mép phải màn hình
        const riverCurve =
          Math.sin(gf.u * 2.8 + t * 0.45 + gf.band * 2.1) * 0.95 +
          (gf.band - 1) * (worldSpanY * 0.42);
        wy = riverCurve + gf.v * 0.68;
      } else {
        wy += Math.sin(t * gf.swaySpeed + gf.swayPhase) * 0.18;
      }

      const proj = project3D(wx, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'galaxyStar', z: proj.z, proj, gf });
    }

    // 4b. 68 Trái tim xanh phát sáng bay lơ lửng khắp mọi góc màn hình
    for (let i = 0; i < floatingHearts.length; i += 1) {
      const fh = floatingHearts[i];
      fh.v -= fh.vy * dt;
      fh.rot += fh.rotSpeed * dt;
      if (fh.v < -1.18) {
        fh.v = 1.18;
        fh.u = rand(-1.05, 1.05);
      }
      const wx = (fh.u + Math.sin(t * 0.9 + fh.swayPhase) * fh.swayAmp) * worldSpanX;
      const wy = fh.v * worldSpanY;
      const proj = project3D(wx, wy, fh.z, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'floatingHeart', z: proj.z, proj, fh });
    }

    // 4c. 3.800 hạt sao mịn tạo Trái Tim 3D lớn ở trung tâm
    const heartSpin = t * 0.35;
    const hCos = Math.cos(heartSpin);
    const hSin = Math.sin(heartSpin);

    for (let i = 0; i < heartDust.length; i += 1) {
      const p = heartDust[i];
      let wx = (p.bx * hCos - p.bz * hSin) * heartScale;
      let wz = (p.bx * hSin + p.bz * hCos) * heartScale;
      let wy = p.by * heartScale;

      if (isRising) {
        const prog = clamp01((riseP - p.delay * 0.55) / (1 - p.delay * 0.55));
        const ease = prog * prog * (3 - 2 * prog);
        const mid = Math.sin(ease * Math.PI);
        const colX = Math.cos(p.colAng + t * 1.2) * p.colRad;
        const colZ = Math.sin(p.colAng + t * 1.2) * p.colRad;

        wx = p.fx0 * (1 - ease) + wx * ease + (colX - wx) * mid * 0.72;
        wz = p.fz0 * (1 - ease) + wz * ease + (colZ - wz) * mid * 0.72;
        wy = PEDESTAL_Y * (1 - ease) + wy * ease;
      }

      if (fallP > 0.001) {
        const dProg = clamp01((fallP - p.delay * 0.35) / (1 - p.delay * 0.35));
        const dEase = dProg * dProg;
        wx = wx * (1 - dEase) + p.fx0 * dEase;
        wz = wz * (1 - dEase) + p.fz0 * dEase;
        wy = wy * (1 - dEase) + PEDESTAL_Y * dEase;
      }

      if (dandelionAmt > 0.005 && p.isDandelion) {
        const b = dandelionAmt * 0.88;
        const tx = p.dx * hCos - p.dz * hSin;
        const tz = p.dx * hSin + p.dz * hCos;
        wx = wx * (1 - b) + tx * b;
        wy = wy * (1 - b) + p.dy * b;
        wz = wz * (1 - b) + tz * b;
      } else if (flameIntensity > 0.3) {
        const wave = Math.sin(wy * 3.2 + t * 3.2 + p.twPhase) * (flameIntensity - 0.25) * 0.09;
        wx += wave;
        wz += Math.cos(wx * 3.2 - t * 2.8 + p.twPhase) * (flameIntensity - 0.25) * 0.09;
      }

      const proj = project3D(wx, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;
      renderQueue.push({ type: 'dust', z: proj.z, proj, p });
    }

    // 4d. 11 tấm ảnh xoay 3D rộng thoáng quanh trái tim (tự mở rộng quỹ đạo theo màn hình ngang!)
    const orbitSpeed = 0.4;
    const orbitTilt = 0.22;
    const oCos = Math.cos(orbitTilt);
    const oSin = Math.sin(orbitTilt);
    const photoEnter = smoothstep(0.25, 1.35, elapsed);
    const wideOrbitX = Math.max(2.45, Math.min(3.55, worldSpanX * 0.62));
    const wideOrbitZ = 2.42;

    for (let i = 0; i < orbitPhotos.length; i += 1) {
      const item = orbitPhotos[i];
      const ang = item.baseAngle + t * orbitSpeed;
      const enterScale = 0.45 + 0.55 * photoEnter;
      const ox = Math.cos(ang) * (wideOrbitX + item.radiusOffset) * enterScale;
      const oz = Math.sin(ang) * (wideOrbitZ + item.radiusOffset) * enterScale;
      const oy = item.yOffset + Math.sin(t * 1.3 + item.yBobPhase) * item.yBobAmp;

      const wy = oy * oCos - oz * oSin;
      const wz = oy * oSin + oz * oCos;

      const proj = project3D(ox, wy, wz, cosY, sinY, cosX, sinX);
      if (!proj) continue;

      renderQueue.push({
        type: 'orbitPhoto',
        z: proj.z,
        proj,
        photo: loadedPhotos[item.photoIndex],
        tilt: Math.sin(t * 1.1 + item.tiltPhase) * 0.075,
        yawCos: 0.78 + 0.22 * Math.cos(ang + viewY),
        alphaMul: photoEnter,
      });
    }

    // 4e. 22 tấm ảnh rơi 5D trải rộng khắp chiều ngang toàn màn hình
    for (let i = 0; i < fallingPhotos.length; i += 1) {
      const f = fallingPhotos[i];
      f.y += f.vy * dt;
      f.spinPhase += f.spinSpeed * dt;
      if (f.y > worldSpanY + 0.6) {
        fallingPhotos[i] = createFallingPhoto(false, i, fallingPhotos.length);
        continue;
      }

      const wx = f.u * worldSpanX + Math.sin(t * f.swayFreq + f.swayPhase) * f.swayAmp;
      const proj = project3D(wx, f.y, f.z, cosY, sinY, cosX, sinX);
      if (!proj) continue;

      renderQueue.push({
        type: 'fallingPhoto',
        z: proj.z,
        proj,
        photo: loadedPhotos[f.photoIndex],
        rot: Math.sin(f.spinPhase) * f.rotAmp,
        flutterX: 0.7 + 0.3 * Math.abs(Math.cos(f.spinPhase * 0.85)),
        scaleMul: f.scaleMul,
        yWorld: f.y,
      });
    }

    // Sắp xếp xa -> gần cho chiều sâu 3D/5D thật
    renderQueue.sort((a, b) => b.z - a.z);
    clickableCards = [];
    let additive = false;

    for (let i = 0; i < renderQueue.length; i += 1) {
      const node = renderQueue[i];
      const { sx, sy, scale, z } = node.proj;
      const wantAdd =
        node.type === 'dust' || node.type === 'galaxyStar' || node.type === 'floatingHeart';

      if (wantAdd !== additive) {
        additive = wantAdd;
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
        ctx.globalAlpha = 1;
      }

      if (node.type === 'dust') {
        const p = node.p;
        const depthAlpha = Math.max(0.24, Math.min(1, 1.5 - z * 0.12));
        const tw = 0.55 + 0.45 * Math.sin(t * p.twSpeed + p.twPhase);
        const alpha = depthAlpha * tw;

        if (p.glowy) {
          const s = Math.max(2.0, p.size * scale * 1.65);
          ctx.globalAlpha = alpha * 0.9;
          ctx.drawImage(STAR_SPRITES[p.spriteIdx], sx - s, sy - s, s * 2, s * 2);
        } else {
          const r = Math.max(0.75, p.size * scale * 0.62);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (node.type === 'galaxyStar') {
        const gf = node.gf;
        const depthAlpha = Math.max(0.18, Math.min(0.95, 1.45 - z * 0.11));
        const tw = 0.45 + 0.55 * Math.sin(t * gf.swaySpeed + gf.swayPhase);
        const alpha = depthAlpha * tw * (gf.isRiver ? 0.92 : 0.78);

        if (gf.glowy) {
          const s = Math.max(2.2, gf.size * scale * 1.45);
          ctx.globalAlpha = alpha;
          ctx.drawImage(STAR_SPRITES[gf.spriteIdx], sx - s, sy - s, s * 2, s * 2);
        } else {
          const r = Math.max(0.7, gf.size * scale * 0.48);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = gf.color;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (node.type === 'floatingHeart') {
        const fh = node.fh;
        const depthAlpha = Math.max(0.2, Math.min(0.9, 1.42 - z * 0.11)) * fh.alpha;
        const s = Math.max(6, fh.size * scale * 0.85);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(fh.rot);
        ctx.globalAlpha = depthAlpha;
        ctx.drawImage(HEART_SPRITES[fh.spriteIdx], -s, -s, s * 2, s * 2);
        ctx.restore();
      } else if (node.type === 'orbitPhoto') {
        const cardW = unitScale * 0.64 * scale;
        const cardH = cardW * (300 / 252);
        const depthAlpha = Math.max(0.38, Math.min(1, 1.56 - z * 0.13)) * node.alphaMul;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(node.tilt);
        ctx.scale(node.yawCos, 1);
        ctx.globalAlpha = depthAlpha;
        ctx.drawImage(node.photo.card, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();

        clickableCards.push({ x: sx, y: sy, w: cardW * node.yawCos, h: cardH, src: node.photo.src });
      } else if (node.type === 'fallingPhoto') {
        const cardW = unitScale * 0.54 * scale * node.scaleMul;
        const cardH = cardW * (300 / 252);
        let fadeEdge = 1;
        if (node.yWorld < -worldSpanY + 0.7) fadeEdge = Math.max(0, (node.yWorld + worldSpanY + 0.5) / 1.2);
        else if (node.yWorld > worldSpanY - 0.7) fadeEdge = Math.max(0, (worldSpanY + 0.6 - node.yWorld) / 1.3);
        const depthAlpha = Math.max(0.24, Math.min(0.95, 1.46 - z * 0.12)) * fadeEdge;

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

    // 5. HỆ THỐNG PHÁO HOA RỰC RỠ TOÀN MÀN HÌNH (Chớp sáng + Đạn bay lên + Tia pháo hoa liễu rủ & trái tim)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 5a. Chớp hào quang mềm tại tâm pháo hoa vừa nổ
    for (let i = fireworkFlashes.length - 1; i >= 0; i -= 1) {
      const fl = fireworkFlashes[i];
      fl.life += dt;
      if (fl.life >= fl.maxLife) {
        fireworkFlashes.splice(i, 1);
        continue;
      }
      const p = fl.life / fl.maxLife;
      const alpha = (1 - p) * 0.42;
      const g = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r * (0.6 + p * 0.5));
      g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      g.addColorStop(0.4, `rgba(96, 195, 255, ${alpha * 0.55})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r * (0.6 + p * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // 5b. Đạn pháo hoa bay vọt từ dưới lên rồi phát nổ
    for (let i = fireworkRockets.length - 1; i >= 0; i -= 1) {
      const rk = fireworkRockets[i];
      rk.life += dt;
      const p = Math.min(1, rk.life / rk.maxLife);
      const ease = 1 - Math.pow(1 - p, 2.2);
      rk.x = rk.sx + (rk.tx - rk.sx) * ease + Math.sin(p * Math.PI * 2) * 8;
      rk.y = rk.sy + (rk.ty - rk.sy) * ease;
      rk.trail.push([rk.x, rk.y]);
      if (rk.trail.length > 6) rk.trail.shift();

      if (rk.trail.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(rk.trail[0][0], rk.trail[0][1]);
        for (let k = 1; k < rk.trail.length; k += 1) {
          ctx.lineTo(rk.trail[k][0], rk.trail[k][1]);
        }
        ctx.strokeStyle = rk.color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.drawImage(STAR_SPRITES[0], rk.x - 6, rk.y - 6, 12, 12);

      if (rk.life >= rk.maxLife) {
        detonateFirework(rk.tx, rk.ty, rk.forceStyle);
        fireworkRockets.splice(i, 1);
      }
    }

    // 5c. Các chùm tia pháo hoa nở bung kéo đuôi cong mềm mại + nhấp nháy kim tuyến cuối đuôi
    for (let i = fireworkSparks.length - 1; i >= 0; i -= 1) {
      const sp = fireworkSparks[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        fireworkSparks.splice(i, 1);
        continue;
      }

      const dragFactor = Math.pow(sp.drag, dt * 60);
      sp.vx *= dragFactor;
      sp.vy = sp.vy * dragFactor + sp.gravity * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      sp.trail.push([sp.x, sp.y]);
      if (sp.trail.length > 7) sp.trail.shift();

      const prog = sp.life / sp.maxLife;
      let alpha = prog < 0.12 ? prog / 0.12 : Math.pow(1 - (prog - 0.12) / 0.88, 1.35);

      // Hiệu ứng nổ tí tách lấp lánh (crackle strobe) ở nửa cuối quỹ đạo pháo hoa
      if (sp.crackle && prog > 0.52) {
        alpha *= 0.35 + 0.65 * Math.abs(Math.sin(sp.life * 38 + i));
      }

      if (sp.trail.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(sp.trail[0][0], sp.trail[0][1]);
        for (let k = 1; k < sp.trail.length; k += 1) {
          ctx.lineTo(sp.trail[k][0], sp.trail[k][1]);
        }
        ctx.strokeStyle = sp.color;
        ctx.globalAlpha = alpha * 0.78;
        ctx.lineWidth = sp.size * (1 - prog * 0.45);
        ctx.stroke();
      }

      // Đầu tia pháo hoa phát sáng lấp lánh
      const headR = Math.max(2.2, sp.size * 2.4 * (1 - prog * 0.4));
      ctx.globalAlpha = alpha;
      ctx.drawImage(STAR_SPRITES[i % STAR_SPRITES.length], sp.x - headR, sp.y - headR, headR * 2, headR * 2);
    }

    // 5d. Hạt tia sáng phụ khi chạm màn hình
    for (let i = tapSparks.length - 1; i >= 0; i -= 1) {
      const b = tapSparks[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        tapSparks.splice(i, 1);
        continue;
      }
      b.px = b.x;
      b.py = b.y;
      b.vx *= Math.pow(b.drag, dt * 60);
      b.vy = b.vy * Math.pow(b.drag, dt * 60) + b.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const prog = b.life / b.maxLife;
      const alpha = 1 - prog;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = b.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
