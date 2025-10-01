// Music-reactive Galaxy Visualizer with 'upgrade' command
const canvas = document.getElementById("galaxy");
const ctx = canvas.getContext("2d");
const commandInput = document.getElementById("command");
const fileInput = document.getElementById("fileInput");
const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; createStars(starCount); });

let starCount = 250;
let stars = [];
let palette = ["#8A2BE2", "#00FFFF", "#FFD700", "#FF1493"];
let audioCtx = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let micStream = null;
let isPlaying = false;

// create initial stars
function randomColor() { return palette[Math.floor(Math.random() * palette.length)]; }
function createStars(count = 200) {
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.6 + Math.random() * 2.4,
      baseSpeed: 0.2 + Math.random() * 0.6,
      speed: 0,
      color: randomColor(),
      twinkle: Math.random()
    });
  }
}
createStars(starCount);

// draw loop
function draw() {
  // subtle trail effect
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0,0,W,H);

  // compute audio bands
  let bass = 0, mids = 0, highs = 0;
  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);
    const n = dataArray.length;
    const bEnd = Math.floor(n * 0.12);
    const mEnd = Math.floor(n * 0.55);
    for (let i = 0; i < n; i++) {
      const v = dataArray[i];
      if (i < bEnd) bass += v;
      else if (i < mEnd) mids += v;
      else highs += v;
    }
    bass = (bass / Math.max(1,bEnd)) / 255;
    mids = (mids / Math.max(1,mEnd-bEnd)) / 255;
    highs = (highs / Math.max(1,n-mEnd)) / 255;
    // gentle smoothing
    bass = Math.min(2, Math.pow(bass,0.9) * 1.3);
    mids = Math.min(2, Math.pow(mids,0.95) * 1.1);
    highs = Math.min(2, Math.pow(highs,0.9) * 1.2);
  }

  // draw stars
  for (let s of stars) {
    // speed influenced by bass
    s.speed = s.baseSpeed + bass * (1.6 + s.twinkle);
    s.y += s.speed * 6;
    // wrap
    if (s.y > H + 10) {
      s.y = -10;
      s.x = Math.random() * W;
      s.color = randomColor();
    }

    // size pulse with mids, shimmer with highs
    const size = s.size * (1 + mids * 0.8 + Math.sin(perfNow()*0.005 + s.twinkle*10)*0.06);
    const alpha = 0.4 + highs * 0.6 + Math.sin(perfNow()*0.01 + s.twinkle*4)*0.15;

    // draw glow
    ctx.beginPath();
    const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size * 6);
    // inner brighter color
    grd.addColorStop(0, hexToRgba(s.color, alpha));
    grd.addColorStop(0.25, hexToRgba(s.color, alpha*0.6));
    grd.addColorStop(0.6, hexToRgba(s.color, alpha*0.12));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(s.x - size*6, s.y - size*6, size*12, size*12);

    // small core
    ctx.fillStyle = hexToRgba("#ffffff", 0.8 * (0.4 + highs));
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(0.6, size*0.4), 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}
function perfNow(){ return performance.now(); }

// helpers
function hexToRgba(hex, alpha=1){
  const c = hex.replace('#','');
  const bigint = parseInt(c,16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Audio handling
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    const bins = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bins);
  }
}

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  stopAudio();
  ensureAudio();
  const arrayBuffer = await f.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);
  src.start();
  sourceNode = src;
  isPlaying = true;
});

micBtn.addEventListener('click', async () => {
  stopAudio();
  ensureAudio();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micSrc = audioCtx.createMediaStreamSource(micStream);
    micSrc.connect(analyser);
    sourceNode = micSrc;
    isPlaying = true;
  } catch (err) {
    alert('Microphone access denied or unavailable.');
  }
});

stopBtn.addEventListener('click', () => stopAudio());

function stopAudio(){
  try { if (sourceNode && sourceNode.stop) sourceNode.stop(); } catch(e){}
  if (micStream){ micStream.getTracks().forEach(t=>t.stop()); micStream = null; }
  sourceNode = null;
  analyser = null;
  dataArray = null;
  audioCtx = null;
  isPlaying = false;
}

// 'upgrade' command - simple AI-like palette regen
commandInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const cmd = e.target.value.trim().toLowerCase();
    if (cmd === 'upgrade') {
      // create a new palette of 3 contrasting hues
      const base = Math.floor(Math.random()*360);
      palette = [
        `hsl(${base}, 80%, 60%)`,
        `hsl(${(base+40)%360}, 80%, 55%)`,
        `hsl(${(base+200)%360}, 75%, 50%)`,
      ];
      createStars(starCount);
    }
    e.target.value = '';
  }
});

// start render
createStars(starCount);
draw();