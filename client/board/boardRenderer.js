import * as Cross from './crossBoard.js';
import { generateRadialBoard } from './radialBoard.js';
import { PLAYER_COLORS } from '../colors.js';

const CROSS_CELL_SIZE = 40; // px por celda en el tablero de 4

function hexOf(colorId) {
  const found = PLAYER_COLORS.find((c) => c.id === colorId);
  return found ? found.hex : null;
}

// ---------------------------------------------------------------------
// Tablero clasico de 4 (cruz)
// ---------------------------------------------------------------------
function renderCrossBoard(playersByColor) {
  const size = Cross.boardPixelSize(CROSS_CELL_SIZE);
  const cellsSVG = [];

  // Casillas del anillo compartido
  Cross.RING_PATH.forEach(([r, c], i) => {
    const { x, y } = Cross.gridToPixel(r, c, CROSS_CELL_SIZE);
    const isSafe = Cross.PLAYERS.some((p) => p.safeIndices.includes(i));
    cellsSVG.push(
      `<rect x="${x}" y="${y}" width="${CROSS_CELL_SIZE}" height="${CROSS_CELL_SIZE}" class="board-cell${isSafe ? ' board-cell-safe' : ''}" data-ring-index="${i}"/>`
    );
    if (isSafe) {
      cellsSVG.push(`<text x="${x + CROSS_CELL_SIZE / 2}" y="${y + CROSS_CELL_SIZE / 2 + 5}" class="board-star" text-anchor="middle">&#9733;</text>`);
    }
  });

  // Escaleras privadas (coloreadas segun el jugador real conectado en ese slot)
  Object.entries(Cross.STRETCHES).forEach(([colorId, cells]) => {
    const player = playersByColor[colorId];
    const fill = player ? hexOf(player.color) : 'var(--surface-2)';
    cells.forEach(([r, c]) => {
      const { x, y } = Cross.gridToPixel(r, c, CROSS_CELL_SIZE);
      cellsSVG.push(`<rect x="${x}" y="${y}" width="${CROSS_CELL_SIZE}" height="${CROSS_CELL_SIZE}" fill="${fill}" class="board-stretch-cell"/>`);
    });
  });

  // Casas (nidos) 6x6 por color
  const homesSVG = Object.entries(Cross.HOMES).map(([colorId, home]) => {
    const player = playersByColor[colorId];
    const fill = player ? hexOf(player.color) : 'var(--surface-2)';
    const { x, y } = Cross.gridToPixel(home.rowStart, home.colStart, CROSS_CELL_SIZE);
    const w = 6 * CROSS_CELL_SIZE;
    const nickLabel = player
      ? `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" class="home-nick">${escapeXML(player.nick)}</text>`
      : '';
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${w}" rx="14" fill="${fill}" class="home-base"/>
      <circle cx="${x + w / 2}" cy="${y + w / 2}" r="${w * 0.34}" fill="white" opacity="0.9"/>
      ${nickLabel}
    </g>`;
  });

  const { x: cx, y: cy } = Cross.gridToPixel(...Cross.CENTER_CELL, CROSS_CELL_SIZE);

  return `<svg viewBox="0 0 ${size} ${size}" class="ludo-board ludo-board-cross">
    ${cellsSVG.join('\n')}
    ${homesSVG.join('\n')}
    <rect x="${cx - CROSS_CELL_SIZE / 2}" y="${cy - CROSS_CELL_SIZE / 2}" width="${CROSS_CELL_SIZE}" height="${CROSS_CELL_SIZE}" class="board-meta"/>
  </svg>`;
}

// ---------------------------------------------------------------------
// Tablero circular (6, 8, 10)
// ---------------------------------------------------------------------
function renderRadialBoard(playerCount, playersBySlot) {
  const board = generateRadialBoard(playerCount);
  const cellR = 15; // radio de cada casilla del anillo

  const ringSVG = board.ringPositions.map((cell) => {
    const isSafe = board.players.some((p) => p.safeIndices.includes(cell.index));
    return `<circle cx="${cell.x}" cy="${cell.y}" r="${cellR}" class="board-cell${isSafe ? ' board-cell-safe' : ''}" data-ring-index="${cell.index}"/>` +
      (isSafe ? `<text x="${cell.x}" y="${cell.y + 4}" text-anchor="middle" class="board-star">&#9733;</text>` : '');
  }).join('\n');

  const stretchesSVG = board.players.map((p) => {
    const player = playersBySlot[p.index];
    const fill = player ? hexOf(player.color) : 'var(--surface-2)';
    return p.stretchCells.map((cell) =>
      `<circle cx="${cell.x}" cy="${cell.y}" r="${cellR}" fill="${fill}" class="board-stretch-cell"/>`
    ).join('\n');
  }).join('\n');

  const homesSVG = board.players.map((p) => {
    const player = playersBySlot[p.index];
    const fill = player ? hexOf(player.color) : 'var(--surface-2)';
    const nickLabel = player
      ? `<text x="${p.home.x}" y="${p.home.y + 62}" text-anchor="middle" class="home-nick">${escapeXML(player.nick)}</text>`
      : `<text x="${p.home.x}" y="${p.home.y + 62}" text-anchor="middle" class="home-nick home-nick-empty">Esperando...</text>`;
    return `<g>
      <circle cx="${p.home.x}" cy="${p.home.y}" r="46" fill="${fill}" class="home-base"/>
      <circle cx="${p.home.x}" cy="${p.home.y}" r="30" fill="white" opacity="0.9"/>
      ${nickLabel}
    </g>`;
  }).join('\n');

  return `<svg viewBox="0 0 ${board.viewBox} ${board.viewBox}" class="ludo-board ludo-board-radial">
    ${ringSVG}
    ${stretchesSVG}
    ${homesSVG}
    <circle cx="${board.centerPoint.x}" cy="${board.centerPoint.y}" r="55" class="board-meta"/>
  </svg>`;
}

function escapeXML(str) {
  return String(str).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------------
// Punto de entrada: recibe la config de la sala + jugadores conectados
// (con su color y nick) y devuelve el SVG del tablero completo.
// ---------------------------------------------------------------------
export function renderBoard({ maxPlayers, players }) {
  if (maxPlayers === 4) {
    const byColor = {};
    players.forEach((p) => { if (p.color) byColor[p.color] = p; });
    return renderCrossBoard(byColor);
  }

  const bySlot = {};
  players.forEach((p) => { if (p.slotIndex !== null && p.slotIndex !== undefined) bySlot[p.slotIndex] = p; });
  return renderRadialBoard(maxPlayers, bySlot);
}
