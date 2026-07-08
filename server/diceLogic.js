// Reglas del dado simple (6 caras):
// - 1 o 6 permiten sacar ficha del nido
// - Si sale 6, se puede volver a tirar, maximo 3 tiros seguidos en la tanda
// - Si sale 1, NO se repite tiro (solo sirve para avanzar/sacar)
//
// Reglas del mega dado (12 caras), solo mesas de 8 o 10:
// - 1, 6 o 12 permiten sacar ficha del nido
// - Si sale 6, se puede volver a tirar (misma regla de maximo 3 tiros por 6)
// - Si sale 12, se otorga UN tiro extra adicional (no se acumula con el limite de 6)

const MAX_REROLLS_BY_SIX = 3;

function rollSimpleDie() {
  return 1 + Math.floor(Math.random() * 6);
}

function rollMegaDie() {
  return 1 + Math.floor(Math.random() * 12);
}

// Ejecuta una tanda completa de tiros (puede ser mas de un valor si hay
// repeticiones por 6 o por 12) y devuelve la lista de resultados en orden,
// junto con info de si la tanda se paso de 6's seguidos (turno perdido, regla
// clasica opcional) y si se puede sacar ficha del nido.
function rollTurn(diceType) {
  const isMega = diceType === 'mega';
  const rollFn = isMega ? rollMegaDie : rollSimpleDie;
  const getOutValues = isMega ? [1, 6, 12] : [1, 6];

  const rolls = [];
  let sixesInARow = 0;
  let extraFromTwelveUsed = false;

  while (true) {
    const value = rollFn();
    rolls.push(value);

    if (value === 6) {
      sixesInARow++;
      if (sixesInARow >= MAX_REROLLS_BY_SIX) break; // se agotaron los 3 tiros por 6
      continue; // tira de nuevo
    }

    if (isMega && value === 12 && !extraFromTwelveUsed) {
      extraFromTwelveUsed = true;
      continue; // un tiro extra por el 12, solo una vez
    }

    break; // valor normal, no repite
  }

  return {
    rolls,
    canBringPieceOut: rolls.some((v) => getOutValues.includes(v)),
    totalMovementValues: rolls, // cada valor se aplica como un movimiento independiente
  };
}

module.exports = { rollSimpleDie, rollMegaDie, rollTurn, MAX_REROLLS_BY_SIX };
