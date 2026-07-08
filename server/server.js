const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { GameManager, RECONNECT_GRACE_MS } = require('./gameManager');
const { rollTurn } = require('./diceLogic');
const { PLAYER_COLORS } = require('./colors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const gameManager = new GameManager();
const socketToRoom = new Map(); // socketId -> codigo de sala, para ubicar la sala al desconectar

function publicRoomState(room) {
  return {
    code: room.code,
    maxPlayers: room.maxPlayers,
    tokensPerPlayer: room.tokensPerPlayer,
    diceType: room.diceType,
    status: room.status,
    hostSocketId: room.hostSocketId,
    players: [...room.players.values()].map((p) => ({
      socketId: p.socketId,
      nick: p.nick,
      color: p.color,
      slotIndex: p.slotIndex,
      connected: p.connected,
      isBot: p.isBot,
    })),
    availableColors: room.availableColors(),
  };
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ nick, maxPlayers, tokensPerPlayer, diceType }, callback) => {
    try {
      const room = gameManager.createRoom({
        hostSocketId: socket.id,
        maxPlayers,
        tokensPerPlayer,
        diceType,
      });
      room.addPlayer(socket.id, nick);
      socket.join(room.code);
      socketToRoom.set(socket.id, room.code);

      callback({ ok: true, room: publicRoomState(room) });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('join_room', ({ nick, code }, callback) => {
    const room = gameManager.getRoom(code);
    if (!room) return callback({ ok: false, error: 'La sala no existe' });

    try {
      room.addPlayer(socket.id, nick);
      socket.join(room.code);
      socketToRoom.set(socket.id, room.code);

      callback({ ok: true, room: publicRoomState(room) });
      io.to(room.code).emit('room_updated', publicRoomState(room));
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('choose_color', ({ colorId }, callback) => {
    const room = gameManager.getRoom(socketToRoom.get(socket.id));
    if (!room) return callback({ ok: false, error: 'No estas en ninguna sala' });

    try {
      room.chooseColor(socket.id, colorId);
      callback({ ok: true });
      io.to(room.code).emit('room_updated', publicRoomState(room));
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('start_game', (_, callback) => {
    const room = gameManager.getRoom(socketToRoom.get(socket.id));
    if (!room) return callback({ ok: false, error: 'No estas en ninguna sala' });
    if (room.hostSocketId !== socket.id) {
      return callback({ ok: false, error: 'Solo el host puede iniciar la partida' });
    }

    try {
      const { turnOrder, firstTurnSocketId } = room.start();
      const firstNick = room.players.get(firstTurnSocketId).nick;

      callback({ ok: true });
      io.to(room.code).emit('game_started', {
        room: publicRoomState(room),
        turnOrder,
        firstTurnNick: firstNick,
      });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('roll_dice', (_, callback) => {
    const room = gameManager.getRoom(socketToRoom.get(socket.id));
    if (!room) return callback({ ok: false, error: 'No estas en ninguna sala' });
    if (room.status !== 'playing') return callback({ ok: false, error: 'La partida no ha iniciado' });
    if (room.currentTurnSocketId() !== socket.id) {
      return callback({ ok: false, error: 'No es tu turno' });
    }

    const result = rollTurn(room.diceType);
    callback({ ok: true, result });
    io.to(room.code).emit('dice_rolled', {
      socketId: socket.id,
      nick: room.players.get(socket.id).nick,
      result,
    });

    // NOTA: aqui todavia falta conectar la logica de mover fichas segun cada
    // valor de result.rolls (siguiente fase del proyecto: movimiento y
    // capturas). Por ahora, si el ultimo valor tirado no fue 6, se pasa el
    // turno al siguiente jugador automaticamente.
    const lastRoll = result.rolls[result.rolls.length - 1];
    if (lastRoll !== 6) {
      const nextSocketId = room.advanceTurn();
      io.to(room.code).emit('turn_changed', {
        nick: room.players.get(nextSocketId).nick,
        socketId: nextSocketId,
      });
    }
  });

  socket.on('disconnect', () => {
    const code = socketToRoom.get(socket.id);
    const room = gameManager.getRoom(code);
    if (!room) return;

    room.markDisconnected(socket.id);
    io.to(room.code).emit('player_disconnected', { socketId: socket.id, graceMs: RECONNECT_GRACE_MS });

    setTimeout(() => {
      if (room.shouldBecomeBot(socket.id)) {
        const player = room.players.get(socket.id);
        if (player) {
          player.isBot = true;
          io.to(room.code).emit('player_became_bot', { socketId: socket.id, nick: player.nick });
        }
      }
    }, RECONNECT_GRACE_MS + 500);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor de Ludo escuchando en puerto ${PORT}`);
});

module.exports = { app, server, io };
