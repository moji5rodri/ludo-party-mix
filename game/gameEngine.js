// LUDO Party Mix - motor del juego (Fase 1)
// Camino compartido acortado: cada jugador tiene un "brazo" de ARM_LENGTH casillas.
// loop = ARM_LENGTH * slotsCount (casillas compartidas dando la vuelta al tablero)
// Luego cada ficha se desvía a su pasillo privado de HOME_LENGTH casillas para llegar a casa.

const ARM_LENGTH = 5;   // casillas compartidas por jugador (según especificación: 5 espacios)
const HOME_LENGTH = 5;  // casillas del pasillo privado hacia casa
const MAX_SIX_REROLLS = 3; // "hasta 3 veces máximo"
const SURRENDER_UNLOCK_MS = 5 * 60 * 1000; // 5 minutos

function createGame({ players, slotsCount, tokensPerPlayer, diceMode }) {
  const loop = ARM_LENGTH * slotsCount;
  const finish = loop + HOME_LENGTH; // valor de "r" cuando la ficha llega a casa

  // Asignación de posiciones (slots) al azar entre los jugadores conectados,
  // para que si hay menos jugadores que espacios, no queden todos pegados.
  const slotIndices = shuffle([...Array(slotsCount).keys()]).slice(0, players.length);
  const gamePlayers = players.map((p, i) => ({
    id: p.id,
    nick: p.nick,
    color: p.color,
    slot: slotIndices[i],
    abandoned: false,
    surrendered: false,
    tokens: Array.from({ length: tokensPerPlayer }, (_, ti) => ({
      id: `${p.id}_t${ti}`,
      r: 0, // 0 = en base
    })),
  }));

  // Orden de turnos: siempre hacia la derecha => orden por número de slot ascendente
  // (se asume que los slots están dispuestos en sentido horario alrededor del tablero).
  const turnOrder = [...gamePlayers].sort((a, b) => a.slot - b.slot).map(p => p.id);

  let currentTurnIdx = Math.floor(Math.random() * turnOrder.length); // primer jugador aleatorio
  let sixesInARow = 0;
  let pendingRoll = null; // { value, movableTokenIds }
  let winner = null;
  let startedAt = Date.now();
  let winOrder = [];

  function isSafeAbs(abs) {
    const rel = ((abs % loop) + loop) % loop % ARM_LENGTH;
    return rel === 0 || rel === 2; // casilla de salida (0) o estrella gris (2)
  }

  function absCellFor(player, r) {
    // Solo tiene sentido si r está dentro del tramo compartido (1..loop)
    const start = player.slot * ARM_LENGTH;
    return (start + (r - 1)) % loop;
  }

  function currentPlayer() {
    return gamePlayers.find(p => p.id === turnOrder[currentTurnIdx]);
  }

  function advanceTurn() {
    sixesInARow = 0;
    pendingRoll = null;
    let attempts = 0;
    do {
      currentTurnIdx = (currentTurnIdx + 1) % turnOrder.length;
      attempts++;
    } while (
      attempts <= turnOrder.length &&
      isPlayerOut(gamePlayers.find(p => p.id === turnOrder[currentTurnIdx]))
    );
  }

  function isPlayerOut(p) {
    return !p || p.abandoned || p.surrendered;
  }

  function activePlayers() {
    return gamePlayers.filter(p => !isPlayerOut(p));
  }

  function checkWin(player) {
    return player.tokens.every(t => t.r === finish);
  }

  function movableTokensFor(player, diceValue) {
    return player.tokens.filter(t => canMove(t, diceValue)).map(t => t.id);
  }

  function canMove(token, diceValue) {
    if (token.r === finish) return false;
    if (token.r === 0) {
      return diceValue === 1 || diceValue === 6 || (diceMode === 'mega' && diceValue === 12);
    }
    return token.r + diceValue <= finish;
  }

  function rollDice(playerId) {
    const player = currentPlayer();
    if (!player || player.id !== playerId) return { error: 'No es tu turno.' };
    if (pendingRoll) return { error: 'Ya tiraste el dado, mové una ficha.' };

    const sides = diceMode === 'mega' ? 12 : 6;
    const value = 1 + Math.floor(Math.random() * sides);
    const isBonusValue = diceMode === 'mega' ? (value === 6 || value === 12) : value === 6;

    const movable = movableTokensFor(player, value);

    let turnEnded = false;
    if (movable.length === 0) {
      // Nadie se puede mover con este valor.
      if (isBonusValue && sixesInARow < MAX_SIX_REROLLS) {
        sixesInARow++;
        pendingRoll = null; // puede tirar de nuevo
      } else {
        turnEnded = true;
        advanceTurn();
      }
    } else {
      pendingRoll = { value, movableTokenIds: movable, isBonusValue };
    }

    return {
      playerId,
      value,
      movableTokenIds: movable,
      turnEnded,
      nextPlayerId: turnEnded ? currentPlayer()?.id : playerId,
      canRerollAgain: movable.length === 0 && isBonusValue && sixesInARow <= MAX_SIX_REROLLS,
    };
  }

  function moveToken(playerId, tokenId) {
    const player = currentPlayer();
    if (!player || player.id !== playerId) return { error: 'No es tu turno.' };
    if (!pendingRoll) return { error: 'Primero tenés que tirar el dado.' };
    if (!pendingRoll.movableTokenIds.includes(tokenId)) return { error: 'Esa ficha no se puede mover con ese valor.' };

    const token = player.tokens.find(t => t.id === tokenId);
    const diceValue = pendingRoll.value;
    const wasBonus = pendingRoll.isBonusValue;
    let captured = null;

    if (token.r === 0) {
      token.r = 1; // sale de la base a su propia casilla de salida
    } else {
      token.r += diceValue;
    }

    // Captura: solo si sigue en el tramo compartido (no en casa ni pasillo privado)
    if (token.r >= 1 && token.r <= loop) {
      const abs = absCellFor(player, token.r);
      if (!isSafeAbs(abs)) {
        for (const other of gamePlayers) {
          if (other.id === player.id) continue;
          for (const ot of other.tokens) {
            if (ot.r >= 1 && ot.r <= loop && absCellFor(other, ot.r) === abs) {
              ot.r = 0; // vuelve a la base
              captured = { playerId: other.id, tokenId: ot.id };
            }
          }
        }
      }
    }

    pendingRoll = null;

    if (checkWin(player)) {
      winner = player.id;
      winOrder.push(player.id);
      return { playerId, tokenId, newR: token.r, captured, winner, turnEnded: true };
    }

    let turnEnded = true;
    if (wasBonus && sixesInARow < MAX_SIX_REROLLS) {
      sixesInARow++;
      turnEnded = false; // tira de nuevo, mismo jugador
    } else {
      advanceTurn();
    }

    return {
      playerId,
      tokenId,
      newR: token.r,
      captured,
      winner: null,
      turnEnded,
      nextPlayerId: turnEnded ? currentPlayer()?.id : playerId,
    };
  }

  function autoPlayTurn() {
    // Se acabó el tiempo de turno: tira el dado sola y mueve una ficha aleatoria válida.
    const player = currentPlayer();
    if (!player) return { skipped: true };
    const roll = rollDice(player.id);
    if (roll.error) return { skipped: true };
    if (roll.movableTokenIds && roll.movableTokenIds.length > 0) {
      const randomTokenId = roll.movableTokenIds[Math.floor(Math.random() * roll.movableTokenIds.length)];
      const moveResult = moveToken(player.id, randomTokenId);
      return { auto: true, playerId: player.id, roll, moveResult };
    }
    return { auto: true, playerId: player.id, roll };
  }

  function surrender(playerId, now) {
    if (now - startedAt < SURRENDER_UNLOCK_MS) {
      return { error: 'Todavía no pasaron 5 minutos de partida.' };
    }
    const player = gamePlayers.find(p => p.id === playerId);
    if (!player) return { error: 'Jugador no encontrado.' };
    player.surrendered = true;
    if (currentPlayer()?.id === playerId) advanceTurn();
    maybeAutoWinBySurrenders();
    return { playerId };
  }

  function markAbandoned(playerId) {
    const player = gamePlayers.find(p => p.id === playerId);
    if (!player) return;
    player.abandoned = true;
    if (currentPlayer()?.id === playerId) advanceTurn();
    maybeAutoWinBySurrenders();
  }

  function maybeAutoWinBySurrenders() {
    const active = activePlayers();
    if (active.length === 1 && !winner) {
      winner = active[0].id;
    }
  }

  function getPublicState() {
    return {
      slotsCount,
      loop,
      armLength: ARM_LENGTH,
      homeLength: HOME_LENGTH,
      finish,
      diceMode,
      currentPlayerId: winner ? null : currentPlayer()?.id,
      pendingRoll,
      winner,
      surrenderUnlocksAt: startedAt + SURRENDER_UNLOCK_MS,
      players: gamePlayers.map(p => ({
        id: p.id, nick: p.nick, color: p.color, slot: p.slot,
        abandoned: p.abandoned, surrendered: p.surrendered,
        tokens: p.tokens.map(t => ({ id: t.id, r: t.r })),
      })),
    };
  }

  return {
    rollDice,
    moveToken,
    autoPlayTurn,
    surrender,
    markAbandoned,
    getPublicState,
    get winner() { return winner; },
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { createGame, ARM_LENGTH, HOME_LENGTH };
