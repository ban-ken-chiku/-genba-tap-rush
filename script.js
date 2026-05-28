const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const titleScreen = document.querySelector("#titleScreen");
const resultScreen = document.querySelector("#resultScreen");
const startButton = document.querySelector("#startButton");
const retryButton = document.querySelector("#retryButton");
const backTitleButton = document.querySelector("#backTitleButton");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");
const jumpButton = document.querySelector("#jumpButton");
const scoreText = document.querySelector("#scoreText");
const timeText = document.querySelector("#timeText");
const lifeText = document.querySelector("#lifeText");
const finalScore = document.querySelector("#finalScore");
const resultRank = document.querySelector("#resultRank");
const resultMessage = document.querySelector("#resultMessage");
const lastSpurtText = document.querySelector("#lastSpurtText");
const topScoresList = document.querySelector("#topScoresList");

const W = canvas.width;
const H = canvas.height;
const groundY = 440;
const gravity = 0.62;
const gameSeconds = 45;

const input = { left: false, right: false };
let mode = "title";
let lastTime = 0;
let spawnTimer = 0;
let effects = [];
let items = [];
let clouds = [];
let particles = [];
let player;
let score = 0;
let life = 3;
let timeLeft = gameSeconds;
let elapsed = 0;
let audioContext = null;
let musicTimer = 0;
let musicStep = 0;
let lastSpurt = false;
let topScores = [];

const itemTypes = [
  { name: "にこぷり", kind: "good", score: 100, color: "#b8753f", glow: "#ffd19a", weight: 1.2 },
  { name: "ゴールドぷり", kind: "good", score: 500, color: "#ffc928", glow: "#fff176", weight: 0.7 },
  { name: "レインボーぷり", kind: "good", score: 1000, color: "rainbow", glow: "#92f1ff", weight: 0.32 },
  { name: "ぷりスター", kind: "good", score: 300, color: "#ffb840", glow: "#fff176", weight: 0.52 },
  { name: "トゲぷり", kind: "bad", score: -200, color: "#67556f", weight: 0.42, damage: 1 },
  { name: "ネバぷり", kind: "bad", score: -100, color: "#8fae64", weight: 0.38, damage: 0 },
  { name: "バイキンぷり", kind: "bad", score: -200, color: "#8a718d", weight: 0.36, damage: 1 },
];

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
backTitleButton.addEventListener("click", backToTitle);

bindHold(leftButton, "left");
bindHold(rightButton, "right");
jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jumpButton.classList.add("is-down");
  jump();
});
jumpButton.addEventListener("pointerup", () => jumpButton.classList.remove("is-down"));
jumpButton.addEventListener("pointerleave", () => jumpButton.classList.remove("is-down"));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") input.left = true;
  if (event.key === "ArrowRight") input.right = true;
  if (event.code === "Space" || event.key === "ArrowUp") {
    event.preventDefault();
    if (mode === "title") startGame();
    else if (mode === "playing") jump();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") input.left = false;
  if (event.key === "ArrowRight") input.right = false;
});

initTitle();
requestAnimationFrame(loop);

function bindHold(button, key) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input[key] = true;
    button.classList.add("is-down");
  });
  button.addEventListener("pointerup", () => {
    input[key] = false;
    button.classList.remove("is-down");
  });
  button.addEventListener("pointerleave", () => {
    input[key] = false;
    button.classList.remove("is-down");
  });
  button.addEventListener("pointercancel", () => {
    input[key] = false;
    button.classList.remove("is-down");
  });
}

function initTitle() {
  document.body.classList.add("title-active");
  document.body.classList.remove("result-active", "playing-active");
  player = createPlayer();
  clouds = Array.from({ length: 5 }, (_, i) => ({
    x: i * 220 - 60,
    y: 68 + (i % 3) * 42,
    speed: 10 + i * 3,
    size: 0.7 + (i % 2) * 0.25,
  }));
  for (let i = 0; i < 40; i += 1) {
    particles.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3, speed: 6 + Math.random() * 18 });
  }
}

function startGame() {
  mode = "playing";
  document.body.classList.remove("title-active", "result-active");
  document.body.classList.add("playing-active");
  titleScreen.hidden = true;
  resultScreen.hidden = true;
  player = createPlayer();
  items = [];
  effects = [];
  score = 0;
  life = 3;
  timeLeft = gameSeconds;
  elapsed = 0;
  lastSpurt = false;
  lastSpurtText.hidden = true;
  spawnTimer = 0;
  updateHud();
  startMusic();
}

function createPlayer() {
  return {
    x: W * 0.5,
    y: groundY - 92,
    vx: 0,
    vy: 0,
    width: 86,
    height: 104,
    jumps: 0,
    facing: 1,
    spin: 0,
    doubleSpin: 0,
    mood: "normal",
    moodTimer: 0,
    squish: 0,
  };
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  updateBackground(dt);
  updateEffects(dt);
  if (mode !== "playing") return;

  elapsed += dt;
  timeLeft = Math.max(0, gameSeconds - elapsed);
  if (!lastSpurt && timeLeft <= 15) {
    lastSpurt = true;
    lastSpurtText.hidden = false;
    startMusic();
    playLastSpurtSound();
  }
  if (timeLeft <= 0 || life <= 0) {
    finishGame();
    return;
  }

  updatePlayer(dt);
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    const baseSpawn = Math.max(0.28, 0.78 - elapsed * 0.006);
    spawnTimer = lastSpurt ? baseSpawn / 1.3 : baseSpawn;
  }
  updateItems(dt);
  updateHud();
}

function updateBackground(dt) {
  clouds.forEach((cloud) => {
    cloud.x += cloud.speed * dt;
    if (cloud.x > W + 120) cloud.x = -220;
  });
  particles.forEach((p) => {
    p.y -= p.speed * dt;
    if (p.y < -10) {
      p.y = H + 10;
      p.x = Math.random() * W;
    }
  });
}

function updatePlayer(dt) {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speedBoost = lastSpurt ? 1.2 : 1;
  player.vx += move * 2310 * speedBoost * dt;
  player.vx *= 0.82;
  player.x += player.vx * dt;
  player.x = clamp(player.x, 46, W - 46);
  if (move) player.facing = move;

  player.vy += gravity * 60 * dt;
  player.y += player.vy * 60 * dt;
  const floorY = groundY - player.height * 0.72;
  if (player.y >= floorY) {
    if (player.vy > 0.2) {
      player.squish = 0.18;
      addDust(player.x, groundY);
    }
    player.y = floorY;
    player.vy = 0;
    player.jumps = 0;
    player.doubleSpin = 0;
  }

  player.spin += player.doubleSpin * dt;
  if (player.doubleSpin > 0) player.doubleSpin = Math.max(0, player.doubleSpin - dt * 5.5);
  player.moodTimer -= dt;
  if (player.moodTimer <= 0) player.mood = "normal";
  player.squish = Math.max(0, player.squish - dt * 1.8);
}

function jump() {
  if (mode !== "playing" || player.jumps >= 2) return;
  if (player.jumps === 0) {
    player.vy = -12.2;
    player.squish = 0.24;
    addEffect(player.x, player.y + 64, "jump");
  } else {
    player.vy = -11.2;
    player.doubleSpin = 1.15;
    player.spin = 0;
    player.mood = "fever";
    player.moodTimer = 0.45;
    addEffect(player.x, player.y + 20, "rainbow");
  }
  player.jumps += 1;
}

function spawnItem() {
  const total = itemTypes.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  let type = itemTypes[0];
  for (const candidate of itemTypes) {
    roll -= candidate.weight;
    if (roll <= 0) {
      type = candidate;
      break;
    }
  }

  items.push({
    type,
    x: 48 + Math.random() * (W - 96),
    y: -48,
    vy: 95 + Math.random() * 70 + elapsed * 0.9,
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 1.8,
    size: type.kind === "good" ? 48 + Math.random() * 14 : 50 + Math.random() * 10,
    wobble: Math.random() * Math.PI * 2,
  });
}

function updateItems(dt) {
  items.forEach((item) => {
    item.y += item.vy * dt * (lastSpurt ? 1.2 : 1);
    item.rot += item.spin * dt;
    item.wobble += dt * 5;
  });

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const hit = Math.hypot(item.x - player.x, item.y - (player.y + 45)) < item.size * 0.72 + 34;
    if (hit) {
      collectItem(item);
      items.splice(i, 1);
    } else if (item.y > H + 80) {
      items.splice(i, 1);
    }
  }
}

function collectItem(item) {
  score = Math.max(0, score + item.type.score);
  if (item.type.damage) life = Math.max(0, life - item.type.damage);
  player.mood = item.type.kind === "good" ? "happy" : "ouch";
  player.moodTimer = 0.42;
  player.squish = item.type.kind === "good" ? 0.12 : 0.28;
  addEffect(item.x, item.y, item.type.kind === "good" ? "catch" : "bad");
  playCatchSound(item.type.kind === "good", item.type.score);
}

function updateEffects(dt) {
  effects.forEach((effect) => {
    effect.life -= dt;
    effect.age += dt;
  });
  effects = effects.filter((effect) => effect.life > 0);
}

function addEffect(x, y, type) {
  effects.push({ x, y, type, life: 0.55, age: 0 });
}

function addDust(x, y) {
  effects.push({ x, y, type: "dust", life: 0.35, age: 0 });
}

function finishGame() {
  mode = "result";
  document.body.classList.remove("playing-active", "title-active");
  document.body.classList.add("result-active");
  stopMusic();
  resultScreen.hidden = false;
  lastSpurtText.hidden = true;
  topScores.push(score);
  topScores = topScores.sort((a, b) => b - a).slice(0, 3);
  finalScore.textContent = score.toLocaleString("ja-JP");
  const rank = score >= 14000 ? "S" : score >= 9000 ? "A" : score >= 5000 ? "B" : "C";
  resultRank.textContent = `ランク ${rank}`;
  resultMessage.textContent =
    rank === "S" ? "ぷりエネルギー集め名人。" : rank === "A" ? "かなりいい感じ。もう少しでS。" : "二段ジャンプでレアぷりをねらおう。";
  renderTopScores();
}

function backToTitle() {
  mode = "title";
  document.body.classList.add("title-active");
  document.body.classList.remove("playing-active", "result-active");
  stopMusic();
  resultScreen.hidden = true;
  titleScreen.hidden = false;
  items = [];
  effects = [];
  score = 0;
  life = 3;
  timeLeft = gameSeconds;
  elapsed = 0;
  lastSpurt = false;
  lastSpurtText.hidden = true;
  updateHud();
}

function updateHud() {
  scoreText.textContent = score.toLocaleString("ja-JP");
  timeText.textContent = Math.ceil(timeLeft);
  lifeText.textContent = "❤".repeat(life).padEnd(3, "♡");
}

function renderTopScores() {
  topScoresList.textContent = "";
  for (let i = 0; i < 3; i += 1) {
    const row = document.createElement("li");
    row.textContent = topScores[i] == null ? "まだ記録なし" : `${topScores[i].toLocaleString("ja-JP")} 点`;
    topScoresList.append(row);
  }
}

function draw() {
  drawBackground();
  drawItems();
  drawEffects(false);
  drawPlayer();
  drawEffects(true);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#8ed4ff");
  sky.addColorStop(0.55, "#d8f6ff");
  sky.addColorStop(0.56, "#a8edca");
  sky.addColorStop(1, "#68cd8e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.28;
  const rainbow = ctx.createLinearGradient(0, 70, W, 280);
  rainbow.addColorStop(0, "#ff8bc5");
  rainbow.addColorStop(0.25, "#fff176");
  rainbow.addColorStop(0.5, "#7ee7d0");
  rainbow.addColorStop(0.75, "#8ec8ff");
  rainbow.addColorStop(1, "#ff8bc5");
  ctx.strokeStyle = rainbow;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(W * 0.5, 360, 300, Math.PI * 1.06, Math.PI * 1.92);
  ctx.stroke();
  ctx.restore();

  clouds.forEach(drawCloud);
  particles.forEach((p) => {
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#6ecb86";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "rgba(255,255,255,.23)";
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath();
    ctx.arc(x, groundY + 8, 26, 0, Math.PI, true);
    ctx.fill();
  }
}

function drawCloud(cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.size, cloud.size);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  roundedBlob(0, 0, 150, 38, 22);
  roundedBlob(42, -22, 66, 46, 24);
  roundedBlob(86, -14, 76, 44, 24);
  ctx.restore();
}

function drawPlayer() {
  const breathe = Math.sin(performance.now() / 180) * 0.025;
  const squish = player.squish;
  const stretch = player.vy < -1 ? 0.12 : 0;
  const sx = 1 + squish - stretch * 0.35 + breathe;
  const sy = 1 - squish + stretch;
  ctx.save();
  ctx.translate(player.x, player.y + 58);
  ctx.rotate(player.doubleSpin > 0 ? player.spin * Math.PI * 2 : 0);
  ctx.scale(sx * player.facing, sy);

  drawMochuBody(player.mood);
  ctx.restore();
}

function drawMochuBody(mood) {
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#2b1e2f";
  ctx.fillStyle = "#ffb6d5";

  ctx.beginPath();
  ctx.moveTo(-42, -58);
  ctx.bezierCurveTo(-58, -42, -60, 14, -43, 44);
  ctx.quadraticCurveTo(-36, 66, -22, 46);
  ctx.quadraticCurveTo(-10, 72, 0, 48);
  ctx.quadraticCurveTo(12, 72, 22, 46);
  ctx.quadraticCurveTo(38, 66, 44, 42);
  ctx.bezierCurveTo(61, 10, 58, -42, 42, -58);
  ctx.bezierCurveTo(22, -78, -22, -78, -42, -58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.ellipse(-21, -46, 16, 8, -0.7, 0, Math.PI * 2);
  ctx.fill();

  drawArm(-46, 2, -0.35);
  drawArm(46, 2, 0.35);
  drawArm(-33, 32, 0.18);
  drawArm(33, 32, -0.18);

  ctx.fillStyle = "#ff8fb6";
  ctx.beginPath();
  ctx.arc(-25, -10, 10, 0, Math.PI * 2);
  ctx.arc(25, -10, 10, 0, Math.PI * 2);
  ctx.fill();

  drawFace(mood);
}

function drawArm(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#ffb6d5";
  ctx.strokeStyle = "#2b1e2f";
  ctx.lineWidth = 5;
  roundedBlob(-8, -7, 22, 18, 12);
  ctx.stroke();
  ctx.restore();
}

function drawFace(mood) {
  const eyeY = -28;
  ctx.fillStyle = "#2b1e2f";
  if (mood === "fever") {
    drawStarEye(-13, eyeY);
    drawStarEye(13, eyeY);
  } else if (mood === "ouch") {
    ctx.fillRect(-19, eyeY - 4, 12, 4);
    ctx.fillRect(7, eyeY - 4, 12, 4);
  } else {
    ctx.beginPath();
    ctx.ellipse(-13, eyeY, 5, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(13, eyeY, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = mood === "ouch" ? "#6b4d72" : "#ff5f79";
  ctx.beginPath();
  ctx.ellipse(0, -7, mood === "happy" ? 12 : 9, mood === "ouch" ? 4 : 10, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarEye(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fff176";
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 4 : 9;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawItems() {
  items.forEach((item) => {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot + Math.sin(item.wobble) * 0.12);
    const pulse = item.type.kind === "good" ? 1 + Math.sin(item.wobble) * 0.06 : 1;
    ctx.scale(pulse, pulse);
    drawPuriItem(item);
    ctx.restore();
  });
}

function drawPuriItem(item) {
  const type = item.type;
  const s = item.size;
  if (type.kind === "good") {
    ctx.save();
    ctx.globalAlpha = type.name === "レインボーぷり" ? 0.78 : 0.55;
    ctx.fillStyle = type.glow;
    ctx.beginPath();
    ctx.arc(0, 0, type.name === "レインボーぷり" ? s * 1.08 : s * 0.82, 0, Math.PI * 2);
    ctx.fill();
    if (type.name === "レインボーぷり") {
      ctx.lineWidth = 6;
      ctx.strokeStyle = rainbowGradient(-s, -s, s * 2, s * 2);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(performance.now() / 320);
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        drawSmallStar(Math.cos(angle) * s * 1.05, Math.sin(angle) * s * 1.05, i % 2 ? 6 : 9, i % 2 ? "#fff" : "#fff176");
      }
    }
    ctx.restore();
  }

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#3a283e";
  const fill = type.color === "rainbow" ? rainbowGradient(-s / 2, -s / 2, s, s) : type.color;
  ctx.fillStyle = fill;
  drawPuriArms(s, type.kind);
  poopBlob(s);
  ctx.fill();
  ctx.stroke();

  if (type.name === "トゲぷり") drawSpikes(s);
  if (type.name === "ぷりスター") drawSmallStar(0, -s * 0.72, 16, "#fff176");
  if (type.name === "レインボーぷり") {
    drawSmallStar(0, -s * 0.86, 18, "#fff176");
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -s * 0.03, s * 0.58, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.restore();
  }
  if (type.kind === "good") drawPuriSparkles(s);

  drawItemFace(type.kind);
}

function poopBlob(s) {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.72);
  ctx.bezierCurveTo(s * 0.26, -s * 0.69, s * 0.23, -s * 0.39, s * 0.02, -s * 0.38);
  ctx.bezierCurveTo(s * 0.48, -s * 0.36, s * 0.57, -s * 0.04, s * 0.22, s * 0.04);
  ctx.bezierCurveTo(s * 0.62, s * 0.02, s * 0.66, s * 0.45, s * 0.08, s * 0.5);
  ctx.bezierCurveTo(-s * 0.62, s * 0.56, -s * 0.66, s * 0.03, -s * 0.22, s * 0.04);
  ctx.bezierCurveTo(-s * 0.57, -s * 0.05, -s * 0.48, -s * 0.36, -s * 0.02, -s * 0.38);
  ctx.bezierCurveTo(-s * 0.18, -s * 0.45, -s * 0.14, -s * 0.7, 0, -s * 0.72);
  ctx.closePath();
}

function drawPuriArms(s, kind) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#3a283e";
  ctx.fillStyle = ctx.fillStyle;
  const armY = kind === "good" ? -s * 0.05 : s * 0.03;
  drawPuriArm(-s * 0.52, armY, -1, kind);
  drawPuriArm(s * 0.52, armY, 1, kind);
  ctx.restore();
}

function drawPuriArm(x, y, side, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.rotate(kind === "good" ? -0.72 : -0.22);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-14, -8, -20, -22);
  ctx.quadraticCurveTo(-12, -26, -8, -16);
  ctx.quadraticCurveTo(-2, -8, 8, -8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-20, -23, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPuriSparkles(s) {
  drawSmallStar(-s * 0.62, -s * 0.62, 6, "#fff176");
  drawSmallStar(s * 0.58, -s * 0.52, 5, "#ffd45a");
}

function drawItemFace(kind) {
  ctx.fillStyle = "#2d2031";
  if (kind === "good") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-12, -6, 10, 0, Math.PI * 2);
    ctx.arc(12, -6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2d2031";
    ctx.beginPath();
    ctx.arc(-12, -6, 5, 0, Math.PI * 2);
    ctx.arc(12, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5f79";
    ctx.beginPath();
    ctx.ellipse(0, 15, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-17, -8, 10, 5);
    ctx.fillRect(7, -8, 10, 5);
    ctx.beginPath();
    ctx.arc(0, 14, 8, Math.PI, 0);
    ctx.stroke();
  }
}

function drawSpikes(s) {
  ctx.fillStyle = "#3a283e";
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.34);
    ctx.lineTo(Math.cos(a - 0.12) * s * 0.64, Math.sin(a - 0.12) * s * 0.5);
    ctx.lineTo(Math.cos(a + 0.12) * s * 0.64, Math.sin(a + 0.12) * s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEffects(front) {
  effects.forEach((effect) => {
    if (front !== (effect.type !== "dust")) return;
    const t = 1 - effect.life / 0.55;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.translate(effect.x, effect.y);
    if (effect.type === "catch") {
      ctx.fillStyle = "#fff176";
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        drawSmallStar(Math.cos(a) * t * 52, Math.sin(a) * t * 52, 8, i % 2 ? "#ff8fb6" : "#fff176");
      }
      ctx.fillStyle = "#fff";
      ctx.font = "900 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("+", 0, -34 * t);
    } else if (effect.type === "bad") {
      ctx.fillStyle = "rgba(80,60,88,.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 38 * t, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === "rainbow") {
      ctx.strokeStyle = rainbowGradient(-60, 0, 120, 0);
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 34 + t * 44, 0, Math.PI * 1.8);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) drawSmallStar(Math.cos(i) * 54, Math.sin(i) * 34, 9, "#fff176");
    } else if (effect.type === "jump") {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 42 * t, 14 * t, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === "dust") {
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath();
      ctx.ellipse(-24 * t, 0, 20 * t, 8 * t, 0, 0, Math.PI * 2);
      ctx.ellipse(24 * t, 0, 20 * t, 8 * t, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function roundedBlob(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawSmallStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rainbowGradient(x, y, w, h) {
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, "#ff8fb6");
  gradient.addColorStop(0.28, "#fff176");
  gradient.addColorStop(0.55, "#7ee7d0");
  gradient.addColorStop(0.8, "#8ec8ff");
  gradient.addColorStop(1, "#d39bff");
  return gradient;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function startMusic() {
  const audio = ensureAudio();
  if (!audio) return;
  stopMusic();
  const melody = lastSpurt
    ? [783.99, 987.77, 1174.66, 987.77, 880, 1174.66, 1318.51, 1567.98]
    : [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 783.99];
  const bass = lastSpurt
    ? [196, 196, 220, 220, 246.94, 246.94, 261.63, 261.63]
    : [130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 196, 196];
  const interval = lastSpurt ? 122 : 185;
  musicTimer = window.setInterval(() => {
    const step = musicStep % melody.length;
    playTone(melody[step], lastSpurt ? 0.075 : 0.11, "square", lastSpurt ? 0.032 : 0.026);
    if (step % 2 === 0) playTone(bass[step], lastSpurt ? 0.1 : 0.16, "triangle", lastSpurt ? 0.022 : 0.018);
    musicStep += 1;
  }, interval);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  musicStep = 0;
}

function playCatchSound(good, points) {
  if (good) {
    const high = points >= 500;
    playTone(high ? 880 : 660, 0.08, "triangle", 0.055);
    window.setTimeout(() => playTone(high ? 1174.66 : 880, 0.1, "triangle", 0.045), 55);
  } else {
    playTone(164.81, 0.12, "sawtooth", 0.04);
  }
}

function playLastSpurtSound() {
  [659.25, 783.99, 987.77, 1318.51].forEach((note, index) => {
    window.setTimeout(() => playTone(note, 0.09, "triangle", 0.055), index * 70);
  });
}

function ensureAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  } catch {
    audioContext = null;
    return null;
  }
}

function playTone(frequency, seconds, type, volume) {
  const audio = ensureAudio();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audio.currentTime);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
}
