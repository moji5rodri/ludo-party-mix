const { PLAYER_COLORS } = require('./colors');
const { generateBoard } = require('./boardGenerator');

const RECONNECT_GRACE_MS = 20000; // 20 segundos para reconectar antes de pasar a IA

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin letras/numeros confusos
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

class Room {
  constructor({ hostSocketId, maxPlayers, tokensPerPlayer, diceType }) {
    this.code = generateRoomCode();
    this.hostSocketId = hostSocketId;
    this.maxPlayers = maxPlayers; // 4, 6, 8 o 10
    this.tokensPerPlayer = tokensPerPlayer; // 2, 3 o 4
    this.diceType = diceType; // 'simple' | 'mega' (mega solo valido si maxPlayers es 8 o 10)
    this.board = generateBoard(maxPlayers);

    this.players = new Map(); // socketId -> player
    this.turnOrder = []; // array de socketId en el orden de juego (random al iniciar)
    this.currentTurnIndex = 0;
    this.status = 'waiting'; // waiting | playing | finished
    this.winner = null;

    if (diceType === 'mega' && ![8, 10].includes(maxPlayers)) {
      throw new Error('El mega dado solo esta disponible en mesas de 8 o 10 jugadores');
    }
  }

  addPlayer(socketId, nick) {
    if (this.players.size >= this.maxPlayers) {
      throw new Error('La sala ya esta llena');
    }
    this.players.set(socketId, {
      socketId,
      nick,
      color: null,
      slotIndex: null, // posicion asignada en el tablero (aleatoria si faltan jugadores)
      connected: true,
      isBot: false,
      disconnectedAt: null,
      pieces: [], // se inicializa al arrancar la partida
    });
    return this.players.get(socketId);
  }

  chooseColor(socketId, colorId) {
    const colorTaken = [...this.players.values()].some((p) => p.color === colorId);
    if (colorTaken) throw new Error('Ese color ya lo escogio otro jugador');

    const color = PLAYER_COLORS.find((c) => c.id === colorId);
    if (!color) throw new Error('Color invalido');

    this.players.get(socketId).color = color.id;
    return color;
  }

  availableColors() {
    const taken = new Set([...this.players.values()].map((p) => p.color).filter(Boolean));
    return PLAYER_COLORS.filter((c) => !taken.has(c.id));
  }

  canStart() {
    return this.players.size >= 2 && this.status === 'waiting';
  }

  // Asigna posiciones de nido. Si la sala no se lleno, las posiciones se
  // reparten al azar entre los slots disponibles del tablero (mas justo,
  // evita que los conectados queden todos juntos).
  start() {
    if (!this.canStart()) throw new Error('No se puede iniciar la partida todavia');

    const allSlots = Array.from({ length: this.maxPlayers }, (_, i) => i);
    for (let i = allSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
    }

    const connectedIds = [...this.players.keys()];
    connectedIds.forEach((socketId, i) => {
      const player = this.players.get(socketId);
      player.slotIndex = allSlots[i];
      player.pieces = Array.from({ length: this.tokensPerPlayer }, (_, pieceIdx) => ({
        pieceIdx,
        state: 'nest', // nest | main_track | home_stretch | finished
        stepsFromEntry: 0,
      }));
    });

    // Turno inicial aleatorio, luego sigue hacia la derecha (mismo orden en
    // que fueron ordenados los slots, ya que los slots ya representan la
    // disposicion alrededor del tablero en sentido horario).
    this.turnOrder = connectedIds
      .slice()
      .sort((a, b) => this.players.get(a).slotIndex - this.players.get(b).slotIndex);

    this.currentTurnIndex = Math.floor(Math.random() * this.turnOrder.length);
    this.status = 'playing';

    return {
      turnOrder: this.turnOrder.map((id) => this.players.get(id).nick),
      firstTurnSocketId: this.turnOrder[this.currentTurnIndex],
    };
  }

  currentTurnSocketId() {
    return this.turnOrder[this.currentTurnIndex];
  }

  advanceTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    return this.currentTurnSocketId();
  }

  // Se llama tras cada movimiento de ficha para revisar si ese jugador ya
  // metio todas sus fichas en casa.
  checkWinner(socketId) {
    const player = this.players.get(socketId);
    const allHome = player.pieces.every((p) => p.state === 'finished');
    if (allHome) {
      this.status = 'finished';
      this.winner = { socketId, nick: player.nick, color: player.color };
      return this.winner;
    }
    return null;
  }

  markDisconnected(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = Date.now();
  }

  // Devuelve true si el jugador debe pasar a control por IA (se le acabo el
  // tiempo de gracia de reconexion).
  shouldBecomeBot(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.connected) return false;
    return Date.now() - player.disconnectedAt >= RECONNECT_GRACE_MS;
  }
}

class GameManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
  }

  createRoom(params) {
    const room = new Room(params);
    this.rooms.set(room.code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  removeRoom(code) {
    this.rooms.delete(code);
  }
}

module.exports = { GameManager, Room, RECONNECT_GRACE_MS };
