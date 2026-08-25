/**
 * =============================================================================
 * PAIRS GENERATOR - Generador y Buscador de Soluciones para Sumas Emparejadas
 * =============================================================================
 */

class PairsGenerator {
  /**
   * Genera un tablero de sumas emparejadas y encuentra todas las soluciones contiguas.
   * @param {HexGrid} grid Instancia de cuadrícula hexagonal
   * @param {number} targetSum Valor objetivo buscado
   * @param {number} relleno Configuración de múltiplos (0=todos, >0=múltiplos)
   */
  static generate(grid, targetSum = 14, relleno = 0) {
    let allowedPool = [];

    if (relleno === 0) {
      // Vector de relleno estándar (incluyendo 0 y 1..(targetSum-1))
      allowedPool = [0];
      for (let i = 1; i < targetSum; i++) {
        allowedPool.push(i);
        allowedPool.push(i); // Doble peso para mayor variedad
      }
    } else {
      const residuo = targetSum % relleno;
      if (residuo !== 0) {
        // Fallback si no es divisor
        allowedPool = [];
        for (let i = 0; i < targetSum; i++) allowedPool.push(i);
      } else {
        // Secuencia de múltiplos
        allowedPool = [];
        for (let v = relleno; v <= targetSum - relleno; v += relleno) {
          allowedPool.push(v);
        }
        if (allowedPool.length === 0) {
          allowedPool = [relleno];
        }
      }
    }

    if (allowedPool.length === 0) {
      allowedPool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }

    // 1. Asignar valores aleatorios a cada celda
    for (const hex of grid.hexList) {
      hex.value = allowedPool[Math.floor(Math.random() * allowedPool.length)];
      hex.isStart = false;
      hex.isEnd = false;
      hex.isMaster = false;
      hex.isPath = false;
    }

    // 2. Buscar soluciones existentes
    let solutions = this.findSolutions(grid, targetSum);

    // 3. Garantizar que existan al menos entre 3 y 6 soluciones inyectando pares si fuera necesario
    const minDesiredSolutions = Math.max(2, Math.min(8, Math.floor(grid.hexList.length / 8)));
    
    if (solutions.length < minDesiredSolutions) {
      const needed = minDesiredSolutions - solutions.length;
      const shuffledHexes = [...grid.hexList].sort(() => 0.5 - Math.random());

      let injected = 0;
      for (const hexA of shuffledHexes) {
        if (injected >= needed) break;
        if (hexA.neighbors.length === 0) continue;

        const validNeighbors = hexA.neighbors.filter(n => {
          // Evitar sobreescribir pares ya existentes
          return !solutions.some(s => (s.hexA.id === n.id || s.hexB.id === n.id));
        });

        if (validNeighbors.length > 0) {
          const hexB = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
          const valA = allowedPool[Math.floor(Math.random() * allowedPool.length)];
          const valB = targetSum - valA;

          if (allowedPool.includes(valB)) {
            hexA.value = valA;
            hexB.value = valB;
            injected++;
          }
        }
      }

      // Recalcular soluciones tras la inyección
      solutions = this.findSolutions(grid, targetSum);
    }

    return {
      grid,
      targetSum,
      solutions,
      totalSolutions: solutions.length
    };
  }

  /**
   * Encuentra todas las parejas de hexágonos adyacentes cuya suma es igual a targetSum.
   * @param {HexGrid} grid
   * @param {number} targetSum
   * @returns {Array<{ hexA: HexCell, hexB: HexCell, key: string }>}
   */
  static findSolutions(grid, targetSum) {
    const pairMap = new Map();

    for (const hexA of grid.hexList) {
      for (const hexB of hexA.neighbors) {
        if (hexA.value + hexB.value === targetSum) {
          const minId = Math.min(hexA.id, hexB.id);
          const maxId = Math.max(hexA.id, hexB.id);
          const pairKey = `${minId}-${maxId}`;

          if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              hexA: hexA.id === minId ? hexA : hexB,
              hexB: hexA.id === minId ? hexB : hexA,
              key: pairKey
            });
          }
        }
      }
    }

    return Array.from(pairMap.values());
  }
}

window.PairsGenerator = PairsGenerator;
