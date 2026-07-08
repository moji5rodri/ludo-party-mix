// -----------------------------------------------------------------------
// IMPORTANTE: cuando despliegues el backend (Railway, Render, etc.) cambia
// esta URL por la publica que te den, ej: 'https://tu-proyecto.up.railway.app'
// -----------------------------------------------------------------------
const SERVER_URL = 'http://localhost:3001';

const socket = io(SERVER_URL);

// Misma paleta que colors.js del servidor, para pintar los circulos aqui.
const PLAYER_COLORS = [
  { id: 'rojo', hex: '#E74C3C' }, { id: 'azul', hex: '#2980B9' },
  { id: 'verde', hex: '#27AE60' }, { id: 'amarillo', hex: '#F1C40F' },
  { id: 'morado', hex: '#8E44AD' }, { id: 'naranja', hex: '#E67E22' },
  { id: 'turquesa', hex: '#1ABC9C' }, { id: 'rosa', hex: '#EC407A' },
  { id: 'gris', hex: '#7F8C8D' }, { id: 'marron', hex: '#795548' },
  { id: 'celeste', hex: '#00BCD4' }, { id: 'granate', hex: '#C0392B' },
  { id: 'verde_azulado', hex: '#16A085' }, { id: 'ambar', hex: '#F39C12' },
  { id: 'azul_pizarra', hex: '#5D6D7E' }, { id: 'terracota', hex: '#D35400' },
  { id: 'indigo', hex: '#3F51B5' }, { id: 'lima', hex: '#8BC34A' },
  { id: 'oliva', hex: '#9E9D24' }, { id: 'fucsia', hex: '#C2185B' },
];

const BOARD_OPTIONS = [4, 6, 8, 10];

const state = {
  nick: '',
  boardIndex: 0, // indice dentro de BOARD_OPTIONS
  tokens: 4,
  diceType: 'simple',
  room: null, // ultimo estado de sala recibido del servidor
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---------- Pantalla 1: nick ----------
document.getElementById('btn-continue-nick').addEventListener('click', () => {
  const nick = document.getElementById('nick-input').value.trim();
  if (!nick) return;
  state.nick = nick;
  document.getElementById('nick-display').textContent = nick;
  showScreen('screen-choice');
});

// ---------- Pantalla 2: crear o unirse ----------
document.getElementById('btn-go-create').addEventListener('click', () => {
  renderBoardPicker();
  showScreen('screen-config');
});
document.getElementById('btn-go-join').addEventListener('click', () => showScreen('screen-join'));

// ---------- Pantalla 3: unirse ----------
document.getElementById('btn-back-from-join').addEventListener('click', () => showScreen('screen-choice'));
document.getElementById('btn-submit-join').addEventListener('click', () => {
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  if (!code) return;
  socket.emit('join_room', { nick: state.nick, code }, (res) => {
    if (!res.ok) return alert(res.error);
    state.room = res.room;
    enterLobby();
  });
});

// ---------- Pantalla 4: configuracion de sala ----------
document.getElementById('btn-back-from-config').addEventListener('click', () => showScreen('screen-choice'));

function renderBoardPicker() {
  const count = BOARD_OPTIONS[state.boardIndex];
  document.getElementById('board-preview-img').src = `assets/boards/board-${count}.webp`;
  document.getElementById('board-preview-count').textContent = count;
  document.getElementById('board-preview-count-2').textContent = count;

  const megaAllowed = count === 8 || count === 10;
  const megaPill = document.getElementById('pill-mega');
  megaPill.classList.toggle('disabled', !megaAllowed);
  if (!megaAllowed && state.diceType === 'mega') {
    state.diceType = 'simple';
    document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('selected', p.dataset.dice === 'simple'));
  }
  document.getElementById('mega-hint').style.display = megaAllowed ? 'none' : 'block';
}

document.getElementById('btn-board-prev').addEventListener('click', () => {
  state.boardIndex = (state.boardIndex - 1 + BOARD_OPTIONS.length) % BOARD_OPTIONS.length;
  renderBoardPicker();
});
document.getElementById('btn-board-next').addEventListener('click', () => {
  state.boardIndex = (state.boardIndex + 1) % BOARD_OPTIONS.length;
  renderBoardPicker();
});

document.getElementById('btn-tokens-prev').addEventListener('click', () => {
  state.tokens = Math.max(2, state.tokens - 1);
  document.getElementById('tokens-value').textContent = state.tokens;
});
document.getElementById('btn-tokens-next').addEventListener('click', () => {
  state.tokens = Math.min(4, state.tokens + 1);
  document.getElementById('tokens-value').textContent = state.tokens;
});

document.querySelectorAll('.pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    if (pill.classList.contains('disabled')) return;
    state.diceType = pill.dataset.dice;
    document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('selected', p === pill));
  });
});

document.getElementById('btn-create-room').addEventListener('click', () => {
  const maxPlayers = BOARD_OPTIONS[state.boardIndex];
  socket.emit('create_room', {
    nick: state.nick,
    maxPlayers,
    tokensPerPlayer: state.tokens,
    diceType: state.diceType,
  }, (res) => {
    if (!res.ok) return alert(res.error);
    state.room = res.room;
    enterLobby();
  });
});

// ---------- Pantalla 5: lobby ----------
function enterLobby() {
  showScreen('screen-lobby');
  renderLobby();
}

function renderLobby() {
  const room = state.room;
  document.getElementById('lobby-code').textContent = room.code;
  document.getElementById('lobby-count').textContent = room.players.length;
  document.getElementById('lobby-max').textContent = room.maxPlayers;

  // Lista de jugadores + slots vacios restantes
  const list = document.getElementById('lobby-player-list');
  list.innerHTML = '';
  room.players.forEach((p) => {
    const color = PLAYER_COLORS.find((c) => c.id === p.color);
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-dot ${color ? '' : 'empty'}" style="background:${color ? color.hex : 'transparent'}"></div>
      <div class="player-nick">${p.nick}${p.socketId === room.hostSocketId ? ' (host)' : ''}</div>
      ${!color ? '<span class="player-tag">eligiendo color...</span>' : ''}
    `;
    list.appendChild(row);
  });
  for (let i = room.players.length; i < room.maxPlayers; i++) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `<div class="player-dot empty"></div><div class="player-nick" style="color:var(--text-muted)">Esperando jugador...</div>`;
    list.appendChild(row);
  }

  // Grilla de colores
  const grid = document.getElementById('lobby-color-grid');
  grid.innerHTML = '';
  const myPlayer = room.players.find((p) => p.socketId === socket.id);
  PLAYER_COLORS.forEach((c) => {
    const taken = room.players.some((p) => p.color === c.id && p.socketId !== socket.id);
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (taken ? ' taken' : '') + (myPlayer && myPlayer.color === c.id ? ' selected' : '');
    swatch.style.background = c.hex;
    if (!taken) {
      swatch.addEventListener('click', () => {
        socket.emit('choose_color', { colorId: c.id }, (res) => {
          if (!res.ok) alert(res.error);
        });
      });
    }
    grid.appendChild(swatch);
  });

  // Boton de iniciar: solo visible/activo para el host
  const isHost = room.hostSocketId === socket.id;
  const startBtn = document.getElementById('btn-start-game');
  const hint = document.getElementById('lobby-hint');
  startBtn.style.display = isHost ? 'block' : 'none';
  startBtn.disabled = !(isHost && room.players.length >= 2);
  hint.style.display = isHost ? 'none' : 'block';
  if (isHost && room.players.length < 2) {
    hint.style.display = 'block';
    hint.textContent = 'Necesitas al menos 2 jugadores para iniciar';
  }
}

document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('start_game', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

// ---------- Eventos del servidor ----------
socket.on('room_updated', (room) => {
  state.room = room;
  renderLobby();
});

socket.on('game_started', (payload) => {
  state.room = payload.room;
  showScreen('screen-game');
  window.LudoGame.paintBoard(payload.room);
  // TODO siguiente fase: mover fichas real segun cada tiro de dado y
  // detectar capturas (por ahora el tablero ya se ve, pero las fichas
  // todavia no se mueven solas).
});

// Disponible para probar la pantalla de victoria manualmente en consola:
// window.LudoGame.showVictory('Fernando', 'rojo')
socket.on('game_won', (payload) => {
  window.LudoGame.showVictory(payload.nick, payload.color);
});
