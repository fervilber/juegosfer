/**
 * =============================================================================
 * HEXAGON GRID - Módulo de Geometría y Matemáticas Hexagonales
 * Coordenadas axiales (q, r) y cúbicas (x, y, z) con hexágonos "Pointy-Topped"
 * Soporte para formas: 0=Rectángulo, 1=Círculo, 2=Donut, 3=Rombo, 4=Corazón, 5=Casa
 * =============================================================================
 */

class HexGrid {
  /**
   * @param {number} cols Número de columnas
   * @param {number} rows Número de filas
   * @param {number} shape Forma del tablero: 0=Rectángulo, 1=Círculo, 2=Donut, 3=Rombo, 4=Corazón, 5=Casa
   */
  constructor(cols = 13, rows = 13, shape = 0) {
    this.cols = cols;
    this.rows = rows;
    this.shape = shape;
    this.hexes = new Map(); // Key: "q,r" -> HexCell
    this.hexList = [];      // Array ordenado de celdas con id 1..N
    this.size = 28;         // Radio en píxeles (se recalcula al ajustar el canvas)
    this.offsetX = 0;
    this.offsetY = 0;
    
    this.generateGrid();
  }

  // Clave axial estándar
  static key(q, r) {
    return `${q},${r}`;
  }

  // Genera la cuadrícula hexagonal según la forma elegida
  generateGrid() {
    this.hexes.clear();
    this.hexList = [];
    let id = 1;

    const sqrt3 = Math.sqrt(3);

    if (this.shape === 0) {
      // 0: RECTÁNGULO (offset coord par-fila)
      for (let r = 0; r < this.rows; r++) {
        const r_offset = Math.floor(r / 2);
        for (let q = -r_offset; q < this.cols - r_offset; q++) {
          const hex = new HexCell(id++, q, r);
          this.hexes.set(HexGrid.key(q, r), hex);
          this.hexList.push(hex);
        }
      }
    } else if (this.shape === 1) {
      // 1: CÍRCULO
      const radius = Math.floor(Math.min(this.cols, this.rows) / 2);
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
          const hex = new HexCell(id++, q, r);
          this.hexes.set(HexGrid.key(q, r), hex);
          this.hexList.push(hex);
        }
      }
    } else if (this.shape === 2) {
      // 2: DONUT (círculo con hueco central)
      const radius = Math.floor(Math.min(this.cols, this.rows) / 2);
      const innerRadius = Math.max(1, Math.floor(radius * 0.4));
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
          const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
          if (distFromCenter >= innerRadius) {
            const hex = new HexCell(id++, q, r);
            this.hexes.set(HexGrid.key(q, r), hex);
            this.hexList.push(hex);
          }
        }
      }
    } else if (this.shape === 3) {
      // 3: ROMBO
      const halfC = Math.floor(this.cols / 2);
      const halfR = Math.floor(this.rows / 2);
      for (let q = 0; q < this.cols; q++) {
        for (let r = 0; r < this.rows; r++) {
          if (q + r >= halfC && q + r <= this.cols + halfR) {
            const hex = new HexCell(id++, q - halfC, r - halfR);
            this.hexes.set(HexGrid.key(hex.q, hex.r), hex);
            this.hexList.push(hex);
          }
        }
      }
    } else if (this.shape === 4) {
      // 4: CORAZÓN (Polígono paramétrico de corazón)
      const halfC = this.cols / 2;
      const halfR = this.rows / 2;
      for (let r = 0; r < this.rows; r++) {
        const r_offset = Math.floor(r / 2);
        for (let q = -r_offset; q < this.cols - r_offset; q++) {
          // Normalizar coordenadas relativas al centro [-1, 1]
          const nx = (q + r_offset - halfC + 0.5) / (halfC * 0.95);
          const ny = -(r - halfR * 0.85) / (halfR * 0.95);

          // Ecuación implícita de corazón: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
          const a = nx * nx + ny * ny - 1;
          if (a * a * a - nx * nx * ny * ny * ny <= 0.05) {
            const hex = new HexCell(id++, q, r);
            this.hexes.set(HexGrid.key(q, r), hex);
            this.hexList.push(hex);
          }
        }
      }
    } else if (this.shape === 5) {
      // 5: CASA (Cuerpo rectangular + tejado triangular + chimenea)
      const halfC = this.cols / 2;
      for (let r = 0; r < this.rows; r++) {
        const r_offset = Math.floor(r / 2);
        for (let q = -r_offset; q < this.cols - r_offset; q++) {
          const colIdx = q + r_offset;
          const rowIdx = r;
          
          let inside = false;

          // Cuerpo de la casa: 70% inferior
          if (rowIdx >= this.rows * 0.35) {
            inside = true;
          } else {
            // Tejado triangular
            const distFromMidX = Math.abs(colIdx - halfC + 0.5);
            const maxAllowedDist = halfC * (rowIdx / (this.rows * 0.35));
            if (distFromMidX <= maxAllowedDist + 0.5) {
              inside = true;
            }
            // Chimenea en el lado derecho
            if (colIdx >= this.cols * 0.65 && colIdx <= this.cols * 0.85 && rowIdx <= this.rows * 0.4) {
              inside = true;
            }
          }

          if (inside) {
            const hex = new HexCell(id++, q, r);
            this.hexes.set(HexGrid.key(q, r), hex);
            this.hexList.push(hex);
          }
        }
      }
    } else {
      // Por defecto: Rectángulo
      for (let r = 0; r < this.rows; r++) {
        const r_offset = Math.floor(r / 2);
        for (let q = -r_offset; q < this.cols - r_offset; q++) {
          const hex = new HexCell(id++, q, r);
          this.hexes.set(HexGrid.key(q, r), hex);
          this.hexList.push(hex);
        }
      }
    }

    // Si por alguna forma quedaran menos de 4 hexágonos, fallback a rectángulo
    if (this.hexList.length < 4) {
      this.shape = 0;
      this.generateGrid();
      return;
    }

    // Calcular posiciones relativas iniciales (x, y)
    for (const hex of this.hexList) {
      const pos = this.hexToPixel(hex.q, hex.r, this.size, 0, 0);
      hex.x = pos.x;
      hex.y = pos.y;
    }

    // Calcular vecinos para cada hexágono
    this.computeNeighbors();
  }

  // Calcula la lista de vecinos adyacentes para cada celda
  computeNeighbors() {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];

    for (const hex of this.hexList) {
      hex.neighbors = [];
      for (const dir of directions) {
        const nKey = HexGrid.key(hex.q + dir.q, hex.r + dir.r);
        if (this.hexes.has(nKey)) {
          hex.neighbors.push(this.hexes.get(nKey));
        }
      }
    }
  }

  // Ajusta la escala y traslación para que el tablero encaje perfectamente en el Canvas
  fitToDimensions(canvasWidth, canvasHeight, padding = 40) {
    if (this.hexList.length === 0) return;

    const sqrt3 = Math.sqrt(3);

    // Calcular límites en coordenadas relativas (sin escalar)
    let minU_X = Infinity, maxU_X = -Infinity;
    let minU_Y = Infinity, maxU_Y = -Infinity;

    for (const hex of this.hexList) {
      const uX = sqrt3 * hex.q + (sqrt3 / 2) * hex.r;
      const uY = 1.5 * hex.r;
      minU_X = Math.min(minU_X, uX - sqrt3 / 2);
      maxU_X = Math.max(maxU_X, uX + sqrt3 / 2);
      minU_Y = Math.min(minU_Y, uY - 1);
      maxU_Y = Math.max(maxU_Y, uY + 1);
    }

    const gridW = maxU_X - minU_X;
    const gridH = maxU_Y - minU_Y;

    const availW = canvasWidth - padding * 2;
    const availH = canvasHeight - padding * 2;

    const sizeX = availW / gridW;
    const sizeY = availH / gridH;
    this.size = Math.min(sizeX, sizeY, 45); // Máximo 45px para buena legibilidad

    // Calcular centros reales y offset de centrado
    let realMinX = Infinity, realMaxX = -Infinity;
    let realMinY = Infinity, realMaxY = -Infinity;

    for (const hex of this.hexList) {
      const pos = this.hexToPixel(hex.q, hex.r, this.size, 0, 0);
      realMinX = Math.min(realMinX, pos.x - (sqrt3 / 2) * this.size);
      realMaxX = Math.max(realMaxX, pos.x + (sqrt3 / 2) * this.size);
      realMinY = Math.min(realMinY, pos.y - this.size);
      realMaxY = Math.max(realMaxY, pos.y + this.size);
    }

    this.offsetX = (canvasWidth - (realMaxX + realMinX)) / 2;
    this.offsetY = (canvasHeight - (realMaxY + realMinY)) / 2;

    for (const hex of this.hexList) {
      const pos = this.hexToPixel(hex.q, hex.r, this.size, this.offsetX, this.offsetY);
      hex.x = pos.x;
      hex.y = pos.y;
    }
  }

  // Convierte coordenadas axiales a píxeles (punta hacia arriba)
  hexToPixel(q, r, size, offX = 0, offY = 0) {
    const sqrt3 = Math.sqrt(3);
    const x = size * (sqrt3 * q + (sqrt3 / 2) * r) + offX;
    const y = size * (1.5 * r) + offY;
    return { x, y };
  }

  // Convierte coordenadas de píxeles a la celda hexagonal más cercana (O(1) exacto)
  pixelToHex(px, py) {
    const x = px - this.offsetX;
    const y = py - this.offsetY;
    const size = this.size;
    const sqrt3 = Math.sqrt(3);

    const q = ((sqrt3 / 3) * x - (1 / 3) * y) / size;
    const r = ((2 / 3) * y) / size;

    return this.cubeRound(q, r);
  }

  // Redondeo de coordenadas axiales flotantes a la celda entera más cercana
  cubeRound(fracQ, fracR) {
    const fracS = -fracQ - fracR;
    let q = Math.round(fracQ);
    let r = Math.round(fracR);
    let s = Math.round(fracS);

    const qDiff = Math.abs(q - fracQ);
    const rDiff = Math.abs(r - fracR);
    const sDiff = Math.abs(s - fracS);

    if (qDiff > rDiff && qDiff > sDiff) {
      q = -r - s;
    } else if (rDiff > sDiff) {
      r = -q - s;
    }

    const key = HexGrid.key(q, r);
    return this.hexes.get(key) || null;
  }

  // Obtiene con máxima precisión la celda bajo un punto (px, py)
  getHexAtPoint(px, py) {
    if (!this.hexList || this.hexList.length === 0) return null;

    // 1. Conversión axial directa
    const candidate = this.pixelToHex(px, py);
    if (candidate) {
      const dist = Math.hypot(candidate.x - px, candidate.y - py);
      if (dist <= this.size * 1.05) {
        return candidate;
      }
    }

    // 2. Comprobación geométrica de proximidad para bordes
    let closest = null;
    let minDist = Infinity;
    for (const hex of this.hexList) {
      const d = Math.hypot(hex.x - px, hex.y - py);
      if (d < minDist) {
        minDist = d;
        closest = hex;
      }
    }

    if (closest && minDist <= this.size * 1.02) {
      return closest;
    }

    return null;
  }

  // Obtiene los vértices poligonales de un hexágono
  getHexCorners(hex) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      corners.push({
        x: hex.x + this.size * Math.cos(angle),
        y: hex.y + this.size * Math.sin(angle)
      });
    }
    return corners;
  }
}

/**
 * Representa una celda hexagonal individual
 */
class HexCell {
  constructor(id, q, r) {
    this.id = id;
    this.q = q;
    this.r = r;
    this.x = 0;
    this.y = 0;
    this.value = 0;         // Valor numérico
    this.isMaster = false;  // Punto Maestro
    this.isStart = false;   // Inicio
    this.isEnd = false;     // Final
    this.isPath = false;    // Camino solución
    this.masterIndex = 0;   // Orden 1..N si es maestro
    this.neighbors = [];
  }
}

window.HexGrid = HexGrid;
window.HexCell = HexCell;
