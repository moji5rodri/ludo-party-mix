# LUDO Party Mix — Fase 1 (MVP)

Ludo multijugador en tiempo real para el grupo. Esta primera fase cubre:
mesa de **4 jugadores**, dado normal, sala con contraseña de acceso, código
de sala reutilizable, elección de color (20 disponibles), turnos, captura,
pasillo privado y pantalla de ganador.

## Cómo correrlo

Necesitás **Node.js 18 o más nuevo** instalado.

```bash
npm install
LUDO_PASSWORD=laClaveDelGrupo npm start
```

Por defecto corre en `http://localhost:3000`. Si no ponés `LUDO_PASSWORD`,
usa `cambiaesto123` — **cambiala antes de compartir el link con la banda**.

Para que tus amigos se conecten desde afuera de tu red, necesitás:
- Subirlo a un hosting que soporte Node.js corriendo (Render, Railway, un VPS, etc. — no sirve un hosting de solo archivos estáticos), o
- Exponerlo temporalmente con algo como `ngrok` mientras jugás desde tu PC.

## Qué falta (según lo planeado, para las próximas fases)

- **Tableros de 6, 8 y 10 jugadores** — falta ajustar la geometría del
  tablero (`public/js/board.js`) a tus imágenes de referencia. El motor del
  juego (`game/gameEngine.js`) ya es genérico y soporta cualquier cantidad
  de jugadores sin cambios; solo falta el dibujo.
- **Mega dado de 12 lados** (habilitado solo para mesas de 8/10) — la regla
  está soportada en el motor (`diceMode: 'mega'`), falta habilitarlo en la
  interfaz de creación de sala.
- **Posicionamiento aleatorio cuando faltan jugadores** — ya funciona (los
  slots se reparten al azar entre los jugadores conectados).
- **Modo oscuro** — el botón ya cambia el tema (`#141822`), pero conviene
  revisar contraste de las 20 fichas de color sobre fondo oscuro.
- **Rotación automática del tablero en mobile** (para que tu base quede
  siempre abajo) — no implementada todavía.
- **Sonidos**: por ahora son beeps generados por código (sin archivos de
  audio). Se pueden reemplazar por archivos `.mp3`/`.ogg` en
  `public/sounds/` más adelante.
- **Persistencia**: todo vive en memoria del servidor, tal como lo pediste
  (si el servidor se reinicia, la partida se pierde).

## Estructura del proyecto

```
ludo-party-mix/
├── server.js              # Servidor Express + Socket.io, maneja sala/turnos
├── game/
│   └── gameEngine.js       # Reglas del juego: dado, movimiento, captura, victoria
├── public/
│   ├── index.html          # Todas las pantallas (acceso, lobby, tablero, ganador)
│   ├── css/style.css       # Estilos
│   └── js/
│       ├── board.js        # Dibuja el tablero en SVG
│       └── main.js         # Lógica de cliente (sockets, pantallas, sonidos)
└── package.json
```

## Notas sobre la lógica del tablero

Cada jugador tiene un "brazo" de 5 casillas compartidas con los demás
(por eso mesa de 4 → camino compartido de 20 casillas), y un pasillo
privado de 5 casillas para llegar a casa. La 1ª casilla de cada brazo y
la 3ª son estrellas seguras (nadie puede matar ahí, pero sí apilarse).
Esto está definido como constantes al principio de `gameEngine.js`
(`ARM_LENGTH`, `HOME_LENGTH`) por si querés ajustarlo.
