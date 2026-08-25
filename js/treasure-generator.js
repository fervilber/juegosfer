/**
 * =============================================================================
 * TREASURE GENERATOR - Generador y Validador de Triangulación para HexaTreasure
 * Garantiza solución matemática y deductiva única mediante BFS O(V + E)
 * =============================================================================
 */

class TreasureGenerator {
  /**
   * Genera una isla del tesoro con pistas de triangulación desde puntos de referencia.
   * @param {HexGrid} grid Instancia de cuadrícula hexagonal
   * @param {number} numPOIs Número de balizas (3 o 4)
   * @param {number} maxVal Rango numérico máximo (6, 9, 12)
   */
  static generate(grid, numPOIs = 3, maxVal = 9) {
    const poiCatalog = [
      { name: "Palmera", icon: "🌴", color: "#059669", bg: "#ecfdf5", border: "#10b981" },
      { name: "Barca", icon: "⛵", color: "#0284c7", bg: "#f0f9ff", border: "#38bdf8" },
      { name: "Loro", icon: "🦜", color: "#d97706", bg: "#fffbeb", border: "#f59e0b" },
      { name: "Barril", icon: "🪵", color: "#7c3aed", bg: "#f5f3ff", border: "#a855f7" },
      { name: "Calavera", icon: "💀", color: "#dc2626", bg: "#fef2f2", border: "#ef4444" }
    ];

    let attempts = 0;
    const maxAttempts = 300;

    while (attempts++ < maxAttempts) {
      // 1. Asignar números aleatorios a todas las celdas
      for (const hex of grid.hexList) {
        hex.value = Math.floor(Math.random() * maxVal) + 1; // 1..maxVal
        hex.isPOI = false;
        hex.poiData = null;
        hex.isTreasure = false;
      }

      // 2. Colocar las balizas (POIs) en posiciones separadas de la periferia
      const pois = this.placePOIs(grid, Math.min(numPOIs, poiCatalog.length), poiCatalog);
      if (pois.length < 3) continue;

      // 3. Precomputar mapas de distancias BFS desde cada POI hacia todas las celdas
      const poiMaps = pois.map(p => this.computePOIMap(p.hex));

      // 4. Seleccionar una celda candidata para el Tesoro
      const validCandidates = grid.hexList.filter(hex => {
        if (hex.isPOI) return false;
        return poiMaps.every(pMap => {
          const info = pMap.get(hex.id);
          return info && info.steps >= 2 && info.steps <= 8;
        });
      });

      if (validCandidates.length === 0) continue;

      // Probar candidatos hasta encontrar uno con solución única
      const shuffledCandidates = [...validCandidates].sort(() => 0.5 - Math.random());

      for (const candidate of shuffledCandidates) {
        const clues = pois.map((p, idx) => {
          const pathData = poiMaps[idx].get(candidate.id);
          return {
            poi: p,
            steps: pathData.steps,
            sum: pathData.sum,
            path: pathData.path
          };
        });

        const matchingHexes = this.findMatchingHexes(grid, poiMaps, clues);

        if (matchingHexes.length === 1 && matchingHexes[0].id === candidate.id) {
          candidate.isTreasure = true;
          return {
            grid,
            pois,
            treasureHex: candidate,
            clues,
            totalHexes: grid.hexList.length
          };
        }
      }
    }

    // Fallback con perturbación de celdas
    const pois = this.placePOIs(grid, 3, poiCatalog);
    const poiMaps = pois.map(p => this.computePOIMap(p.hex));
    const nonPOIs = grid.hexList.filter(h => !h.isPOI);
    const treasureHex = nonPOIs[Math.floor(nonPOIs.length / 2)];
    treasureHex.isTreasure = true;

    const clues = pois.map((p, idx) => {
      const pathData = poiMaps[idx].get(treasureHex.id);
      return {
        poi: p,
        steps: pathData ? pathData.steps : 2,
        sum: pathData ? pathData.sum : treasureHex.value * 2,
        path: pathData ? pathData.path : [treasureHex]
      };
    });

    return {
      grid,
      pois,
      treasureHex,
      clues,
      totalHexes: grid.hexList.length
    };
  }

  // Coloca las balizas en cuadrantes separados
  static placePOIs(grid, count, catalog) {
    const pois = [];
    const hexList = grid.hexList;
    if (hexList.length < count * 3) return [];

    let cx = 0, cy = 0;
    for (const h of hexList) {
      cx += h.x;
      cy += h.y;
    }
    cx /= hexList.length;
    cy /= hexList.length;

    const sectors = Array.from({ length: count }, () => []);
    const sectorAngle = (2 * Math.PI) / count;

    for (const h of hexList) {
      let angle = Math.atan2(h.y - cy, h.x - cx);
      if (angle < 0) angle += 2 * Math.PI;
      const secIdx = Math.floor(angle / sectorAngle) % count;
      const dist = Math.hypot(h.x - cx, h.y - cy);
      sectors[secIdx].push({ hex: h, dist });
    }

    for (let i = 0; i < count; i++) {
      const sector = sectors[i];
      if (sector.length === 0) continue;
      sector.sort((a, b) => b.dist - a.dist);
      const chosenHex = sector[0].hex;

      chosenHex.isPOI = true;
      const data = {
        ...catalog[i % catalog.length],
        hex: chosenHex,
        id: chosenHex.id
      };
      chosenHex.poiData = data;
      pois.push(data);
    }

    return pois;
  }

  // Calcula para un POI las distancias mínimas y sumas hacia TODOS los hexágonos en O(V + E)
  static computePOIMap(poiHex) {
    const distMap = new Map();
    distMap.set(poiHex.id, { steps: 0, sum: 0, path: [] });

    const queue = [poiHex];
    const visitedLevels = new Map();
    visitedLevels.set(poiHex.id, 0);

    const bestSumMap = new Map();
    bestSumMap.set(poiHex.id, 0);

    while (queue.length > 0) {
      const curr = queue.shift();
      const currLevel = visitedLevels.get(curr.id);
      const currData = distMap.get(curr.id);

      for (const neighbor of curr.neighbors) {
        const nextLevel = currLevel + 1;
        const nextSum = currData.sum + neighbor.value;

        if (!visitedLevels.has(neighbor.id)) {
          visitedLevels.set(neighbor.id, nextLevel);
          bestSumMap.set(neighbor.id, nextSum);
          distMap.set(neighbor.id, {
            steps: nextLevel,
            sum: nextSum,
            path: [...currData.path, neighbor]
          });
          queue.push(neighbor);
        } else if (visitedLevels.get(neighbor.id) === nextLevel) {
          if (nextSum < bestSumMap.get(neighbor.id)) {
            bestSumMap.set(neighbor.id, nextSum);
            distMap.set(neighbor.id, {
              steps: nextLevel,
              sum: nextSum,
              path: [...currData.path, neighbor]
            });
          }
        }
      }
    }

    return distMap;
  }

  // Encuentra el camino más corto entre dos celdas
  static findShortestPath(startHex, endHex) {
    const pMap = this.computePOIMap(startHex);
    return pMap.get(endHex.id) || { steps: 0, sum: 0, path: [] };
  }

  // Encuentra todas las celdas de la cuadrícula que coinciden con todas las pistas
  static findMatchingHexes(grid, poiMaps, clues) {
    const matches = [];

    for (const hex of grid.hexList) {
      if (hex.isPOI) continue;

      let allMatch = true;
      for (let i = 0; i < clues.length; i++) {
        const clue = clues[i];
        const res = poiMaps[i].get(hex.id);

        if (!res || res.steps !== clue.steps || res.sum !== clue.sum) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        matches.push(hex);
      }
    }

    return matches;
  }
}

window.TreasureGenerator = TreasureGenerator;
