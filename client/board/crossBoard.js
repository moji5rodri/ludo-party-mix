// Tablero clasico de 4 jugadores (forma de cruz, como tu boceto original).
// Grilla de 15x15. Todas las coordenadas fueron validadas por codigo:
// el anillo compartido cierra en un solo ciclo de 56 casillas sin huecos.

export const GRID_SIZE = 15;
export const CELLS_PER_ARM = 14; // 56 casillas de anillo / 4 jugadores
export const RING_LENGTH = 56;
export const STRETCH_LENGTH = 6;

// El anillo compartido, en orden (indice 0 = salida del nido de green).
export const RING_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];

// Orden de colores fijo para este tablero, en sentido horario, empezando
// arriba-izquierda (coincide con tu boceto original).
export const PLAYER_ORDER = ['verde', 'azul', 'amarillo', 'rojo'];

export const PLAYERS = PLAYER_ORDER.map((colorId, i) => ({
  colorId,
  entryIndex: i * CELLS_PER_ARM,
  // Un jugador se desvia a su escalera 2 casillas antes de completar la
  // vuelta completa (verificado por geometria: el "codo" de conexion entre
  // brazos ocupa esas 2 casillas extra).
  stretchBranchIndex: (i * CELLS_PER_ARM - 2 + RING_LENGTH) % RING_LENGTH,
  safeIndices: [i * CELLS_PER_ARM, (i * CELLS_PER_ARM + 8) % RING_LENGTH],
}));

// Las 4 escaleras privadas (6 casillas cada una, de afuera hacia el centro)
export const STRETCHES = {
  azul:     Array.from({ length: 6 }, (_, i) => [1 + i, 7]),   // brazo superior
  amarillo: Array.from({ length: 6 }, (_, i) => [7, 8 + i]),   // brazo derecho
  rojo:     Array.from({ length: 6 }, (_, i) => [8 + i, 7]),   // brazo inferior
  verde:    Array.from({ length: 6 }, (_, i) => [7, 1 + i]),   // brazo izquierdo
};

// Casas (nidos), cada una un cuadrado de 6x6 en su esquina
export const HOMES = {
  verde:    { rowStart: 0, colStart: 0 },
  azul:     { rowStart: 0, colStart: 9 },
  amarillo: { rowStart: 9, colStart: 9 },
  rojo:     { rowStart: 9, colStart: 0 },
};

export const CENTER_CELL = [7, 7];

// Convierte una celda de grilla (fila, columna) a coordenadas de pixel.
export function gridToPixel(row, col, cellSize) {
  return { x: col * cellSize, y: row * cellSize };
}

export function boardPixelSize(cellSize) {
  return GRID_SIZE * cellSize;
}
