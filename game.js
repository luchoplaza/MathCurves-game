// Para jugar: abrir index.html en un navegador moderno de escritorio o móvil.
// Este archivo contiene: inicialización del canvas, bucle de animación,
// física básica, parseo/graficado de ecuaciones, sistema de puntaje/tiempo
// y gestión de ranking con localStorage.

// ---------------------- Configuración y estado global ----------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const equationInput = document.getElementById('equation-input');
const plotButton = document.getElementById('plot-button');
const clearCurvesButton = document.getElementById('clear-curves');
const curvesList = document.getElementById('curves-list');
const scoreLabel = document.getElementById('score-label');
const timerLabel = document.getElementById('timer-label');
const timerArea = document.getElementById('timer-area');
const playerLabel = document.getElementById('player-label');
const highscoresList = document.getElementById('highscores');
const finalHighscoresList = document.getElementById('final-highscores');
const resetButton = document.getElementById('reset-button');
const relaunchButton = document.getElementById('relaunch-button');
const relaunchCountLabel = document.getElementById('relaunch-count');

const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const gameOverPanel = document.getElementById('game-over');
const freeModeBtn = document.getElementById('free-mode');
const timedModeBtn = document.getElementById('timed-mode');
const backToMenuBtn = document.getElementById('back-to-menu');
const playerInput = document.getElementById('player-name');
const finalScoreLabel = document.getElementById('final-score');

let animationId;
let playerName = '';
let mode = 'free';
let score = 0;
let timer = 0;
let level = 1;
let gravity = 0.35;
let starGoal = 5;
let stars = [];
let curves = [];
let ball;
let gameRunning = false;
let countdownInterval;
let relaunchCount = 0;
const RELAUNCH_PENALTY = 0.15; // 15% del puntaje actual

// Transformación del eje Y: (0,0) es la esquina inferior izquierda
function toScreenY(y) {
  return canvas.height - y;
}

// ---------------------- Entidades principales -----------------------------
class Ball {
  constructor() {
    this.radius = 10;
    this.reset();
  }

  reset() {
    this.x = canvas.width / 2;
    this.y = canvas.height - 60;
    this.vx = 0;
    this.vy = 0;
  }

  update() {
    // Aplicar gravedad (eje Y crece hacia arriba, gravedad negativa)
    this.vy -= gravity;
    // Actualizar posición
    this.x += this.vx;
    this.y += this.vy;

    // Colisión con bordes del canvas
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -0.8;
    }
    if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.vx *= -0.8;
    }
    if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      this.vy *= -0.8;
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy *= -0.8;
    }

    this.handleCurveCollisions();
  }

  handleCurveCollisions() {
    // Aproximamos cada curva como segmentos y revisamos distancia del centro a la línea
    curves.forEach(curve => {
      for (let i = 0; i < curve.points.length - 1; i++) {
        const p1 = curve.points[i];
        const p2 = curve.points[i + 1];
        const dist = pointToSegmentDistance(this.x, this.y, p1.x, p1.y, p2.x, p2.y);
        if (dist < this.radius) {
          // Vector normal aproximado
          const nx = p2.y - p1.y;
          const ny = -(p2.x - p1.x);
          const len = Math.hypot(nx, ny) || 1;
          const normalX = nx / len;
          const normalY = ny / len;

          // Reflejar velocidad para simular rebote suave
          const dot = this.vx * normalX + this.vy * normalY;
          this.vx = this.vx - 1.6 * dot * normalX;
          this.vy = this.vy - 1.6 * dot * normalY;

          // Pequeño desplazamiento para evitar quedar atrapada
          this.x += normalX * (this.radius - dist);
          this.y += normalY * (this.radius - dist);
          break;
        }
      }
    });
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = '#60a5fa';
    ctx.arc(this.x, toScreenY(this.y), this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Star {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 8;
    this.collected = false;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, toScreenY(this.y));
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((i * 2 * Math.PI) / 5) * this.radius,
        Math.sin((i * 2 * Math.PI) / 5) * this.radius);
      ctx.lineTo(Math.cos(((i * 2 + 1) * Math.PI) / 5) * (this.radius / 2),
        Math.sin(((i * 2 + 1) * Math.PI) / 5) * (this.radius / 2));
    }
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------- Utilidades de curvas y colisiones -----------------
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  // Calcular la proyección del punto sobre el segmento
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function parseEquation(equationText) {
  // Limpiar prefijos tipo "y ="
  const cleaned = equationText.replace(/^\s*y\s*=\s*/i, '');
  try {
    // Construimos una función usando el contexto Math
    const evaluator = new Function('x', `with (Math) { return ${cleaned}; }`);
    // Probar un valor para detectar errores tempranos
    evaluator(0);
    return evaluator;
  } catch (e) {
    alert('Ecuación inválida. Usa polinomios sencillos en términos de x.');
    return null;
  }
}

function buildCurvePoints(fn) {
  const points = [];
  const step = 6; // menor paso = curva más suave
  for (let x = 0; x <= canvas.width; x += step) {
    let y = fn(x);
    if (!Number.isFinite(y)) continue;
    // Limitar y al canvas para evitar saltos enormes (eje positivo hacia arriba)
    y = Math.max(0, Math.min(canvas.height, y));
    points.push({ x, y });
  }
  return points;
}

function addCurve(equationText) {
  const fn = parseEquation(equationText);
  if (!fn) return;
  const points = buildCurvePoints(fn);
  if (points.length < 2) return;
  curves.push({ fn, points, text: equationText });
  renderCurvesList();
}

function renderCurvesList() {
  curvesList.innerHTML = '';
  curves.forEach(curve => {
    const li = document.createElement('li');
    li.textContent = curve.text;
    curvesList.appendChild(li);
  });
}

function clearCurves() {
  curves = [];
  renderCurvesList();
}

// ---------------------- Gestión de estrellas ------------------------------
function spawnStars(count) {
  stars = [];
  for (let i = 0; i < count; i++) {
    const x = 50 + Math.random() * (canvas.width - 100);
    const yMin = 80;
    const yMax = canvas.height - 80;
    const y = yMin + Math.random() * (yMax - yMin);
    stars.push(new Star(x, y));
  }
}

function checkStarCollisions() {
  stars.forEach(star => {
    if (star.collected) return;
    const dist = Math.hypot(ball.x - star.x, ball.y - star.y);
    if (dist < ball.radius + star.radius) {
      star.collected = true;
      score += 10;
      scoreLabel.textContent = score;
    }
  });

  const remaining = stars.filter(s => !s.collected).length;
  if (remaining === 0) {
    if (mode === 'free') {
      spawnStars(starGoal + Math.floor(score / 50));
    } else {
      advanceLevel();
    }
  }
}

// ---------------------- Ranking con localStorage --------------------------
function loadHighscores() {
  const saved = localStorage.getItem('mathCurvesHighscores');
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem('mathCurvesHighscores', JSON.stringify(list));
}

function updateHighscores(currentScore) {
  const list = loadHighscores();
  const existing = list.find(entry => entry.name === playerName);
  if (existing) {
    existing.score = Math.max(existing.score, currentScore);
  } else {
    list.push({ name: playerName, score: currentScore });
  }
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  saveHighscores(trimmed);
  renderHighscores(trimmed, highscoresList);
  renderHighscores(trimmed, finalHighscoresList);
}

function renderHighscores(list, target) {
  target.innerHTML = '';
  list.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.name}: ${entry.score} pts`;
    target.appendChild(li);
  });
}

// ---------------------- Bucle de animación y dibujo -----------------------
function drawCurves() {
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a78bfa';
  curves.forEach(curve => {
    ctx.beginPath();
    curve.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, toScreenY(p.y));
      else ctx.lineTo(p.x, toScreenY(p.y));
    });
    ctx.stroke();
  });
}

function drawStars() {
  stars.forEach(star => {
    if (!star.collected) star.draw();
  });
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!gameRunning) return;

  ball.update();
  checkStarCollisions();

  drawCurves();
  drawStars();
  ball.draw();

  animationId = requestAnimationFrame(update);
}

// ---------------------- Temporizador para el modo con tiempo -------------
function startCountdown(seconds) {
  timer = seconds;
  timerLabel.textContent = timer;
  timerArea.classList.remove('hidden');
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timer -= 1;
    timerLabel.textContent = timer;
    if (timer <= 0) {
      clearInterval(countdownInterval);
      endGame();
    }
  }, 1000);
}

// ---------------------- Flujo de juego y niveles -------------------------
function resetGameState(selectedMode) {
  mode = selectedMode;
  score = 0;
  level = 1;
  gravity = 0.35;
  starGoal = 5;
  ball.reset();
  relaunchCount = 0;
  relaunchCountLabel.textContent = relaunchCount;
  clearCurves();
  spawnStars(starGoal);
  scoreLabel.textContent = '0';
  timerArea.classList.toggle('hidden', mode !== 'timed');
  if (mode === 'timed') {
    startCountdown(60);
  }
}

function startGame(selectedMode) {
  if (!playerInput.value.trim()) {
    alert('Ingresa tu nombre para comenzar');
    return;
  }
  playerName = playerInput.value.trim();
  playerLabel.textContent = playerName;
  startScreen.classList.add('hidden');
  gameOverPanel.classList.add('hidden');
  gameUI.classList.remove('hidden');
  gameRunning = true;
  resetGameState(selectedMode);
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
  renderHighscores(loadHighscores(), highscoresList);
}

function advanceLevel() {
  level += 1;
  starGoal += 2;
  gravity += 0.05;
  ball.radius = Math.max(8, ball.radius - 0.5);
  ball.reset();
  spawnStars(starGoal);
  startCountdown(Math.max(20, 60 - level * 5));
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animationId);
  clearInterval(countdownInterval);
  finalScoreLabel.textContent = score;
  gameUI.classList.add('hidden');
  gameOverPanel.classList.remove('hidden');
  updateHighscores(score);
}

function handleRelaunch() {
  if (!gameRunning) return;
  ball.reset();
  relaunchCount += 1;
  const deduction = Math.floor(score * RELAUNCH_PENALTY);
  score = Math.max(0, score - deduction);
  scoreLabel.textContent = score;
  relaunchCountLabel.textContent = relaunchCount;
}

// ---------------------- Eventos de UI ------------------------------------
plotButton.addEventListener('click', () => {
  if (!equationInput.value.trim()) return;
  addCurve(equationInput.value.trim());
});

equationInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    addCurve(equationInput.value.trim());
  }
});

clearCurvesButton.addEventListener('click', () => {
  clearCurves();
});

relaunchButton.addEventListener('click', handleRelaunch);

freeModeBtn.addEventListener('click', () => startGame('free'));
timedModeBtn.addEventListener('click', () => startGame('timed'));

resetButton.addEventListener('click', () => {
  gameRunning = false;
  clearInterval(countdownInterval);
  cancelAnimationFrame(animationId);
  gameUI.classList.add('hidden');
  gameOverPanel.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

backToMenuBtn.addEventListener('click', () => {
  gameOverPanel.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

// ---------------------- Inicialización -----------------------------------
function init() {
  ball = new Ball();
  spawnStars(starGoal);
  renderHighscores(loadHighscores(), highscoresList);
  // Evitar que el canvas reciba scroll al pulsar espacio
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
  });
  update();
}

init();
