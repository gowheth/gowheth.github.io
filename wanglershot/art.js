export const SYMBOL_EMOJI = {
  'camera': '📷', 'mountain.2.fill': '🏔️', 'building.2.fill': '🌃', 'moon.fill': '🌕', 'ferry.fill': '⛴️',
  'sparkles': '✨', 'drop.fill': '💧', 'water.waves': '🌊', 'airplane': '✈️', 'bird.fill': '🐦',
  'pawprint.fill': '🐾', 'sun.max.fill': '☀️', 'cloud.sun.fill': '⛅', 'leaf.fill': '🍃', 'car.fill': '🚗',
  'figure.walk': '🚶', 'flame.fill': '🔥', 'snowflake': '❄️', 'camera.macro': '🌷', 'person.fill': '🧑', 'sun.horizon.fill': '🌅'
};

export const emojiFor = symbol => SYMBOL_EMOJI[symbol] ?? (symbol && [...symbol].length <= 2 ? symbol : '📷');

const PALETTE = [['#3b82f6', '#0e7490'], ['#7c3aed', '#1e1b4b'], ['#f59e0b', '#1e3a8a'], ['#10b981', '#064e3b'], ['#ec4466', '#4c1433'], ['#06b6d4', '#164e63']];

function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (lo, hi) => lo + (hi - lo) * next() };
}

const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) | 0, 7) >>> 0;

function vgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}

function glow(c, blur, fn) {
  c.save();
  c.filter = `blur(${blur}px)`;
  fn();
  c.restore();
}

function ellipse(c, x, y, w, h, fill) {
  c.beginPath();
  c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

function poly(c, pts, fill) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => c.lineTo(p[0], p[1]));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

function stars(c, w, h, n, r) {
  for (let i = 0; i < n; i++) {
    const s = r.range(0.8, 2.2);
    c.globalAlpha = r.range(0.4, 1);
    ellipse(c, r.range(0, w), r.range(0, h), s, s, '#fff');
  }
  c.globalAlpha = 1;
}

function bird(c, x, y, s, fill, flying) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = fill;
  c.beginPath();
  if (flying) {
    c.moveTo(-1, 0);
    c.quadraticCurveTo(-0.5, -0.5, 0, 0.05);
    c.quadraticCurveTo(0.5, -0.5, 1, 0);
    c.quadraticCurveTo(0.5, -0.25, 0, 0.25);
    c.quadraticCurveTo(-0.5, -0.25, -1, 0);
  } else {
    c.ellipse(0, 0, 0.55, 0.38, -0.3, 0, Math.PI * 2);
    c.moveTo(0.55, -0.45);
    c.arc(0.42, -0.42, 0.22, 0, Math.PI * 2);
    c.moveTo(0.6, -0.48);
    c.lineTo(0.9, -0.42);
    c.lineTo(0.6, -0.36);
    c.moveTo(-0.45, 0.05);
    c.lineTo(-1.05, 0.35);
    c.lineTo(-0.5, 0.25);
  }
  c.fill();
  c.restore();
}

function plane(c, x, y, s, angle, fill) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(s, s);
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(0, 0, 1, 0.11, 0, 0, Math.PI * 2);
  c.fill();
  poly(c, [[-0.15, 0], [0.25, 0], [-0.25, 0.85], [-0.45, 0.85]], fill);
  poly(c, [[-0.15, 0], [0.25, 0], [-0.25, -0.85], [-0.45, -0.85]], fill);
  poly(c, [[-0.8, 0], [-0.65, 0], [-0.9, 0.35], [-1.02, 0.35]], fill);
  poly(c, [[-0.8, 0], [-0.65, 0], [-0.9, -0.35], [-1.02, -0.35]], fill);
  c.restore();
}

const SCENES = {
  'ocean-landscape-day'(c, w, h) {
    vgrad(c, 0, 0, w, h * 0.62, ['#3f8ced', '#c7e3ff']);
    glow(c, 12, () => ellipse(c, w * 0.68, h * 0.12, w * 0.16, w * 0.16, 'rgba(255,240,180,0.9)'));
    ellipse(c, w * 0.68, h * 0.12, w * 0.16, w * 0.16, '#fffad9');
    poly(c, [[0, h * 0.6], [w * 0.18, h * 0.4], [w * 0.32, h * 0.5], [w * 0.52, h * 0.3], [w * 0.74, h * 0.52], [w, h * 0.42], [w, h * 0.62], [0, h * 0.62]], '#4d6b8c');
    poly(c, [[0, h * 0.62], [w * 0.12, h * 0.5], [w * 0.3, h * 0.62]], '#294d40');
    vgrad(c, 0, h * 0.6, w, h * 0.4, ['#1a8ca6', '#08386b']);
    for (let i = 0; i < 6; i++) {
      const y = h * (0.66 + i * 0.055);
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y - 5, w * 0.7, y + 5, w, y);
      c.strokeStyle = `rgba(255,255,255,${0.18 + i * 0.05})`;
      c.lineWidth = 1.2;
      c.stroke();
    }
  },
  'street-night'(c, w, h, r) {
    vgrad(c, 0, 0, w, h, ['#0d1033', '#401f59']);
    const ground = h * 0.78;
    let x = -4;
    while (x < w) {
      const bw = w * r.range(0.13, 0.24), bh = h * r.range(0.35, 0.72);
      c.fillStyle = '#0a0d1a';
      c.fillRect(x, ground - bh, bw, bh);
      for (let wy = ground - bh + 8; wy < ground - 10; wy += 10) {
        for (let wx = x + 5; wx < x + bw - 8; wx += 8) {
          if (r.next() < 0.38) {
            c.fillStyle = r.next() < 0.7 ? 'rgba(255,199,89,0.9)' : 'rgba(153,217,255,0.8)';
            c.fillRect(wx, wy, 4, 5);
          }
        }
      }
      x += bw + 2;
    }
    vgrad(c, 0, ground, w, h - ground, ['#14141f', '#05050d']);
    for (let i = 0; i < 7; i++) {
      const rx = r.range(0, w), len = (h - ground) * r.range(0.5, 0.95);
      glow(c, 3, () => { c.fillStyle = 'rgba(255,179,77,0.55)'; c.fillRect(rx, ground + 2, 3, len); });
    }
    const lx = w * 0.82;
    c.fillStyle = '#26262e';
    c.fillRect(lx, h * 0.42, 3, ground - h * 0.42);
    glow(c, 10, () => ellipse(c, lx - 14, h * 0.4 - 14, 31, 28, 'rgba(255,166,64,0.85)'));
    ellipse(c, lx - 3, h * 0.4 - 3, 9, 7, '#ffebb3');
  },
  'moon'(c, w, h, r) {
    vgrad(c, 0, 0, w, h, ['#000005', '#080d1f']);
    stars(c, w, h, 45, r);
    const rad = Math.min(w, h) * 0.32, cx = w * 0.52, cy = h * 0.48;
    glow(c, 18, () => ellipse(c, cx - rad, cy - rad, rad * 2, rad * 2, 'rgba(230,230,217,0.35)'));
    const g = c.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, 0, cx - rad * 0.3, cy - rad * 0.3, rad * 1.4);
    g.addColorStop(0, '#f5f2e6');
    g.addColorStop(1, '#b8b5ad');
    c.save();
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.clip();
    for (let i = 0; i < 16; i++) {
      const cr = rad * r.range(0.05, 0.2), a = r.range(0, Math.PI * 2), d = rad * r.range(0, 0.85);
      ellipse(c, cx + Math.cos(a) * d - cr, cy + Math.sin(a) * d - cr, cr * 2, cr * 2, `rgba(115,115,110,${r.range(0.25, 0.5)})`);
    }
    ellipse(c, cx - rad * 0.55, cy - rad * 0.7, rad * 0.8, rad * 0.6, 'rgba(128,128,122,0.3)');
    ellipse(c, cx + rad * 0.45, cy - rad * 1.1, rad * 1.6, rad * 2.2, 'rgba(0,0,0,0.55)');
    c.restore();
  },
  'ferry-night-timelapse'(c, w, h, r) {
    const hz = h * 0.55;
    vgrad(c, 0, 0, w, hz, ['#080d2e', '#33265a', '#d96b2e']);
    stars(c, w, hz * 0.5, 14, r);
    poly(c, [[0, hz], [0, hz - 10], [w * 0.35, hz - 6], [w * 0.6, hz - 14], [w, hz - 8], [w, hz]], '#0a0a14');
    for (let i = 0; i < 14; i++) ellipse(c, r.range(0, w), hz - r.range(4, 12), 2, 2, '#ffd980');
    vgrad(c, 0, hz, w, h - hz, ['#1a1a38', '#03050f']);
    const deck = h * 0.66;
    glow(c, 2.5, () => { c.fillStyle = 'rgba(255,191,102,0.9)'; c.fillRect(0, deck + 2, w * 0.42, 3); });
    glow(c, 2, () => { c.fillStyle = 'rgba(255,242,217,0.7)'; c.fillRect(0, deck + 8, w * 0.4, 2); });
    poly(c, [[w * 0.38, deck - 8], [w * 0.86, deck - 8], [w * 0.8, deck + 8], [w * 0.43, deck + 8]], '#0f0f1a');
    c.fillStyle = '#171724';
    c.fillRect(w * 0.45, deck - 20, w * 0.34, 12);
    c.fillRect(w * 0.55, deck - 29, w * 0.12, 9);
    for (let wx = w * 0.47; wx < w * 0.77; wx += 6) {
      c.fillStyle = '#ffd973';
      c.fillRect(wx, deck - 16, 3, 3);
      c.fillStyle = 'rgba(255,204,102,0.8)';
      c.fillRect(wx, deck - 4, 3, 2);
    }
    for (let i = 0; i < 5; i++) {
      glow(c, 2, () => { c.fillStyle = `rgba(255,191,89,${0.35 - i * 0.05})`; c.fillRect(w * 0.45, deck + 14 + i * 7, w * 0.32, 2); });
    }
  },
  'star-trails'(c, w, h, r) {
    vgrad(c, 0, 0, w, h, ['#00030d', '#0a1233']);
    const px = w * 0.55, py = h * 0.2;
    for (let i = 0; i < 90; i++) {
      const rad = r.range(4, Math.max(w, h) * 1.1), start = r.range(0, Math.PI * 2);
      c.beginPath();
      c.arc(px, py, rad, start, start + r.range(0.49, 0.84));
      const t = r.next();
      const col = t < 0.6 ? '230,237,255' : t < 0.82 ? '153,191,255' : '255,199,140';
      c.strokeStyle = `rgba(${col},${r.range(0.35, 0.95)})`;
      c.lineWidth = r.range(0.6, 1.6);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, h);
    c.lineTo(0, h * 0.82);
    c.bezierCurveTo(w * 0.35, h * 0.72, w * 0.65, h * 0.92, w, h * 0.86);
    c.lineTo(w, h);
    c.fillStyle = '#000';
    c.fill();
    for (const t of [0.12, 0.2, 0.27]) poly(c, [[w * t, h * 0.66], [w * t + 8, h * 0.82], [w * t - 8, h * 0.82]], '#000');
  },
  'waterfall-le'(c, w, h, r) {
    vgrad(c, 0, 0, w, h, ['#1f5233', '#0a2417']);
    for (let i = 0; i < 18; i++) {
      const rad = r.range(10, 28), x = r.range(-10, w), y = r.range(-10, h * 0.35), gg = Math.round(r.range(115, 153));
      glow(c, 4, () => ellipse(c, x, y, rad * 2, rad * 2, `rgba(51,${gg},64,0.7)`));
    }
    c.fillStyle = '#2e3333';
    c.fillRect(0, h * 0.12, w * 0.38, h * 0.7);
    c.fillStyle = '#262b2b';
    c.fillRect(w * 0.62, h * 0.12, w * 0.38, h * 0.7);
    glow(c, 3, () => {
      const g = c.createLinearGradient(w * 0.38, 0, w * 0.62, 0);
      g.addColorStop(0, '#d9f2ff');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, '#e6f7ff');
      c.fillStyle = g;
      c.fillRect(w * 0.38, h * 0.1, w * 0.24, h * 0.68);
    });
    vgrad(c, 0, h * 0.8, w, h * 0.2, ['#408c8c', '#144047']);
    glow(c, 12, () => ellipse(c, w * 0.25, h * 0.7, w * 0.5, h * 0.18, 'rgba(255,255,255,0.75)'));
    ellipse(c, w * 0.05, h * 0.86, w * 0.22, h * 0.1, '#1a1f1f');
    ellipse(c, w * 0.7, h * 0.88, w * 0.28, h * 0.1, '#1a1f1f');
  },
  'ocean-le'(c, w, h) {
    const hz = h * 0.58;
    vgrad(c, 0, 0, w, hz, ['#6b73ad', '#e0a8b3', '#fad1b3']);
    for (let i = 0; i < 6; i++) {
      const y = h * (0.08 + i * 0.08);
      glow(c, 6, () => poly(c, [[w * 0.5, hz - 10], [-w * 0.2 + i * w * 0.25, y], [-w * 0.1 + i * w * 0.25, y]], 'rgba(255,255,255,0.28)'));
    }
    vgrad(c, 0, hz, w, h - hz, ['#b8bddb', '#6680a8']);
    glow(c, 2, () => { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(0, hz - 1, w, 3); });
    poly(c, [[w * 0.56, h], [w * 0.6, h * 0.72], [w * 0.68, h * 0.64], [w * 0.8, h * 0.66], [w * 0.88, h * 0.78], [w * 0.92, h]], '#14141f');
    glow(c, 10, () => ellipse(c, w * 0.45, h * 0.88, w * 0.6, h * 0.14, 'rgba(255,255,255,0.55)'));
  },
  'airplanes-day'(c, w, h) {
    vgrad(c, 0, 0, w, h, ['#296bd9', '#9ed1fa']);
    glow(c, 10, () => ellipse(c, -w * 0.1, h * 0.62, w * 0.6, h * 0.22, 'rgba(255,255,255,0.8)'));
    glow(c, 10, () => ellipse(c, w * 0.55, h * 0.72, w * 0.6, h * 0.2, 'rgba(255,255,255,0.7)'));
    glow(c, 5, () => poly(c, [[-10, h * 0.78], [w * 0.42, h * 0.48], [w * 0.4, h * 0.52], [-10, h * 0.86]], 'rgba(255,255,255,0.45)'));
    plane(c, w * 0.58, h * 0.4, Math.min(w, h) * 0.3, -0.5, '#f2f5ff');
  },
  'wildlife-day'(c, w, h, r) {
    vgrad(c, 0, 0, w, h, ['#8cb8d9', '#f2d999']);
    for (let i = 0; i < 14; i++) {
      const rad = r.range(12, 30), x = r.range(-10, w), y = r.range(h * 0.6, h), gg = Math.round(r.range(102, 140));
      glow(c, 8, () => ellipse(c, x, y, rad * 2, rad * 2, `rgba(64,${gg},51,0.75)`));
    }
    c.beginPath();
    c.moveTo(-5, h * 0.8);
    c.bezierCurveTo(w * 0.3, h * 0.7, w * 0.6, h * 0.72, w * 0.85, h * 0.66);
    c.strokeStyle = '#4d331f';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.stroke();
    bird(c, w * 0.52, h * 0.6, Math.min(w, h) * 0.14, '#59381f', false);
    for (let i = 0; i < 3; i++) bird(c, w * (0.18 + i * 0.14), h * (0.16 + i * 0.06), Math.min(w, h) * (0.06 - i * 0.01), 'rgba(51,51,64,0.8)', true);
  },
  'sunset'(c, w, h) {
    const hz = h * 0.6;
    vgrad(c, 0, 0, w, hz, ['#2b1a4f', '#a8336b', '#f2703a', '#ffc35c']);
    const sx = w * 0.5, sr = Math.min(w, h) * 0.17;
    glow(c, 22, () => ellipse(c, sx - sr * 2, hz - sr * 2, sr * 4, sr * 4, 'rgba(255,190,90,0.55)'));
    c.save();
    c.beginPath();
    c.rect(0, 0, w, hz);
    c.clip();
    ellipse(c, sx - sr, hz - sr * 0.9, sr * 2, sr * 2, '#ffe39a');
    c.restore();
    for (let i = 0; i < 4; i++) {
      glow(c, 4, () => ellipse(c, w * (0.05 + i * 0.25), h * (0.14 + (i % 2) * 0.1), w * 0.35, h * 0.05, 'rgba(255,140,120,0.45)'));
    }
    vgrad(c, 0, hz, w, h - hz, ['#6b2c4a', '#1a0f24']);
    for (let i = 0; i < 9; i++) {
      const y = hz + 4 + i * (h - hz) / 10, half = sr * (1.1 - i * 0.08);
      glow(c, 1.5, () => { c.fillStyle = `rgba(255,205,120,${0.75 - i * 0.07})`; c.fillRect(sx - half, y, half * 2, 2); });
    }
    poly(c, [[0, hz + 2], [0, h * 0.42], [w * 0.1, h * 0.46], [w * 0.2, h * 0.52], [w * 0.3, hz + 2]], '#120a14');
    c.strokeStyle = '#120a14';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w * 0.86, hz + 2);
    c.quadraticCurveTo(w * 0.84, h * 0.4, w * 0.8, h * 0.3);
    c.stroke();
    for (const a of [-2.6, -2.2, -1.6, -1.0, -0.5]) {
      c.beginPath();
      c.moveTo(w * 0.8, h * 0.3);
      c.quadraticCurveTo(w * 0.8 + Math.cos(a) * 18, h * 0.3 + Math.sin(a) * 18 - 6, w * 0.8 + Math.cos(a) * 34, h * 0.3 + Math.sin(a) * 30 + 10);
      c.lineWidth = 2.5;
      c.stroke();
    }
  }
};

export function drawCover(canvas, id, symbol) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width || canvas.clientWidth || 300), h = Math.max(1, rect.height || canvas.clientHeight || 150);
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scene = SCENES[id];
  if (scene) {
    scene(c, w, h, rng(hash(id)));
    return;
  }
  const [a, b] = PALETTE[hash(id) % PALETTE.length];
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.font = `${Math.min(w, h) * 0.45}px system-ui, "Apple Color Emoji"`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emojiFor(symbol), w / 2, h / 2);
}
