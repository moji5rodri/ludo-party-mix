import { renderBoard } from './boardRenderer.js';
import { PLAYER_COLORS } from '../colors.js';

function hexOf(colorId) {
  const found = PLAYER_COLORS.find((c) => c.id === colorId);
  return found ? found.hex : '#999999';
}

// Dibuja el tablero completo (SVG) dentro de #board-container, respetando
// los colores y nicks reales de los jugadores conectados en la sala.
function paintBoard(room) {
  const container = document.getElementById('board-container');
  const svg = renderBoard({ maxPlayers: room.maxPlayers, players: room.players });

  // Reinsertamos el SVG pero conservamos la capa de fichas (piece-layer)
  const pieceLayer = document.getElementById('piece-layer');
  container.innerHTML = svg;
  container.appendChild(pieceLayer);
}

// Muestra la pantalla "EL GANADOR:" con fichas del color del ganador
// saltando de alegria a los lados, como pediste.
function showVictory(nick, colorId) {
  const overlay = document.getElementById('victory-overlay');
  const hex = hexOf(colorId);

  document.getElementById('victory-nick').textContent = nick;

  const row = document.getElementById('victory-pieces-row');
  row.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const piece = document.createElement('div');
    piece.className = 'victory-piece';
    piece.style.background = hex;
    row.appendChild(piece);
  }

  overlay.style.display = 'flex';
}

function hideVictory() {
  document.getElementById('victory-overlay').style.display = 'none';
}

// Puente hacia app.js (script clasico, no modulo): exponemos estas
// funciones en window para poder llamarlas desde alli.
window.LudoGame = { paintBoard, showVictory, hideVictory };
