# FunnyMathPlanet - Portal de Juegos Matemáticos Web (HTML5 + Tailwind CSS + JS)

Suite de juegos matemáticos interactivos 100% nativos para navegador de **FunnyMathPlanet**. Toda la aplicación es estática e independiente, no requiere R, Shiny ni servidores backend, y funciona al instante en cualquier navegador web moderno (escritorio, tablet o móvil).

---

## 🎮 Catálogo de Juegos Disponibles

1. **🌀 Laberinto de Sumas** (`laberinto.html`):
   - Conecta Inicio con Final a través de Puntos Maestros y tramos de suma exacta.
   - Salón de la Fama persistente (Top 10 en `localStorage`), cronómetro en vivo y descarga de PDF A4.
2. **🎯 Sumas Emparejadas** (`sumas-emparejadas.html`):
   - Encuentra todas las parejas de hexágonos adyacentes que sumen el valor objetivo.
   - 6 formas geométricas configurables (*Rectángulo, Círculo, Donut, Rombo, Corazón y Casa*), contador de parejas descubiertas, solución interactiva y descarga de PDF A4.
3. **🧭 Busca el Tesoro: La Isla Matemática** (`hexatreasure.html`):
   - Triangula la casilla donde está enterrado el tesoro secreto a partir de las sumas de caminos mínimos desde las balizas (🌴 Palmera, ⛵ Barca, 🦜 Loro, 🪵 Barril, 💀 Calavera).
   - Herramientas de excavación (⛏️) y descarte (🚩 / ❌), Salón de la Fama, solución oficial y descarga de PDF A4 con pistas impresas al pie (ideal para jugar a lápiz o libros impresos KDP).

---

## 🚀 Cómo Ejecutar la Aplicación

### Opción 1: Ejecución Directa en Navegador
Haz doble clic sobre el archivo [`index.html`](index.html) para abrir el portal de juegos directamente en tu navegador (Chrome, Edge, Firefox, Safari).

### Opción 2: Servidor Local Estático (Opcional)
Si deseas servirlo localmente mediante cualquier servidor estático rápido:

- **Con Python**:
  ```bash
  cd web_app
  python -m http.server 8080
  ```
  Accede a `http://localhost:8080`.

- **Con Node.js (npx serve)**:
  ```bash
  npx serve web_app
  ```

---

## 🌐 Publicación y Despliegue en la Nube (100% Gratis)

Al ser una aplicación web estática pura (HTML + CSS + JS), puedes publicarla gratuitamente en cualquier servicio de hosting estático:

1. **GitHub Pages**: Sube la carpeta a un repositorio y activa GitHub Pages en la rama `main`.
2. **Cloudflare Pages / Vercel / Netlify**: Conecta el repositorio o arrastra la carpeta `web_app/` para obtener una URL pública con HTTPS automático.
3. **Tu propio servidor VPS (Nginx / Apache)**: Copia la carpeta `web_app/` a `/var/www/html/` o en tu subdirectorio web preferido.

---

## 📂 Estructura de Archivos

```text
web_app/
├── index.html                 # 🏠 Portal Principal / Catálogo de Juegos (3 juegos)
├── laberinto.html             # 🌀 Juego 1: Laberinto de Sumas
├── sumas-emparejadas.html     # 🎯 Juego 2: Sumas Emparejadas
├── hexatreasure.html          # 🧭 Juego 3: Busca el Tesoro (La Isla Matemática)
├── css/
│   └── styles.css             # Estilos y animaciones personalizadas
├── js/
│   ├── hexagon-grid.js        # Geometría hexagonal (6 formas)
│   ├── audio-fx.js            # Sintetizador Web Audio API (efectos de sonido nativos)
│   ├── ranking.js             # Gestor del Salón de la Fama independiente por juego
│   │
│   │   /* Módulos de Laberinto */
│   ├── maze-generator.js      # Generador procedimental de laberintos
│   ├── game-engine.js         # Motor interactivo del laberinto
│   ├── pdf-export.js          # Exportador de PDF A4 para laberintos
│   ├── app.js                 # Controlador UI del laberinto
│   │
│   │   /* Módulos de Sumas Emparejadas */
│   ├── pairs-generator.js     # Generador de parejas
│   ├── pairs-engine.js        # Motor interactivo de parejas
│   ├── pairs-pdf-export.js    # Exportador de PDF A4 para parejas
│   └── app-pairs.js           # Controlador UI de parejas
│   │
│   │   /* Módulos de HexaTreasure */
│   ├── treasure-generator.js  # Generador de triangulación deductiva y unicidad
│   ├── treasure-engine.js     # Motor interactivo de excavación y marcas
│   ├── treasure-pdf-export.js # Exportador de PDF A4 con cuadro de pistas
│   └── app-treasure.js        # Controlador UI de HexaTreasure
├── assets/
│   └── logoFMP.jpg            # Logotipo FunnyMathPlanet
└── README.md                  # Esta guía de uso
```
