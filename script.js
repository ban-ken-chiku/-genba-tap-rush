const field = document.querySelector("#field");
const target = document.querySelector("#target");
const timeText = document.querySelector("#time");
const scoreText = document.querySelector("#score");
const comboText = document.querySelector("#combo");
const feverText = document.querySelector("#feverText");
const feverBar = document.querySelector("#feverBar");
const message = document.querySelector("#message");
const startPanel = document.querySelector("#startPanel");
const resultPanel = document.querySelector("#resultPanel");
const startButton = document.querySelector("#start");
const retryButton = document.querySelector("#retry");
const backHomeButton = document.querySelector("#backHome");
const soundToggle = document.querySelector("#soundToggle");
const resultTitle = document.querySelector("#resultTitle");
const resultScore = document.querySelector("#resultScore");
const resultText = document.querySelector("#resultText");
const bestText = document.querySelector("#best");
const floatLayer = document.querySelector("#floatLayer");
const topList = document.querySelector("#topList");
const resultTopList = document.querySelector("#resultTopList");

const storageKey = "genba-tap-rush-best-v2";
const rankingKey = "genba-tap-rush-ranking-v1";
let duration = 20;
let state = resetState();
let rafId = 0;
let audio = null;
let soundEnabled = true;
let musicTimer = 0;
let musicStep = 0;

const text = {
  miss: "\u30df\u30b9\u30bf\u30c3\u30d7\u3002\u4e38\u3044\u7684\u3060\u3051\u3092\u72d9\u3046\u3068\u4f38\u3073\u307e\u3059\u3002",
  start: "\u65bd\u5de5\u958b\u59cb\u3002\u9023\u7d9a\u30d2\u30c3\u30c8\u3067\u30d5\u30a3\u30fc\u30d0\u30fc\u3092\u72d9\u3048\u3002",
  fever: "\u30d5\u30a3\u30fc\u30d0\u30fc\u3002\u4eca\u3060\u3051\u5f97\u70b92\u500d\u3002",
  hit: "\u30ca\u30a4\u30b9\u30d2\u30c3\u30c8\u3002",
  end: "\u7d42\u4e86\u3002\u3082\u3046\u4e00\u56de\u3067\u518d\u6311\u6226\u3067\u304d\u307e\u3059\u3002",
  best: "\u30d9\u30b9\u30c8\u66f4\u65b0",
  done: "\u304a\u3064\u304b\u308c\u3055\u307e",
  point: "\u70b9",
  bestMessage: "\u5bb6\u65cf\u5185\u30e9\u30f3\u30ad\u30f3\u30b0\u306b\u8f09\u305b\u305f\u3044\u8a18\u9332\u3067\u3059\u3002",
  fast: "\u304b\u306a\u308a\u901f\u3044\u3067\u3059\u3002\u30d5\u30a3\u30fc\u30d0\u30fc\u7ba1\u7406\u304c\u4e0a\u624b\u3044\u3002",
  good: "\u3044\u3044\u65bd\u5de5\u30da\u30fc\u30b9\u3002\u6b21\u306f\u30b3\u30f3\u30dc\u7dad\u6301\u3067\u4f38\u3073\u307e\u3059\u3002",
  normal: "\u307e\u305a\u306f\u30df\u30b9\u30bf\u30c3\u30d7\u3092\u6e1b\u3089\u3059\u3068\u4e00\u6c17\u306b\u4e0a\u304c\u308a\u307e\u3059\u3002",
  soundOn: "\u97f3 ON",
  soundOff: "\u97f3 OFF",
  noRecord: "\u307e\u3060\u8a18\u9332\u306a\u3057",
};

refreshRanking();
timeText.textContent = duration.toFixed(1);

document.querySelectorAll(".duration").forEach((button) => {
  button.addEventListener("click", () => {
    duration = Number(button.dataset.time);
    document.querySelectorAll(".duration").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    timeText.textContent = duration.toFixed(1);
    playBlip(420, 0.04, "sine", 0.04);
  });
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? text.soundOn : text.soundOff;
  if (!soundEnabled) stopMusic();
  if (soundEnabled) playBlip(560, 0.08, "triangle", 0.04);
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
backHomeButton.addEventListener("click", backHome);

target.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (!state.running) return;
  hit(event.clientX, event.clientY);
});

field.addEventListener("pointerdown", (event) => {
  if (!state.running || event.target === target || target.contains(event.target)) return;
  state.combo = 0;
  state.fever = Math.max(0, state.fever - 12);
  message.textContent = text.miss;
  playBlip(120, 0.08, "sawtooth", 0.035);
  updateHud();
});

window.addEventListener("resize", () => {
  if (state.running) moveTarget();
});

function resetState() {
  return {
    running: false,
    score: 0,
    combo: 0,
    fever: 0,
    feverUntil: 0,
    size: 118,
    endsAt: 0,
  };
}

function startGame() {
  cancelAnimationFrame(rafId);
  ensureAudio();
  state = resetState();
  state.running = true;
  state.endsAt = performance.now() + duration * 1000;
  document.body.classList.remove("fever");
  startPanel.hidden = true;
  resultPanel.hidden = true;
  target.disabled = false;
  message.textContent = text.start;
  resizeTarget();
  moveTarget();
  updateHud();
  startMusic();
  playStartSound();
  rafId = requestAnimationFrame(tick);
}

function tick(now) {
  if (!state.running) return;
  const remaining = Math.max(0, state.endsAt - now);
  timeText.textContent = (remaining / 1000).toFixed(1);

  if (now > state.feverUntil) {
    document.body.classList.remove("fever");
  }

  if (remaining <= 0) {
    finishGame();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function hit(x, y) {
  const now = performance.now();
  const feverActive = now <= state.feverUntil;
  const comboBonus = Math.min(30, state.combo);
  const point = (10 + comboBonus) * (feverActive ? 2 : 1);

  state.score += point;
  state.combo += 1;
  state.fever = Math.min(100, state.fever + 10 + Math.floor(state.combo / 10));

  if (state.fever >= 100) {
    state.fever = 0;
    state.feverUntil = now + 3600;
    document.body.classList.add("fever");
    message.textContent = text.fever;
    playFeverSound();
  } else if (state.combo % 15 === 0) {
    message.textContent = `${state.combo}\u30b3\u30f3\u30dc\u3002\u3044\u3044\u6d41\u308c\u3067\u3059\u3002`;
    playBlip(760, 0.08, "triangle", 0.055);
  } else {
    message.textContent = text.hit;
    playBlip(360 + Math.min(state.combo * 8, 240), 0.04, "square", 0.035);
  }

  target.classList.add("hit");
  window.setTimeout(() => target.classList.remove("hit"), 70);
  showFloat(x, y, `+${point}`);
  resizeTarget();
  moveTarget();
  updateHud();
}

function resizeTarget() {
  const base = window.innerWidth < 430 ? 116 : 126;
  state.size = base - Math.min(34, state.combo * 0.5);
  target.style.width = `${state.size}px`;
  target.style.height = `${state.size}px`;
}

function moveTarget() {
  const rect = field.getBoundingClientRect();
  const margin = state.size / 2 + 18;
  const minY = Math.max(92, rect.height * 0.2);
  const maxY = rect.height - Math.max(112, rect.height * 0.16);
  const x = random(margin, rect.width - margin);
  const y = random(minY, maxY);
  target.style.left = `${x}px`;
  target.style.top = `${y}px`;
}

function finishGame() {
  state.running = false;
  target.disabled = true;
  document.body.classList.remove("fever");
  stopMusic();
  playFinishSound();

  const best = getBestScore();
  const isBest = state.score > best;
  saveScore(state.score, duration);
  if (isBest) {
    localStorage.setItem(storageKey, String(state.score));
    bestText.textContent = state.score;
  }

  resultTitle.textContent = isBest ? text.best : text.done;
  resultScore.textContent = `${state.score} ${text.point}`;
  resultText.textContent = resultMessage(state.score / duration, isBest);
  refreshRanking();
  resultPanel.hidden = false;
  message.textContent = text.end;
}

function backHome() {
  cancelAnimationFrame(rafId);
  stopMusic();
  state = resetState();
  target.disabled = true;
  document.body.classList.remove("fever");
  resultPanel.hidden = true;
  startPanel.hidden = false;
  timeText.textContent = duration.toFixed(1);
  scoreText.textContent = "0";
  comboText.textContent = "0";
  feverText.textContent = "0%";
  feverBar.style.width = "0%";
  message.textContent = "\u30b9\u30bf\u30fc\u30c8\u3092\u62bc\u3057\u3066\u958b\u59cb\u3002\u97f3\u304c\u51fa\u307e\u3059\u3002";
  refreshRanking();
}

function updateHud() {
  scoreText.textContent = state.score;
  comboText.textContent = state.combo;
  feverText.textContent = `${state.fever}%`;
  feverBar.style.width = `${state.fever}%`;
}

function showFloat(x, y, value) {
  const rect = field.getBoundingClientRect();
  const item = document.createElement("span");
  item.className = "float-score";
  item.textContent = value;
  item.style.left = `${x - rect.left}px`;
  item.style.top = `${y - rect.top}px`;
  floatLayer.append(item);
  window.setTimeout(() => item.remove(), 700);
}

function resultMessage(pointPerSecond, isBest) {
  if (isBest) return text.bestMessage;
  if (pointPerSecond >= 36) return text.fast;
  if (pointPerSecond >= 24) return text.good;
  return text.normal;
}

function saveScore(score, seconds) {
  const ranking = getRanking();
  ranking.push({ score, seconds, date: Date.now() });
  ranking.sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.date - b.date);
  localStorage.setItem(rankingKey, JSON.stringify(ranking.slice(0, 10)));
}

function getRanking() {
  try {
    const saved = JSON.parse(localStorage.getItem(rankingKey));
    return Array.isArray(saved)
      ? saved.filter((item) => Number.isFinite(item.score) && Number.isFinite(item.seconds))
      : [];
  } catch {
    return [];
  }
}

function getBestScore() {
  const rankingBest = getRanking()[0]?.score || 0;
  const oldBest = Number(localStorage.getItem(storageKey) || 0);
  return Math.max(rankingBest, oldBest);
}

function refreshRanking() {
  const ranking = getRanking();
  bestText.textContent = getBestScore();
  renderRanking(topList, ranking);
  renderRanking(resultTopList, ranking);
}

function renderRanking(list, ranking) {
  if (!list) return;
  list.textContent = "";
  if (ranking.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-rank";
    empty.textContent = text.noRecord;
    list.append(empty);
    return;
  }

  ranking.forEach((item) => {
    const row = document.createElement("li");
    const score = document.createElement("strong");
    const meta = document.createElement("span");
    score.textContent = `${item.score} ${text.point}`;
    meta.textContent = `${item.seconds}\u79d2`;
    row.append(score, meta);
    list.append(row);
  });
}

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

function playBlip(frequency, seconds, type = "sine", gainValue = 0.05) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}

function playStartSound() {
  [440, 660, 880].forEach((note, index) => {
    window.setTimeout(() => playBlip(note, 0.08, "triangle", 0.045), index * 70);
  });
}

function playFeverSound() {
  [620, 780, 980, 1240].forEach((note, index) => {
    window.setTimeout(() => playBlip(note, 0.08, "triangle", 0.055), index * 55);
  });
}

function playFinishSound() {
  [880, 660, 440].forEach((note, index) => {
    window.setTimeout(() => playBlip(note, 0.1, "sine", 0.05), index * 90);
  });
}

function startMusic() {
  stopMusic();
  if (!soundEnabled) return;
  const notes = [196, 247, 294, 247, 196, 247, 330, 294];
  musicTimer = window.setInterval(() => {
    const fever = performance.now() <= state.feverUntil;
    const note = notes[musicStep % notes.length] * (fever ? 2 : 1);
    playBlip(note, 0.11, "triangle", fever ? 0.045 : 0.025);
    musicStep += 1;
  }, 190);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  musicStep = 0;
}

function random(min, max) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}
