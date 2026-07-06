// LUDO Party Mix - main.js (cliente)

const socket = io();

const COLORS = [
  '#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#FB8C00',
  '#00ACC1', '#D81B60', '#6D4C41', '#3949AB', '#7CB342', '#F4511E',
  '#039BE5', '#C0CA33', '#5E35B1', '#00897B', '#FFFFFF', '#9E9E9E',
  '#000000', '#EC407A'
];

let state = {
  nick: '',
  playerId: localStorage.getItem('ludo_playerId') || null,
  numPlayers: 4,
  tokensPerPlayer: 4,
  diceMode: 'normal',
  room: null,
  game: null,
  myColor: null,
};

// ------- Utilidades de pantalla -------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3000);
}

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.getAttribute('data-back')));
});

// ------- Sonidos (beeps simples generados, sin archivos externos) -------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const actx = AudioCtx ? new AudioCtx() : null;
function beep(freq, duration, type = 'sine', delay = 0) {
  if (!actx) return;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, actx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + delay + duration);
  osc.connect(gain).connect(actx.destination);
  osc.start(actx.currentTime + delay);
  osc.stop(actx.currentTime + delay + duration);
}
function sfxDice() { beep(440, 0.08); beep(520, 0.08, 'sine', 0.09); beep(600, 0.1, 'sine', 0.18); }
function sfxCapture() { beep(200, 0.05, 'sawtooth'); beep(120, 0.15, 'sawtooth', 0.05); }
function sfxWin() { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.25, 'triangle', i * 0.15)); }

// ------- Paso 1: Auth -------
document.getElementById('btn-auth').addEventListener('click', tryAuth);
document.getElementById('input-password').addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });
function tryAuth() {
  const password = document.getElementById('input-password').value;
  socket.emit('auth:check', { password });
}
socket.on('auth:ok', ({ room }) => {
  document.getElementById('auth-error').textContent = '';
  if (state.playerId) {
    socket.emit('player:reconnect', { playerId: state.playerId });
  } else {
    showScreen('screen-nick');
  }
});
socket.on('auth:fail', () => {
  document.getElementById('auth-error').textContent = 'Clave incorrecta.';
});

// ------- Paso 2: Nick -------
document.getElementById('btn-nick-continue').addEventListener('click', () => {
  const nick = document.getElementById('input-nick').value.trim();
  if (!nick) { toast('Poné un nick primero.'); return; }
  state.nick = nick;
  showScreen('screen-choice');
});

// ------- Paso 3: Crear / Unirse -------
document.getElementById('btn-go-create').addEventListener('click', () => showScreen('screen-create'));
document.getElementById('btn-go-join').addEventListener('click', () => showScreen('screen-join'));

// -- Configuración de sala --
const PLAYER_OPTIONS = [4]; // Fase 1: solo 4 (se ampliará a 6/8/10 en Fase 2)
let playerOptionIdx = 0;
function refreshPlayersUI() {
  state.numPlayers = PLAYER_OPTIONS[playerOptionIdx];
  document.getElementById('table-preview').textContent = state.numPlayers;
  document.getElementById('players-value-label').textContent = `${state.numPlayers} jugadores`;
}
document.getElementById('players-prev').addEventListener('click', () => {
  playerOptionIdx = (playerOptionIdx - 1 + PLAYER_OPTIONS.length) % PLAYER_OPTIONS.length;
  refreshPlayersUI();
});
document.getElementById('players-next').addEventListener('click', () => {
  playerOptionIdx = (playerOptionIdx + 1) % PLAYER_OPTIONS.length;
  refreshPlayersUI();
});
refreshPlayersUI();

let tokensOption = 4;
function refreshTokensUI() {
  document.getElementById('tokens-value-label').textContent = tokensOption;
}
document.getElementById('tokens-prev').addEventListener('click', () => {
  tokensOption = tokensOption > 2 ? tokensOption - 1 : 4;
  refreshTokensUI();
});
document.getElementById('tokens-next').addEventListener('click', () => {
  tokensOption = tokensOption < 4 ? tokensOption + 1 : 2;
  refreshTokensUI();
});

document.querySelectorAll('.dice-option').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.dice-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.diceMode = btn.getAttribute('data-dice');
  });
});

document.getElementById('btn-create-room').addEventListener('click', () => {
  socket.emit('room:create', {
    nick: state.nick,
    numPlayers: state.numPlayers,
    tokensPerPlayer: tokensOption,
    diceMode: state.diceMode,
  });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('input-code').value.trim();
  if (!code) { toast('Poné el código de sala.'); return; }
  socket.emit('room:join', { nick: state.nick, code });
});

socket.on('room:error', (msg) => {
  toast(msg);
  document.getElementById('create-error').textContent = msg;
  document.getElementById('join-error').textContent = msg;
  document.getElementById('choice-error').textContent = msg;
});

socket.on('room:joined', ({ playerId, room, availableColors }) => {
  state.playerId = playerId;
  localStorage.setItem('ludo_playerId', playerId);
  state.room = room;
  renderLobby(availableColors);
  showScreen('screen-lobby');
});

socket.on('room:update', (room) => {
  state.room = room;
  if (document.getElementById('screen-lobby').classList.contains('active')) {
    renderLobby();
  }
});

// ------- Lobby -------
function renderLobby(availableColorsOverride) {
  const room = state.room;
  document.getElementById('room-code-display').textContent = room.code;

  const list = document.getElementById('lobby-players-list');
  list.innerHTML = '';
  room.players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'player-row' + (p.connected ? '' : ' offline');
    row.innerHTML = `<span class="player-dot" style="background:${p.color || '#ccc'}"></span> ${escapeHtml(p.nick)} ${p.connected ? '' : '(desconectado)'}`;
    list.appendChild(row);
  });

  const taken = new Set(room.players.map(p => p.color).filter(Boolean));
  const me = room.players.find(p => p.id === state.playerId);
  state.myColor = me ? me.color : null;

  const grid = document.getElementById('color-grid');
  grid.innerHTML = '';
  COLORS.forEach(color => {
    const swatch = document.createElement('div');
    const isTaken = taken.has(color) && color !== state.myColor;
    swatch.className = 'color-swatch' + (color === state.myColor ? ' selected' : '') + (isTaken ? ' taken' : '');
    swatch.style.background = color;
    swatch.setAttribute('data-color', color);
    if (!isTaken) {
      swatch.addEventListener('click', () => socket.emit('color:pick', { color }));
    }
    grid.appendChild(swatch);
  });

  const readyCount = room.players.filter(p => p.color).length;
  document.getElementById('btn-start-game').disabled = readyCount < 2;
}

document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('game:start');
});

// ------- Juego -------
socket.on('game:started', (gameState) => {
  state.game = gameState;
  showScreen('screen-game');
  renderGame();
});
socket.on('game:state', (gameState) => {
  state.game = gameState;
  if (document.getElementById('screen-game').classList.contains('active')) renderGame();
});

function renderGame() {
  const g = state.game;
  if (!g) return;
  const container = document.getElementById('board-container');
  window.LudoBoard.renderBoard(container, g, state.playerId, {
    onTokenClick: (tokenId) => socket.emit('token:move', { tokenId }),
  });

  const me = g.players.find(p => p.id === state.playerId);
  const current = g.players.find(p => p.id === g.currentPlayerId);
  document.getElementById('turn-indicator').textContent = current ? `Turno de: ${current.nick}` : '-';

  const myTurn = g.currentPlayerId === state.playerId;
  document.getElementById('btn-roll-dice').disabled = !myTurn || !!g.pendingRoll;

  const now = Date.now();
  document.getElementById('btn-surrender').disabled = !me || now < g.surrenderUnlocksAt;
}

document.getElementById('btn-roll-dice').addEventListener('click', () => {
  socket.emit('dice:roll');
});

document.getElementById('btn-surrender').addEventListener('click', () => {
  if (confirm('¿Seguro que querés rendirte?')) socket.emit('player:surrender');
});

socket.on('dice:result', (result) => {
  sfxDice();
  const face = document.getElementById('dice-face');
  face.classList.remove('rolling'); void face.offsetWidth; face.classList.add('rolling');
  face.textContent = result.value;
  if (result.movableTokenIds.length === 0) {
    toast(result.canRerollAgain ? `Sacaste ${result.value}, ¡tirá de nuevo!` : `Sacaste ${result.value}, no hay movimientos posibles.`);
  }
});

socket.on('token:moved', (result) => {
  if (result.captured) { sfxCapture(); toast('¡Ficha comida!'); }
});

socket.on('game:autoplay', (result) => {
  toast('Se acabó el tiempo: se jugó automáticamente.');
});

socket.on('player:surrendered', () => toast('Un jugador se rindió.'));

socket.on('game:over', ({ winnerId }) => {
  sfxWin();
  const winner = state.game.players.find(p => p.id === winnerId);
  document.getElementById('winner-name').textContent = winner ? winner.nick : '???';
  const dots = document.getElementById('celebrate-tokens');
  dots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'token-dot';
    d.style.background = winner ? winner.color : '#ccc';
    dots.appendChild(d);
  }
  showScreen('screen-winner');
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
  showScreen('screen-choice');
});

// ------- Tema claro/oscuro -------
document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  const body = document.body;
  const current = body.getAttribute('data-theme');
  body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  document.getElementById('btn-theme-toggle').textContent = current === 'dark' ? '🌙' : '☀️';
  if (state.game) renderGame();
});

// ------- Chat -------
document.getElementById('btn-chat-toggle').addEventListener('click', () => {
  document.getElementById('chat-box').classList.add('open');
});
document.getElementById('btn-chat-close').addEventListener('click', () => {
  document.getElementById('chat-box').classList.remove('open');
});
document.getElementById('btn-chat-send').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat:send', { text });
  input.value = '';
}
socket.on('chat:message', ({ nick, color, text }) => {
  const box = document.getElementById('chat-messages');
  const line = document.createElement('div');
  line.className = 'chat-msg';
  line.innerHTML = `<strong style="color:${color || '#333'}">${escapeHtml(nick)}:</strong> ${escapeHtml(text)}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
});

function escapeHtml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
