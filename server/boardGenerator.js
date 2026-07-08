// Genera la estructura logica del tablero (no visual, solo posiciones) para
// cualquier cantidad de jugadores usando el mismo patron que ya usan tus
// bocetos de 8 y 10: cada jugador tiene su propio carril (arm) en la pista
// principal compartida, mas su propia escalera final (home stretch).
//
// Esto permite generar de forma consistente los tableros de 4, 6, 8 y 10
// jugadores con la misma formula, evitando el problema que tenia el boceto
// original de 6 (jugadores sin carril propio).

const HOME_STRETCH_LENGTH = 6; // casillas de la escalera final de cada color

// El tablero de 4 (cruz clasica) y los circulares (6/8/10) tienen geometrias
// distintas por como se conectan sus brazos, asi que cada uno tiene su propia
// cantidad de casillas por brazo y su propio offset de "giro hacia la
// escalera". Estos valores estan sincronizados exactamente con
// client/board/crossBoard.js y client/board/radialBoard.js -- si se cambia
// uno hay que cambiar el otro.
const BOARD_SPECS = {
  4: { cellsPerArm: 14, stretchOffset: 2 },  // cruz: verificado por geometria (ver crossBoard.js)
  6: { cellsPerArm: 8, stretchOffset: 1 },
  8: { cellsPerArm: 8, stretchOffset: 1 },
  10: { cellsPerArm: 8, stretchOffset: 1 },
};

function generateBoard(playerCount) {
  const spec = BOARD_SPECS[playerCount];
  if (!spec) {
    throw new Error(`Cantidad de jugadores no soportada: ${playerCount}`);
  }

  const { cellsPerArm, stretchOffset } = spec;
  const mainTrackLength = playerCount * cellsPerArm;
  const safeOffsetFromEntry = Math.floor(cellsPerArm / 2);
  const players = [];

  for (let i = 0; i < playerCount; i++) {
    const entryPoint = i * cellsPerArm;
    // La casilla desde la que el jugador dobla hacia su propia escalera
    // final, tras dar toda la vuelta al tablero.
    const homeStretchEntry = (entryPoint - stretchOffset + mainTrackLength) % mainTrackLength;
    const safeCell = (entryPoint + safeOffsetFromEntry) % mainTrackLength;

    players.push({
      index: i,
      entryPoint,
      homeStretchEntry,
      homeStretchLength: HOME_STRETCH_LENGTH,
      safeCells: [entryPoint, safeCell],
    });
  }

  return {
    playerCount,
    mainTrackLength,
    cellsPerArm,
    stretchOffset,
    players,
  };
}

// Convierte la posicion de una ficha (relativa al recorrido de SU jugador,
// empezando en 0 al salir del nido) a la casilla absoluta en la pista
// principal, o indica que ya esta en su escalera final.
function resolvePiecePosition(board, playerIndex, stepsFromEntry) {
  const player = board.players[playerIndex];
  // Un jugador dobla hacia su escalera "stretchOffset" casillas antes de
  // completar la vuelta completa (ver BOARD_SPECS).
  const totalMainSteps = board.mainTrackLength - board.stretchOffset;

  if (stepsFromEntry < totalMainSteps) {
    const absoluteCell = (player.entryPoint + stepsFromEntry) % board.mainTrackLength;
    return { zone: 'main_track', cell: absoluteCell };
  }

  const homeStretchStep = stepsFromEntry - totalMainSteps;
  if (homeStretchStep < player.homeStretchLength) {
    return { zone: 'home_stretch', cell: homeStretchStep };
  }

  return { zone: 'finished' };
}

module.exports = { generateBoard, resolvePiecePosition, BOARD_SPECS, HOME_STRETCH_LENGTH };
