/**
 * =============================================================================
 * PAIRS ENGINE - Motor Interactivo para el Juego de Sumas Emparejadas (Canvas 60 FPS)
 * Detección de clics contiguos, validación de pares, animaciones y sonido
 * =============================================================================
 */

class PairsEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Callbacks de interfaz
    this.onStateChange = options.onStateChange || (() => {});
    this.onVictory = options.onVictory || (() => {});
    this.onToast = options.onToast || (() => {});

    // Estado del juego
    this.gameData = null;
    this.difficulty = "Medio";
    this.selectedHex = null;     // Primer hexágono seleccionado
    this.foundPairs = [];        // Array de { hexA, hexB, key, color }
    this.hoverHex = null;
    this.isWon = false;
    this.hasViewedSolution = false; // Filtro de seguridad anti-trampas

    // Cronómetro y Puntuación
    this.startTime = null;
    this.elapsedSec = 0;
    this.timerInterval = null;
    this.currentScore = 0;

    // Paleta de colores para los pares encontrados
    this.pairColors = [
      { bg: "rgba(16, 185, 129, 0.25)", border: "#059669", line: "#10b981" },
      { bg: "rgba(14, 165, 233, 0.25)", border: "#0284c7", line: "#38bdf8" },
      { bg: "rgba(168, 85, 247, 0.25)", border: "#7c3aed", line: "#c084fc" },
      { bg: "rgba(245, 158, 11, 0.25)", border: "#d97706", line: "#fbbf24" },
      { bg: "rgba(236, 72, 153, 0.25)", border: "#db2777", line: "#f472b6" },
      { bg: "rgba(20, 184, 166, 0.25)", border: "#0d9488", line: "#2dd4bf" },
      { bg: "rgba(234, 88, 12, 0.25)", border: "#c2410c", line: "#fb923c" }
    ];

    this.initEvents();
  }

  startNewGame(gameData, difficulty = "Medio") {
    this.gameData = gameData;
    this.difficulty = difficulty;
    this.selectedHex = null;
    this.foundPairs = [];
    this.hoverHex = null;
    this.isWon = false;
    this.hasViewedSolution = false; // Reiniciar filtro de seguridad

    this.stopTimer();
    this.elapsedSec = 0;
    this.startTime = Date.now();
    this.currentScore = 0;
    this.timerInterval = setInterval(() => this.tickTimer(), 1000);

    this.resizeCanvas();
    this.notifyState();
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  tickTimer() {
    if (this.isWon) return;
    this.elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
    this.currentScore = this.calculateLiveScore();
    this.notifyState();
  }

  calculateLiveScore(isVictory = false) {
    if (!this.gameData) return 0;
    const basePares = this.foundPairs.length * 300;
    const bonusVictoria = isVictory ? 1000 : 0;
    const totalPares = Math.max(1, this.gameData.solutions.length);
    const completadoRatio = this.foundPairs.length / totalPares;

    const nCeldas = this.gameData.grid.hexList.length;
    const targetVal = this.gameData.targetSum;

    const mTam = 1 + (nCeldas / 80);
    const mObj = 1 + (targetVal / 25);

    const subtotal = (basePares + bonusVictoria) * mTam * mObj;
    const bonusTiempo = isVictory ? Math.max(0, (240 - this.elapsedSec) * 12) : 0;

    return Math.round(subtotal + bonusTiempo);
  }

  notifyState() {
    const mins = Math.floor(this.elapsedSec / 60);
    const secs = this.elapsedSec % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.onStateChange({
      foundCount: this.foundPairs.length,
      totalSolutions: this.gameData ? this.gameData.solutions.length : 0,
      targetSum: this.gameData ? this.gameData.targetSum : 14,
      selectedHex: this.selectedHex,
      foundPairs: this.foundPairs,
      isWon: this.isWon,
      timeFormatted,
      elapsedSec: this.elapsedSec,
      score: this.currentScore,
      difficulty: this.difficulty,
      totalCeldas: this.gameData ? this.gameData.grid.hexList.length : 0
    });

    this.render();
  }

  // ===========================================================================
  // GESTIÓN DE EVENTOS TÁCTILES Y RATÓN
  // ===========================================================================
  initEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerleave', () => {
      this.hoverHex = null;
      this.render();
    });

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = this.canvas.width / dpr;
    const logicalHeight = this.canvas.height / dpr;

    return {
      x: (e.clientX - rect.left) * (logicalWidth / rect.width),
      y: (e.clientY - rect.top) * (logicalHeight / rect.height)
    };
  }

  handlePointerMove(e) {
    if (!this.gameData || this.isWon) return;
    const { x, y } = this.getCanvasCoords(e);
    const hex = this.gameData.grid.getHexAtPoint(x, y);

    if (hex !== this.hoverHex) {
      this.hoverHex = hex;
      this.render();
    }
  }

  handlePointerDown(e) {
    if (!this.gameData || this.isWon) return;
    const { x, y } = this.getCanvasCoords(e);
    const hex = this.gameData.grid.getHexAtPoint(x, y);
    if (!hex) return;

    this.processCellClick(hex);
  }

  // Lógica de selección celda a celda
  processCellClick(hex) {
    // 1. Si no hay celda seleccionada, marcar como primera celda
    if (!this.selectedHex) {
      this.selectedHex = hex;
      window.soundFx.playStep();
      this.notifyState();
      return;
    }

    // 2. Si pulsa la misma celda de nuevo, desmarcar
    if (this.selectedHex.id === hex.id) {
      this.selectedHex = null;
      window.soundFx.playUndo();
      this.notifyState();
      return;
    }

    // 3. Comprobar adyacencia estricta con la primera celda
    const isAdjacent = this.selectedHex.neighbors.some(n => n.id === hex.id);
    if (!isAdjacent) {
      window.soundFx.playError();
      this.onToast("❌ Casillas no contiguas. Debes seleccionar un hexágono vecino adyacente.", "error");
      return;
    }

    // 4. Comprobar la suma
    const sum = this.selectedHex.value + hex.value;
    const target = this.gameData.targetSum;
    const minId = Math.min(this.selectedHex.id, hex.id);
    const maxId = Math.max(this.selectedHex.id, hex.id);
    const pairKey = `${minId}-${maxId}`;

    if (sum === target) {
      // Verificar si ya se había encontrado
      if (this.foundPairs.some(p => p.key === pairKey)) {
        window.soundFx.playUndo();
        this.onToast("ℹ️ Ya habías descubierto esta pareja antes.", "info");
        this.selectedHex = null;
        this.notifyState();
        return;
      }

      // ¡Nueva pareja descubierta!
      const color = this.pairColors[this.foundPairs.length % this.pairColors.length];
      this.foundPairs.push({
        hexA: this.selectedHex.id === minId ? this.selectedHex : hex,
        hexB: this.selectedHex.id === minId ? hex : this.selectedHex,
        key: pairKey,
        color
      });

      const firstVal = this.selectedHex.value;
      const secondVal = hex.value;
      this.selectedHex = null;

      if (this.foundPairs.length === this.gameData.solutions.length) {
        // ¡TODAS LAS PAREJAS ENCONTRADAS!
        this.isWon = true;
        this.stopTimer();
        this.currentScore = this.calculateLiveScore(true);
        this.notifyState();
        this.onVictory({
          score: this.currentScore,
          timeFormatted: this.formatTime(this.elapsedSec),
          elapsedSec: this.elapsedSec,
          difficulty: this.difficulty,
          targetSum: this.gameData.targetSum,
          foundPairs: this.foundPairs.length,
          totalSolutions: this.gameData.solutions.length,
          totalCeldas: this.gameData.grid.hexList.length
        });
      } else {
        window.soundFx.playMilestone();
        this.onToast(`⭐ ¡Correcto! ${firstVal} + ${secondVal} = ${target} (${this.foundPairs.length}/${this.gameData.solutions.length})`, "success");
        this.notifyState();
      }
    } else {
      // Suma incorrecta
      window.soundFx.playError();
      this.onToast(`⚠️ Suma incorrecta: ${this.selectedHex.value} + ${hex.value} = ${sum} (Buscado: ${target})`, "warning");
      this.selectedHex = null;
      this.notifyState();
    }
  }

  // Deshacer último par encontrado
  undoLastPair() {
    if (this.foundPairs.length === 0) return;
    this.foundPairs.pop();
    this.isWon = false;
    window.soundFx.playUndo();
    this.notifyState();
  }

  // Reiniciar todas las parejas encontradas
  resetAllPairs() {
    if (this.foundPairs.length === 0 && !this.selectedHex) return;
    this.foundPairs = [];
    this.selectedHex = null;
    this.isWon = false;
    window.soundFx.playUndo();
    this.onToast("Tablero reiniciado.", "info");
    this.notifyState();
  }

  formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ===========================================================================
  // RENDERIZADO EN CANVAS (HIGH DPI)
  // ===========================================================================
  resizeCanvas() {
    const container = this.canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth || 800;
    const height = Math.min(Math.max(width * 0.75, 480), 650);

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.gameData) {
      this.gameData.grid.fitToDimensions(width, height, 32);
    }

    this.render();
  }

  render() {
    if (!this.gameData) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    const grid = this.gameData.grid;

    // Crear mapa de celdas emparejadas para colorear
    const pairedCellMap = new Map();
    for (const pair of this.foundPairs) {
      pairedCellMap.set(pair.hexA.id, pair.color);
      pairedCellMap.set(pair.hexB.id, pair.color);
    }

    // 1. Dibujar todas las celdas hexagonales
    for (const hex of grid.hexList) {
      const corners = grid.getHexCorners(hex);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Colores de fondo y borde
      if (this.selectedHex && this.selectedHex.id === hex.id) {
        ctx.fillStyle = "#fef3c7"; // Ámbar selección
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 3.5;
      } else if (pairedCellMap.has(hex.id)) {
        const col = pairedCellMap.get(hex.id);
        ctx.fillStyle = col.bg;
        ctx.strokeStyle = col.border;
        ctx.lineWidth = 2.5;
      } else if (this.hoverHex && this.hoverHex.id === hex.id) {
        ctx.fillStyle = "#f1f5f9";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Dibujar número en el centro
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (this.selectedHex && this.selectedHex.id === hex.id) {
        ctx.fillStyle = "#92400e";
        ctx.font = "bold 18px Inter, sans-serif";
      } else if (pairedCellMap.has(hex.id)) {
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 17px Inter, sans-serif";
      } else {
        ctx.fillStyle = "#334155";
        ctx.font = "bold 16px Inter, sans-serif";
      }

      const valText = (hex.value !== null && hex.value !== undefined) ? hex.value.toString() : "0";
      ctx.fillText(valText, hex.x, hex.y);
    }

    // 2. Dibujar líneas conectoras para los pares encontrados
    for (const pair of this.foundPairs) {
      ctx.beginPath();
      ctx.strokeStyle = pair.color.line;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.moveTo(pair.hexA.x, pair.hexA.y);
      ctx.lineTo(pair.hexB.x, pair.hexB.y);
      ctx.stroke();
    }
  }

  // Renderizado en el canvas de Solución Oficial
  renderSolution(solutionCanvas) {
    if (!this.gameData || !solutionCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const container = solutionCanvas.parentElement;
    const width = container.clientWidth || 800;
    const height = Math.min(Math.max(width * 0.75, 480), 650);

    solutionCanvas.width = Math.round(width * dpr);
    solutionCanvas.height = Math.round(height * dpr);
    solutionCanvas.style.width = `${width}px`;
    solutionCanvas.style.height = `${height}px`;

    const ctx = solutionCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    PairsPDFExporter.drawBoardToCanvas(ctx, width, height, this.gameData, true);
  }
}

window.PairsEngine = PairsEngine;
