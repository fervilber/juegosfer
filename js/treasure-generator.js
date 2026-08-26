/**
 * =============================================================================
 * TREASURE GENERATOR - Generador de Terrenos con Cotas y Triangulación Deductiva
 * Soporta celdas de agua (0), ubicación de Barca en costa y unicidad matemática
 * =============================================================================
 */

class TreasureGenerator {
  /**
   * Genera una isla del tesoro con topografía y pistas de triangulación.
   * @param {HexGrid} grid Instancia de cuadrícula hexagonal
   * @param {number} numPOIs Número de balizas (3 o 4)
   * @param {number} maxVal Rango numérico máximo (6, 9, 12)
   * @param {boolean} showSteps Si true (Grumete), muestra los pasos; si false, solo la suma
   * @param {boolean} allowWater Si true (Nivel 2+), genera casillas de agua (0) y coloca la Barca en costa
   */
  static generate(grid, numPOIs = 3, maxVal = 9, showSteps = false, allowWater = true) {
    const poiCatalog = [
      { name: "Barca", icon: "⛵", color: "#0284c7", bg: "#f0f9ff", border: "#38bdf8", requiresWater: true },
      { name: "Palmera", icon: "🌴", color: "#059669", bg: "#ecfdf5", border: "#10b981", requiresWater: false },
      { name: "Loro", icon: "🦜", color: "#d97706", bg: "#fffbeb", border: "#f59e0b", requiresWater: false },
      { name: "Barril", icon: "🪵", color: "#7c3aed", bg: "#f5f3ff", border: "#a855f7", requiresWater: false },
      { name: "Calavera", icon: "💀", color: "#dc2626", bg: "#fef2f2", border: "#ef4444", requiresWater: false }
    ];

    let attempts = 0;
    const maxAttempts = 300;

    while (attempts++ < maxAttempts) {
      // 1. Asignar cotas de terreno a las celdas
      for (const hex of grid.hexList) {
        hex.value = Math.floor(Math.random() * maxVal) + 1; // 1..maxVal (tierra)
        hex.isPOI = false;
        hex.poiData = null;
        hex.isTreasure = false;
      }

      // 2. Si allowWater está activo (Nivel 2+), asignar agua (0) en algunas casillas de la periferia/costa
      if (allowWater) {
        const hexList = grid.hexList;
        // Calcular centro
        let cx = 0, cy = 0;
        for (const h of hexList) { cx += h.x; cy += h.y; }
        cx /= hexList.length; cy /= hexList.length;

        // Identificar casillas de borde exterior
        const outerHexes = hexList.filter(h => {
          return h.neighbors.length < 6 || Math.hypot(h.x - cx, h.y - cy) > grid.size * (grid.cols * 0.35);
        });

        // Convertir el 35% de las casillas exteriores en agua (0)
        for (const h of outerHexes) {
          if (Math.random() < 0.38) {
            h.value = 0; // Agua
          }
        }
      }

      // 3. Colocar las balizas asegurando que la Barca esté cerca de agua (ceros)
      const pois = this.placePOIs(grid, Math.min(numPOIs, poiCatalog.length), poiCatalog, allowWater);
      if (pois.length < 3) continue;

      // 4. Precomputar mapas de distancias BFS
      const poiMaps = pois.map(p => this.computePOIMap(p.hex));

      // 5. Seleccionar candidata para el Tesoro (debe ser tierra con valor >= 1)
      const validCandidates = grid.hexList.filter(hex => {
        if (hex.isPOI || hex.value === 0) return false;
        return poiMaps.every(pMap => {
          const info = pMap.get(hex.id);
          return info && info.steps >= 2 && info.steps <= 8;
        });
      });

      if (validCandidates.length === 0) continue;

      const shuffledCandidates = [...validCandidates].sort(() => 0.5 - Math.random());

      for (const candidate of shuffledCandidates) {
        const clues = pois.map((p, idx) => {
          const pathData = poiMaps[idx].get(candidate.id);
          return {
            poi: p,
            steps: pathData.steps,
            sum: pathData.sum,
            path: pathData.path,
            showSteps
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
            showSteps,
            allowWater,
            totalHexes: grid.hexList.length
          };
        }
      }
    }

    // Fallback garantizado
    const pois = this.placePOIs(grid, 3, poiCatalog, false);
    const poiMaps = pois.map(p => this.computePOIMap(p.hex));
    const nonPOIs = grid.hexList.filter(h => !h.isPOI && h.value > 0);
    const treasureHex = nonPOIs[Math.floor(nonPOIs.length / 2)] || grid.hexList[0];
    treasureHex.isTreasure = true;
    treasureHex.value = Math.max(1, treasureHex.value);

    const clues = pois.map((p, idx) => {
      const pathData = poiMaps[idx].get(treasureHex.id);
      return {
        poi: p,
        steps: pathData ? pathData.steps : 2,
        sum: pathData ? pathData.sum : treasureHex.value * 2,
        path: pathData ? pathData.path : [treasureHex],
        showSteps
      };
    });

    return {
      grid,
      pois,
      treasureHex,
      clues,
      showSteps,
      allowWater,
      totalHexes: grid.hexList.length
    };
  }

  // Coloca las balizas en la periferia, asegurando que la Barca esté junto a casillas de agua si existen
  static placePOIs(grid, count, catalog, allowWater = false) {
    const pois = [];
    const hexList = grid.hexList;
    if (hexList.length < count * 3) return [];

    let cx = 0, cy = 0;
    for (const h of hexList) { cx += h.x; cy += h.y; }
    cx /= hexList.length; cy /= hexList.length;

    const usedHexIds = new Set();

    // 1. Colocar primero la Barca si requiere agua
    const barcaItem = catalog.find(c => c.requiresWater);
    if (barcaItem) {
      let candidateHexes = [];
      if (allowWater) {
        // Buscar casillas de tierra que toquen al menos un hexágono de agua (0)
        candidateHexes = hexList.filter(h => {
          return !usedHexIds.has(h.id) && h.neighbors.some(n => n.value === 0);
        });
      }
      if (candidateHexes.length === 0) {
        // Si no hay agua directa, elegir una casilla de la orilla exterior
        candidateHexes = hexList.filter(h => !usedHexIds.has(h.id));
        candidateHexes.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
      }

      if (candidateHexes.length > 0) {
        const barcaHex = candidateHexes[0];
        barcaHex.isPOI = true;
        usedHexIds.add(barcaHex.id);
        const data = { ...barcaItem, hex: barcaHex, id: barcaHex.id };
        barcaHex.poiData = data;
        pois.push(data);
      }
    }

    // 2. Colocar el resto de POIs en sectores angulares opuestos
    const remainingCatalog = catalog.filter(c => !c.requiresWater);
    const sectors = Array.from({ length: count }, () => []);
    const sectorAngle = (2 * Math.PI) / count;

    for (const h of hexList) {
      if (usedHexIds.has(h.id)) continue;
      let angle = Math.atan2(h.y - cy, h.x - cx);
      if (angle < 0) angle += 2 * Math.PI;
      const secIdx = Math.floor(angle / sectorAngle) % count;
      const dist = Math.hypot(h.x - cx, h.y - cy);
      sectors[secIdx].push({ hex: h, dist });
    }

    const needed = count - pois.length;
    for (let i = 0; i < needed; i++) {
      const sector = sectors[(i + 1) % count];
      if (!sector || sector.length === 0) continue;
      sector.sort((a, b) => b.dist - a.dist);
      const chosenHex = sector.find(s => !usedHexIds.has(s.hex.id))?.hex;
      if (!chosenHex) continue;

      chosenHex.isPOI = true;
      usedHexIds.add(chosenHex.id);
      const item = remainingCatalog[i % remainingCatalog.length];
      const data = {
        ...item,
        hex: chosenHex,
        id: chosenHex.id
      };
      chosenHex.poiData = data;
      pois.push(data);
    }

    return pois;
  }

  // BFS O(V + E)
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

  static findShortestPath(startHex, endHex) {
    const pMap = this.computePOIMap(startHex);
    return pMap.get(endHex.id) || { steps: 0, sum: 0, path: [] };
  }

  static findMatchingHexes(grid, poiMaps, clues) {
    const matches = [];

    for (const hex of grid.hexList) {
      if (hex.isPOI || hex.value === 0) continue;

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
