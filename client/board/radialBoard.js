// Tablero circular generico para 6, 8 o 10 jugadores. A diferencia de la
// cruz clasica, aqui el anillo compartido es un circulo simple (sin
// "codos"), lo que hace la geometria mucho mas directa: cada jugador tiene
// un brazo de recorrido propio a partes iguales alrededor del circulo.

export const CELLS_PER_ARM = 8;   // casillas de anillo por jugador
export const STRETCH_LENGTH = 6;  // casillas de la escalera privada

export const R_HOME = 340;    // radio del centro de cada casa/nido
export const R_RING = 260;    // radio del anillo compartido
export const R_CENTER = 55;   // radio de la zona de meta central
export const VIEWBOX = 760;   // tablero cuadrado, viewBox VIEWBOX x VIEWBOX

function polarToXY(angleDeg, radius, cx = VIEWBOX / 2, cy = VIEWBOX / 2) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// Genera toda la estructura geometrica para una mesa de `playerCount`
// jugadores (6, 8 o 10). Devuelve posiciones de pixel listas para dibujar.
export function generateRadialBoard(playerCount) {
  const mainTrackLength = playerCount * CELLS_PER_ARM;
  const degPerCell = 360 / mainTrackLength;
  const degPerPlayer = 360 / playerCount;

  // Posicion de cada casilla del anillo compartido (indice 0..mainTrackLength-1)
  const ringPositions = [];
  for (let k = 0; k < mainTrackLength; k++) {
    const angle = -90 + k * degPerCell; // -90 = arriba, sentido horario
    ringPositions.push({ index: k, angle, ...polarToXY(angle, R_RING) });
  }

  const players = [];
  for (let i = 0; i < playerCount; i++) {
    const entryIndex = i * CELLS_PER_ARM;
    const stretchBranchIndex = (entryIndex - 1 + mainTrackLength) % mainTrackLength;
    const midAngle = -90 + (i + 0.5) * degPerPlayer;

    // Escalera privada: del anillo (radio R_RING) hacia el centro (radio R_CENTER)
    const stretchCells = Array.from({ length: STRETCH_LENGTH }, (_, s) => {
      const t = (s + 1) / (STRETCH_LENGTH + 1); // interpolacion 0..1 hacia el centro
      const radius = R_RING - t * (R_RING - R_CENTER);
      return { step: s, angle: midAngle, ...polarToXY(midAngle, radius) };
    });

    players.push({
      index: i,
      entryIndex,
      stretchBranchIndex,
      safeIndices: [entryIndex, (entryIndex + Math.floor(CELLS_PER_ARM / 2)) % mainTrackLength],
      midAngle,
      home: polarToXY(midAngle, R_HOME),
      stretchCells,
    });
  }

  return {
    playerCount,
    mainTrackLength,
    viewBox: VIEWBOX,
    ringPositions,
    centerPoint: { x: VIEWBOX / 2, y: VIEWBOX / 2 },
    players,
  };
}
