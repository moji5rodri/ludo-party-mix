// LUDO Party Mix - server.js
// Fase 1 (MVP): sala única reutilizable, 4 jugadores, dado normal, mecánica básica.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createGame } = require('./game/gameEngine');

// ------- Configuración -------
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.LUDO_PASSWORD || 'cambiaesto123'; // clave del grupo (Opción B)
const TURN_TIME_MS = 15000;      // 15s por turno
const RECONNECT_GRACE_MS = 20000; // 20s de gracia para reconectar
const MAX_PLAYERS = 4;            // Fase 1: solo mesa de 4
const MIN_PLAYERS = 2;

const COLORS = [
  '#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#FB8C00',
  '#00ACC1', '#D81B60', '#6D4C41', '#3949AB', '#7CB342', '#F4511E',
  '#039BE5', '#C0CA33', '#5E35B1', '#00897B', '#FFFFFF', '#9E9E9E',
  '#000000', '#EC407A'
];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// ------- Estado en memoria (una sola sala reutilizable, código fijo pero reutilizable) -------
let room = null; // se crea la primera vez que alguien hace "Crear sala"

function freshRoomState(code, numPlayers, tokensPerPlayer, diceMode) {
  return {
    code,
    numPlayers,
    tokensPerPlayer,
    diceMode, // 'normal' | 'mega' (mega solo válido en fase 2 para 8/10)
    players: [],       // { id, socketId, nick, color, connected, disconnectTimer }
    started: false,
    game: null,        // instancia del motor de juego una vez arranca
    turnTimer: null,
    createdAt: Date.now(),
  };
}

function publicRoomState() {
  if (!room) return null;
  return {
    code: room.code,
    numPlayers: room.numPlayers,
    tokensPerPlayer: room.tokensPerPlayer,
    diceMode: room.diceMode,
    started: room.started,
    players: room.players.map(p => ({
      id: p.id, nick: p.nick, color: p.color, connected: p.connected,
    })),
  };
}

function usedColors() {
  return new Set(room ? room.players.map(p => p.color) : []);
}

function broadcastRoom() {
  io.to('lobby').emit('room:update', publicRoomState());
}

function broadcastGame() {
  if (!room || !room.game) return;
  io.to('lobby').emit('game:state', room.game.getPublicState());
}

function clearTurnTimer() {
  if (room && room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function startTurnTimer() {
  clearTurnTimer();
  if (!room || !room.game || room.game.winner) return;
  room.turnTimer = setTimeout(() => {
    // Se acabó el tiempo: tirar dado solo y mover una ficha aleatoria válida
    const result = room.game.autoPlayTurn();
    io.to('lobby').emit('game:autoplay', result);
    broadcastGame();
    if (!room.game.winner) startTurnTimer();
    else onGameOver();
  }, TURN_TIME_MS);
}

function onGameOver() {
  clearTurnTimer();
  io.to('lobby').emit('game:over', { winnerId: room.game.winner });
}

io.on('connection', (socket) => {
  let authed = false;
  let playerId = null;

  socket.on('auth:check', ({ password }) => {
    if (password === SITE_PASSWORD) {
      authed = true;
      socket.join('lobby');
      socket.emit('auth:ok', { room: publicRoomState() });
    } else {
      socket.emit('auth:fail');
    }
  });

  socket.on('room:create', ({ nick, numPlayers, tokensPerPlayer, diceMode }) => {
    if (!authed) return;
    if (room && room.players.length > 0 && !room.started) {
      // ya hay una sala en lobby, unirse a esa en vez de pisarla
      socket.emit('room:error', 'Ya existe una sala esperando jugadores. Usá "Unirse".');
      return;
    }
    const code = room ? room.code : Math.random().toString(36).slice(2, 7).toUpperCase();
    room = freshRoomState(code, Math.min(numPlayers || MAX_PLAYERS, MAX_PLAYERS), tokensPerPlayer || 4, diceMode || 'normal');
    joinAsPlayer(socket, nick);
  });

  socket.on('room:join', ({ nick, code }) => {
    if (!authed) return;
    if (!room) {
      socket.emit('room:error', 'No hay ninguna sala creada todavía.');
      return;
    }
    if (code && code.toUpperCase() !== room.code) {
      socket.emit('room:error', 'Código de sala incorrecto.');
      return;
    }
    if (room.started) {
      socket.emit('room:error', 'La partida ya empezó.');
      return;
    }
    if (room.players.length >= room.numPlayers) {
      socket.emit('room:error', 'La sala ya está completa.');
      return;
    }
    joinAsPlayer(socket, nick);
  });

  function joinAsPlayer(socket, nick) {
    playerId = 'p_' + Math.random().toString(36).slice(2, 9);
    room.players.push({
      id: playerId,
      socketId: socket.id,
      nick: (nick || 'Jugador').slice(0, 16),
      color: null,
      connected: true,
      disconnectTimer: null,
    });
    socket.data.playerId = playerId;
    socket.emit('room:joined', { playerId, room: publicRoomState(), availableColors: COLORS.filter(c => !usedColors().has(c)) });
    broadcastRoom();
  }

  socket.on('color:pick', ({ color }) => {
    if (!room) return;
    const p = room.players.find(pl => pl.id === socket.data.playerId);
    if (!p) return;
    if (usedColors().has(color)) {
      socket.emit('room:error', 'Ese color ya fue elegido.');
      return;
    }
    p.color = color;
    broadcastRoom();
  });

  socket.on('game:start', () => {
    if (!room) return;
    const readyPlayers = room.players.filter(p => p.color);
    if (readyPlayers.length < MIN_PLAYERS) {
      socket.emit('room:error', `Se necesitan al menos ${MIN_PLAYERS} jugadores con color elegido.`);
      return;
    }
    room.started = true;
    room.game = createGame({
      players: readyPlayers.map(p => ({ id: p.id, nick: p.nick, color: p.color })),
      slotsCount: room.numPlayers,
      tokensPerPlayer: room.tokensPerPlayer,
      diceMode: room.diceMode,
    });
    io.to('lobby').emit('game:started', room.game.getPublicState());
    startTurnTimer();
  });

  socket.on('dice:roll', () => {
    if (!room || !room.game) return;
    const result = room.game.rollDice(socket.data.playerId);
    if (result.error) { socket.emit('room:error', result.error); return; }
    io.to('lobby').emit('dice:result', result);
    broadcastGame();
    if (result.turnEnded) startTurnTimer();
  });

  socket.on('token:move', ({ tokenId }) => {
    if (!room || !room.game) return;
    const result = room.game.moveToken(socket.data.playerId, tokenId);
    if (result.error) { socket.emit('room:error', result.error); return; }
    io.to('lobby').emit('token:moved', result);
    broadcastGame();
    if (room.game.winner) { onGameOver(); return; }
    if (result.turnEnded) startTurnTimer();
  });

  socket.on('player:surrender', () => {
    if (!room || !room.game) return;
    const result = room.game.surrender(socket.data.playerId, Date.now());
    if (result.error) { socket.emit('room:error', result.error); return; }
    io.to('lobby').emit('player:surrendered', result);
    broadcastGame();
    if (room.game.winner) onGameOver();
    else startTurnTimer();
  });

  socket.on('chat:send', ({ text }) => {
    if (!room) return;
    const p = room.players.find(pl => pl.id === socket.data.playerId);
    if (!p || !text) return;
    io.to('lobby').emit('chat:message', { nick: p.nick, color: p.color, text: String(text).slice(0, 300) });
  });

  socket.on('disconnect', () => {
    if (!room) return;
    const p = room.players.find(pl => pl.id === socket.data.playerId);
    if (!p) return;
    p.connected = false;
    broadcastRoom();
    p.disconnectTimer = setTimeout(() => {
      // Se acabó la gracia: si la partida no empezó, lo saco de la sala.
      if (!room) return;
      if (!room.started) {
        room.players = room.players.filter(pl => pl.id !== p.id);
        broadcastRoom();
      } else if (room.game) {
        room.game.markAbandoned(p.id);
        broadcastGame();
      }
    }, RECONNECT_GRACE_MS);
  });

  socket.on('player:reconnect', ({ playerId: pid }) => {
    if (!room) return;
    const p = room.players.find(pl => pl.id === pid);
    if (!p) { socket.emit('room:error', 'No se encontró tu jugador anterior.'); return; }
    clearTimeout(p.disconnectTimer);
    p.connected = true;
    p.socketId = socket.id;
    socket.data.playerId = pid;
    socket.join('lobby');
    authed = true;
    socket.emit('room:joined', { playerId: pid, room: publicRoomState(), availableColors: COLORS.filter(c => !usedColors().has(c)) });
    if (room.game) socket.emit('game:state', room.game.getPublicState());
    broadcastRoom();
  });
});

server.listen(PORT, () => {
  console.log(`LUDO Party Mix corriendo en http://localhost:${PORT}`);
  console.log(`Clave de acceso actual: ${SITE_PASSWORD} (cambiala con la variable de entorno LUDO_PASSWORD)`);
});
