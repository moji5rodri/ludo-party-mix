// LUDO Party Mix - board.js
// Dibuja un tablero esquemático basado en el modelo de camino compartido (ver gameEngine.js).
// NOTA: esta es una versión funcional para probar la mecánica en la Fase 1 (mesa de 4).
// El diseño visual final se ajustará cuando tengamos las imágenes de referencia de las
// mesas de 6, 8 y 10 jugadores.

const CELL = 46;

function ringCellsFor(n) {
  // Perímetro de una grilla n x n, en sentido horario empezando arriba-izquierda.
  const cells = [];
  for (let c = 0; c < n; c++) cells.push({ row: 0, col: c });
  for (let r = 1; r < n; r++) cells.push({ row: r, col: n - 1 });
  for (let c = n - 2; c >= 0; c--) cells.push({ row: n - 1, col: c });
  for (let r = n - 2; r >= 1; r--) cells.push({ row: r, col: 0 });
  return cells;
}

function renderBoard(container, state, myPlayerId, handlers) {
  const n = state.loop / 4 + 1; // solo válido para slotsCount = 4 (Fase 1)
  const ring = ringCellsFor(n);
  const size = n * CELL;
  const pad = CELL * 1.6;
  const vb = size + pad * 2;

  const isSafe = (abs) => {
    const rel = ((abs % state.loop) + state.loop) % state.loop % state.armLength;
    return rel === 0 || rel === 2;
  };

  const cellCenter = (idx) => {
    const cell = ring[idx];
    return { x: pad + cell.col * CELL + CELL / 2, y: pad + cell.row * CELL + CELL / 2 };
  };

  let svg = `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">`;

  // Casillas del camino compartido
  for (let i = 0; i < ring.length; i++) {
    const { x, y } = cellCenter(i);
    const safe = isSafe(i);
    svg += `<rect x="${x - CELL / 2 + 2}" y="${y - CELL / 2 + 2}" width="${CELL - 4}" height="${CELL - 4}"
      rx="6" fill="${safe ? '#EFEFEF' : 'var(--board-bg,#fff)'}" stroke="var(--board-line,#ccc)" stroke-width="1.5" />`;
    if (safe) {
      svg += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" fill="#9E9E9E">★</text>`;
    }
  }

  // Bases (zonas de salida) por jugador, en las esquinas
  const corners = [
    { x: pad * 0.5, y: pad * 0.5 },
    { x: vb - pad * 0.5, y: pad * 0.5 },
    { x: vb - pad * 0.5, y: vb - pad * 0.5 },
    { x: pad * 0.5, y: vb - pad * 0.5 },
  ];

  state.players.forEach((p) => {
    const corner = corners[p.slot % corners.length];
    svg += `<circle cx="${corner.x}" cy="${corner.y}" r="${pad * 0.42}" fill="${p.color}22" stroke="${p.color}" stroke-width="3" />`;
    svg += `<text x="${corner.x}" y="${corner.y - pad * 0.42 - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="${p.color === '#FFFFFF' ? '#333' : p.color}">${escapeXml(p.nick)}</text>`;
  });

  // Fichas: agrupamos por celda absoluta para poder "apilarlas" con offset
  const groups = {};
  const homeGroups = {}; // fichas en pasillo privado o en casa, agrupadas por jugador
  state.players.forEach((p) => {
    p.tokens.forEach((t) => {
      if (t.r === 0) return; // en base, no se dibuja en el tablero por ahora
      if (t.r >= 1 && t.r <= state.loop) {
        const abs = (p.slot * state.armLength + (t.r - 1)) % state.loop;
        groups[abs] = groups[abs] || [];
        groups[abs].push({ token: t, player: p });
      } else {
        homeGroups[p.id] = homeGroups[p.id] || [];
        homeGroups[p.id].push(t);
      }
    });
  });

  Object.entries(groups).forEach(([abs, list]) => {
    const { x, y } = cellCenter(Number(abs));
    list.forEach((item, i) => {
      const offset = list.length > 1 ? (i - (list.length - 1) / 2) * 10 : 0;
      svg += tokenSvg(x + offset, y, item.player.color, item.token.id, myPlayerId === item.player.id);
    });
  });

  // Fichas en pasillo privado / casa: las mostramos apiladas cerca de su esquina, hacia el centro
  const center = { x: vb / 2, y: vb / 2 };
  state.players.forEach((p) => {
    const list = homeGroups[p.id] || [];
    const corner = corners[p.slot % corners.length];
    list.forEach((t, i) => {
      const progress = Math.min((t.r - state.loop) / state.homeLength, 1); // 0..1 hacia el centro
      const x = corner.x + (center.x - corner.x) * (0.55 + progress * 0.4) + i * 12 - 12;
      const y = corner.y + (center.y - corner.y) * (0.55 + progress * 0.4);
      svg += tokenSvg(x, y, p.color, t.id, myPlayerId === p.id, t.r === state.finish);
    });
  });

  svg += `<circle cx="${vb / 2}" cy="${vb / 2}" r="${CELL * 0.9}" fill="#FFF8E1" stroke="#E8A93B" stroke-width="2" />`;
  svg += `<text x="${vb / 2}" y="${vb / 2 + 5}" text-anchor="middle" font-size="20">🏠</text>`;

  svg += '</svg>';
  container.innerHTML = svg;

  if (handlers && handlers.onTokenClick) {
    container.querySelectorAll('[data-token-id]').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => handlers.onTokenClick(el.getAttribute('data-token-id')));
    });
  }
}

function tokenSvg(x, y, color, tokenId, mine, finished) {
  const stroke = color === '#000000' ? '#fff' : (color === '#FFFFFF' ? '#333' : '#0006');
  const highlight = mine ? `filter="drop-shadow(0 0 3px ${color})"` : '';
  return `<g data-token-id="${tokenId}" class="token-piece" ${highlight}>
    <circle cx="${x}" cy="${y}" r="10" fill="${color}" stroke="${stroke}" stroke-width="1.5" />
    ${finished ? `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="9">✓</text>` : ''}
  </g>`;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

window.LudoBoard = { renderBoard };
