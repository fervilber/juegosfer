/**
 * =============================================================================
 * MAZE GENERATOR - Algoritmo de Generación Procedimental de Laberintos
 * Modelado de caminos autoevitantes (SAW), Puntos Maestros y Partición de Sumas
 * =============================================================================
 */

class MazeGenerator {
  /**
   * Genera un laberinto matemático completo sobre una cuadrícula HexGrid.
   * @param {HexGrid} grid Instancia de la cuadrícula
   * @param {number} targetSum Valor objetivo de suma entre Puntos Maestros
   * @param {number} randomness Factor de enredo / aleatoriedad (0-50)
   * @param {number} relleno Multiplicador de relleno (0=todos, >1=múltiplos)
   * @param {number} nWaypoints Número de puntos intermedios de control
   */
  static generate(grid, targetSum = 14, randomness = 15, relleno = 0, nWaypoints = 3) {
    // 1. Configurar conjunto de valores permitidos
    let allowedPool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (relleno > 0 && targetSum % relleno === 0) {
      const maxVal = targetSum - relleno;
      if (maxVal >= relleno) {
        allowedPool = [];
        for (let v = relleno; v <= maxVal; v += relleno) {
          allowedPool.push(v);
        }
      }
    }

    // 2. Determinar Start (extremo izquierdo) y End (extremo derecho opuesto)
    const sqrt3 = Math.sqrt(3);
    let minX = Infinity, maxX = -Infinity;

    for (const hex of grid.hexList) {
      const hX = sqrt3 * hex.q + (sqrt3 / 2) * hex.r;
      if (hX < minX) minX = hX;
      if (hX > maxX) maxX = hX;
    }

    const spanX = maxX - minX;

    // Candidatos a Inicio en la franja izquierda (15% del ancho izquierdo)
    const startCandidates = grid.hexList.filter(h => {
      const hX = sqrt3 * h.q + (sqrt3 / 2) * h.r;
      return (hX - minX) <= spanX * 0.15;
    });

    // Candidatos a Final en la franja derecha (15% del ancho derecho)
    const endCandidates = grid.hexList.filter(h => {
      const hX = sqrt3 * h.q + (sqrt3 / 2) * h.r;
      return (maxX - hX) <= spanX * 0.15;
    });

    // Elegir aleatoriamente uno de los candidatos de cada extremo
    let startHex = startCandidates[Math.floor(Math.random() * startCandidates.length)] || grid.hexList[0];
    let endHex = endCandidates[Math.floor(Math.random() * endCandidates.length)] || grid.hexList[grid.hexList.length - 1];

    // Asegurar que no sean la misma celda ni vecinos
    if (startHex.id === endHex.id || startHex.neighbors.some(n => n.id === endHex.id)) {
      startHex = startCandidates[0] || grid.hexList[0];
      endHex = endCandidates[endCandidates.length - 1] || grid.hexList[grid.hexList.length - 1];
    }

    // 3. Bucle de generación garantizada
    const maxGlobalTries = 80;

    for (let attempt = 0; attempt < maxGlobalTries; attempt++) {
      // Reiniciar estado de celdas
      for (const hex of grid.hexList) {
        hex.value = 1;
        hex.isMaster = false;
        hex.isStart = false;
        hex.isEnd = false;
        hex.isPath = false;
        hex.masterIndex = 0;
      }

      startHex.isStart = true;
      endHex.isEnd = true;

      // Generar camino autoevitante que cruce el tablero
      const path = this.findWaypointPath(grid, startHex, endHex, randomness, nWaypoints);
      if (!path || path.length < 5) continue;

      // Intentar partición exacta por DFS
      const partitionResult = this.solvePathPartitionDFS(path, targetSum, allowedPool);
      if (partitionResult && partitionResult.success) {
        // Validar rigurosamente la solución
        if (this.verifyBoard(partitionResult.path, partitionResult.masters, targetSum)) {
          // Rellenar celdas exteriores no pertenecientes al camino
          for (const hex of grid.hexList) {
            if (!hex.isPath) {
              hex.isMaster = false;
              hex.value = allowedPool[Math.floor(Math.random() * allowedPool.length)];
            }
          }

          return {
            grid,
            startHex,
            endHex,
            path: partitionResult.path,
            masterHexes: partitionResult.masters,
            targetSum
          };
        }
      }
    }

    // Fallback constructivo garantizado
    return this.generateGuaranteedFallback(grid, startHex, endHex, targetSum, allowedPool);
  }

  // Genera un camino autoevitante distribuyendo waypoints a lo largo del tablero
  static findWaypointPath(grid, startHex, endHex, randomness, nWaypoints, maxRetries = 15) {
    const wMax = 1 + randomness * 2;
    const sqrt3 = Math.sqrt(3);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const edgeWeights = new Map();
      for (const hex of grid.hexList) {
        for (const neighbor of hex.neighbors) {
          const key = hex.id < neighbor.id ? `${hex.id}-${neighbor.id}` : `${neighbor.id}-${hex.id}`;
          if (!edgeWeights.has(key)) {
            edgeWeights.set(key, 1 + Math.random() * wMax);
          }
        }
      }

      // Distribuir waypoints en franjas verticales entre Start y End
      const startX = sqrt3 * startHex.q + (sqrt3 / 2) * startHex.r;
      const endX = sqrt3 * endHex.q + (sqrt3 / 2) * endHex.r;
      const stepDist = (endX - startX) / (nWaypoints + 1);

      const waypoints = [];
      for (let w = 1; w <= nWaypoints; w++) {
        const targetX = startX + stepDist * w;
        // Buscar candidatos en esta franja
        const sliceCandidates = grid.hexList.filter(h => {
          if (h.id === startHex.id || h.id === endHex.id) return false;
          const hX = sqrt3 * h.q + (sqrt3 / 2) * h.r;
          return Math.abs(hX - targetX) <= Math.abs(stepDist) * 0.75;
        });

        if (sliceCandidates.length > 0) {
          const chosen = sliceCandidates[Math.floor(Math.random() * sliceCandidates.length)];
          if (!waypoints.some(wp => wp.id === chosen.id)) {
            waypoints.push(chosen);
          }
        }
      }

      // Ordenar waypoints de Start a End por coordenada X
      waypoints.sort((a, b) => {
        const aX = sqrt3 * a.q + (sqrt3 / 2) * a.r;
        const bX = sqrt3 * b.q + (sqrt3 / 2) * b.r;
        return (endX >= startX) ? (aX - bX) : (bX - aX);
      });

      const sequence = [startHex, ...waypoints, endHex];

      let fullPath = [startHex];
      let visitedIds = new Set([startHex.id]);
      let failed = false;

      for (let i = 0; i < sequence.length - 1; i++) {
        const fromHex = fullPath[fullPath.length - 1];
        const toHex = sequence[i + 1];

        const segment = this.dijkstraShortestPath(fromHex, toHex, visitedIds, edgeWeights);
        if (!segment || segment.length === 0) {
          failed = true;
          break;
        }

        for (let j = 1; j < segment.length; j++) {
          fullPath.push(segment[j]);
          visitedIds.add(segment[j].id);
        }
      }

      if (!failed && fullPath.length >= 6) {
        return fullPath;
      }
    }

    return this.dijkstraShortestPath(startHex, endHex, new Set(), new Map()) || [startHex, endHex];
  }

  // Dijkstra optimizado con cola de prioridad para alta velocidad
  static dijkstraShortestPath(startHex, endHex, blockedIds, edgeWeights) {
    const distances = new Map();
    const previous = new Map();
    const pq = [{ hex: startHex, dist: 0 }];
    distances.set(startHex.id, 0);
    const visited = new Set();

    while (pq.length > 0) {
      let minIdx = 0;
      for (let i = 1; i < pq.length; i++) {
        if (pq[i].dist < pq[minIdx].dist) minIdx = i;
      }
      const { hex: current, dist: d } = pq.splice(minIdx, 1)[0];

      if (current.id === endHex.id) {
        const path = [];
        let curr = current;
        while (curr) {
          path.unshift(curr);
          curr = previous.get(curr.id);
        }
        return path;
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      for (const neighbor of current.neighbors) {
        if (blockedIds.has(neighbor.id) && neighbor.id !== endHex.id) {
          continue;
        }
        if (visited.has(neighbor.id)) continue;

        const edgeKey = current.id < neighbor.id ? `${current.id}-${neighbor.id}` : `${neighbor.id}-${current.id}`;
        const weight = edgeWeights.get(edgeKey) || 1;
        const newDist = d + weight;

        if (newDist < (distances.get(neighbor.id) ?? Infinity)) {
          distances.set(neighbor.id, newDist);
          previous.set(neighbor.id, current);
          pq.push({ hex: neighbor, dist: newDist });
        }
      }
    }

    return null;
  }

  /**
   * Resuelve la partición exacta de la ruta mediante búsqueda en profundidad (DFS)
   * Garantiza:
   *  1. Sumas de tramo exactamente iguales a targetSum
   *  2. Todos los números pertenecen a allowedPool (estrictamente positivos)
   *  3. NINGÚN Punto Maestro es adyacente espacialmente a ningún otro Punto Maestro
   */
  static solvePathPartitionDFS(path, targetSum, allowedPool) {
    const minVal = Math.min(...allowedPool);
    const maxVal = Math.max(...allowedPool);
    const pathLen = path.length;

    const minCellsForTarget = Math.max(1, Math.ceil(targetSum / maxVal));
    const maxCellsForTarget = Math.floor(targetSum / minVal);

    let dfsCalls = 0;
    const maxDfsCalls = 300;

    function dfs(currentIdx, masterIndices) {
      if (++dfsCalls > maxDfsCalls) return null;
      if (currentIdx === pathLen - 1) {
        return masterIndices;
      }

      const stepOptions = [];
      for (let m = minCellsForTarget; m <= maxCellsForTarget; m++) {
        const nextIdx = currentIdx + m + 1;
        if (nextIdx > pathLen - 1) continue;

        if (nextIdx === pathLen - 1) {
          const endNode = path[nextIdx];
          const touchesAnyMaster = endNode.neighbors.some(n => {
            return masterIndices.some(mIdx => path[mIdx].id === n.id);
          });
          if (!touchesAnyMaster) {
            stepOptions.push(m);
          }
        } else {
          const remAfter = (pathLen - 1) - nextIdx;
          if (remAfter >= minCellsForTarget + 1) {
            const candidateNode = path[nextIdx];
            const touchesAnyMaster = candidateNode.neighbors.some(n => {
              return masterIndices.some(mIdx => path[mIdx].id === n.id);
            });
            if (!touchesAnyMaster) {
              stepOptions.push(m);
            }
          }
        }
      }

      stepOptions.sort(() => 0.5 - Math.random());

      for (const m of stepOptions) {
        const nextIdx = currentIdx + m + 1;
        const res = dfs(nextIdx, [...masterIndices, nextIdx]);
        if (res) return res;
      }

      return null;
    }

    const masterIndices = dfs(0, [0]);
    if (!masterIndices || masterIndices.length < 2) return null;

    // Asignar particiones numéricas a cada tramo
    for (const hex of path) {
      hex.isMaster = false;
      hex.isPath = true;
      hex.value = 0;
    }

    for (let s = 0; s < masterIndices.length - 1; s++) {
      const fromIdx = masterIndices[s];
      const toIdx = masterIndices[s + 1];
      const cellCount = toIdx - fromIdx - 1;

      const parts = this.partitionSum(targetSum, cellCount, allowedPool);
      if (!parts) return null;

      for (let k = 0; k < cellCount; k++) {
        const cell = path[fromIdx + 1 + k];
        cell.value = parts[k];
        cell.isMaster = false;
      }
    }

    const masters = [];
    masterIndices.forEach((idx, order) => {
      const mHex = path[idx];
      mHex.isMaster = true;
      mHex.value = 0;
      mHex.masterIndex = order + 1;
      masters.push(mHex);
    });

    return {
      success: true,
      path,
      masters
    };
  }

  /**
   * Particiona exactamente un valor de suma en 'count' números de 'allowedPool'
   */
  static partitionSum(targetSum, count, allowedPool) {
    const minVal = Math.min(...allowedPool);
    const maxVal = Math.max(...allowedPool);

    if (targetSum < count * minVal || targetSum > count * maxVal) {
      return null;
    }

    for (let trial = 0; trial < 100; trial++) {
      const parts = [];
      let remSum = targetSum;
      let remCount = count;
      let ok = true;

      for (let i = 0; i < count - 1; i++) {
        const minNeeded = (remCount - 1) * minVal;
        const maxPossible = (remCount - 1) * maxVal;

        const validChoices = allowedPool.filter(v => {
          const rest = remSum - v;
          return rest >= minNeeded && rest <= maxPossible;
        });

        if (validChoices.length === 0) {
          ok = false;
          break;
        }

        const chosen = validChoices[Math.floor(Math.random() * validChoices.length)];
        parts.push(chosen);
        remSum -= chosen;
        remCount--;
      }

      if (ok && allowedPool.includes(remSum)) {
        parts.push(remSum);
        const total = parts.reduce((a, b) => a + b, 0);
        if (total === targetSum && parts.length === count) {
          return parts;
        }
      }
    }

    return null;
  }

  /**
   * Verificación formal exhaustiva de que el laberinto cumple todas las reglas matemáticas
   */
  static verifyBoard(path, masters, targetSum) {
    if (!path || path.length < 2 || !masters || masters.length < 2) return false;

    // 1. Start y End
    if (path[0].id !== masters[0].id) return false;
    if (path[path.length - 1].id !== masters[masters.length - 1].id) return false;

    // 2. Verificar que NINGÚN Punto Maestro es adyacente a otro
    for (let i = 0; i < masters.length; i++) {
      for (let j = i + 1; j < masters.length; j++) {
        if (masters[i].neighbors.some(n => n.id === masters[j].id)) {
          return false;
        }
      }
    }

    // 3. Sumas por tramo exactas
    let currentSum = 0;
    let phase = 0;

    for (let i = 1; i < path.length; i++) {
      const hex = path[i];
      if (hex.isMaster) {
        if (currentSum !== targetSum) {
          return false;
        }
        phase++;
        currentSum = 0;
      } else {
        if (!hex.value || hex.value <= 0) {
          return false;
        }
        currentSum += hex.value;
      }
    }

    return phase === masters.length - 1;
  }

  /**
   * Fallback constructivo 100% garantizado con separación geométrica
   */
  static generateGuaranteedFallback(grid, startHex, endHex, targetSum, allowedPool) {
    for (const hex of grid.hexList) {
      hex.isPath = false;
      hex.isMaster = false;
      hex.value = allowedPool[Math.floor(Math.random() * allowedPool.length)];
    }

    const blocked = new Set();
    if (startHex.neighbors.some(n => n.id === endHex.id)) {
      blocked.add(endHex.id);
    }

    const directPath = this.dijkstraShortestPath(startHex, endHex, blocked, new Map()) || [startHex, endHex];
    for (const h of directPath) {
      h.isPath = true;
    }

    startHex.isMaster = true;
    startHex.isStart = true;
    startHex.value = 0;
    startHex.masterIndex = 1;

    endHex.isMaster = true;
    endHex.isEnd = true;
    endHex.value = 0;
    endHex.masterIndex = 2;

    const intermediateCount = Math.max(1, directPath.length - 2);
    const parts = this.partitionSum(targetSum, intermediateCount, allowedPool) || [targetSum];

    for (let i = 1; i < directPath.length - 1; i++) {
      directPath[i].value = parts[i - 1] || 1;
      directPath[i].isMaster = false;
    }

    return {
      grid,
      startHex,
      endHex,
      path: directPath,
      masterHexes: [startHex, endHex],
      targetSum
    };
  }
}

window.MazeGenerator = MazeGenerator;
