/**
 * =============================================================================
 * TREASURE ENGINE - Motor Interactivo para HexaTreasure (Canvas 60 FPS)
 * Gestión de excavación, marcas de descarte (🚩/❌), pistas y animaciones
 * =============================================================================
 */

class TreasureEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onVictory = options.onVictory || (() => {});
    this.onToast = options.onToast || (() => {});

    // Estado del juego
    this.gameData = null;
    this.difficulty = "Marinero (Medio)";
    this.activeTool = "dig"; // 'dig', 'flag', 'discard'
    this.selectedHex = null;
    this.hoverHex = null;
    this.highlightedPOI = null;
    this.isWon = false;
    this.hasViewedSolution = false;

    // Métricas y puntuación
    this.attemptsCount = 0;
    this.marks = new Map(); // id -> 'flag' | 'discard' | 'dug'
    this.startTime = null;
    this.elapsedSec = 0;
    this.timerInterval = null;
    this.currentScore = 0;

    this.initEvents();
  }

  startNewGame(gameData, difficulty = "Marinero (Medio)") {
    this.gameData = gameData;
    this.difficulty = difficulty;
    this.selectedHex = null;
    this.hoverHex = null;
    this.highlightedPOI = null;
    this.isWon = false;
    this.hasViewedSolution = false;
    this.attemptsCount = 0;
    this.marks.clear();

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

  setTool(tool) {
    this.activeTool = tool;
    this.notifyState();
  }

  setHighlightedPOI(poi) {
    this.highlightedPOI = poi;
    this.render();
  }

  calculateLiveScore(isVictory = false) {
    if (!this.gameData) return 0;
    const baseVictoria = isVictory ? 5000 : 0;
    const penalizacionIntentos = Math.max(0, this.attemptsCount * 400);

    const nCeldas = this.gameData.grid.hexList.length;
    const nBalizas = this.gameData.pois.length;

    const multiplicadorTam = 1 + (nCeldas / 70);
    const multiplicadorBalizas = 1 + (nBalizas * 0.15);

    const subtotal = Math.max(500, (baseVictoria - penalizacionIntentos) * multiplicadorTam * multiplicadorBalizas);
    const bonusTiempo = isVictory ? Math.max(0, (180 - this.elapsedSec) * 15) : 0;

    return Math.round(subtotal + bonusTiempo);
  }

  notifyState() {
    const mins = Math.floor(this.elapsedSec / 60);
    const secs = this.elapsedSec % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.onStateChange({
      selectedHex: this.selectedHex,
      activeTool: this.activeTool,
      attemptsCount: this.attemptsCount,
      isWon: this.isWon,
      timeFormatted,
      elapsedSec: this.elapsedSec,
      score: this.currentScore,
      difficulty: this.difficulty,
      clues: this.gameData ? this.gameData.clues : [],
      pois: this.gameData ? this.gameData.pois : [],
      totalHexes: this.gameData ? this.gameData.grid.hexList.length : 0
    });

    this.render();
  }

  // ===========================================================================
  // GESTIÓN DE EVENTOS
  // ===========================================================================
  initEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerleave', () => {
      this.hoverHex = null;
      this.render();
    });

    // Clic derecho para alternar marcas rápidas (Bandera 🚩)
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.gameData || this.isWon) return;
      const { x, y } = this.getCanvasCoords(e);
      const hex = this.gameData.grid.getHexAtPoint(x, y);
      if (hex && !hex.isPOI) {
        this.toggleFlag(hex);
      }
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
    if (e.button === 2) return; // Gestionado por contextmenu

    const { x, y } = this.getCanvasCoords(e);
    const hex = this.gameData.grid.getHexAtPoint(x, y);
    if (!hex) return;

    if (hex.isPOI) {
      // Al pulsar un POI, resaltar sus pistas
      this.highlightedPOI = (this.highlightedPOI && this.highlightedPOI.id === hex.id) ? null : hex.poiData;
      window.soundFx.playStep();
      this.render();
      return;
    }

    if (this.activeTool === "dig") {
      this.processDig(hex);
    } else if (this.activeTool === "flag") {
      this.toggleFlag(hex);
    } else if (this.activeTool === "discard") {
      this.toggleDiscard(hex);
    } else {
      this.selectedHex = (this.selectedHex && this.selectedHex.id === hex.id) ? null : hex;
      window.soundFx.playStep();
      this.notifyState();
    }
  }

  toggleFlag(hex) {
    const current = this.marks.get(hex.id);
    if (current === 'flag') {
      this.marks.delete(hex.id);
      window.soundFx.playUndo();
    } else {
      this.marks.set(hex.id, 'flag');
      window.soundFx.playStep();
    }
    this.render();
  }

  toggleDiscard(hex) {
    const current = this.marks.get(hex.id);
    if (current === 'discard') {
      this.marks.delete(hex.id);
      window.soundFx.playUndo();
    } else {
      this.marks.set(hex.id, 'discard');
      window.soundFx.playStep();
    }
    this.render();
  }

  clearMarks() {
    this.marks.clear();
    window.soundFx.playUndo();
    this.onToast("Marcas eliminadas.", "info");
    this.render();
  }

  processDig(hex) {
    if (this.marks.get(hex.id) === 'dug') {
      this.onToast("Ya has excavado en esta casilla anteriormente.", "info");
      return;
    }

    if (hex.id === this.gameData.treasureHex.id) {
      // ¡TESORO ENCONTRADO!
      this.isWon = true;
      this.stopTimer();
      this.marks.set(hex.id, 'treasure');
      this.currentScore = this.calculateLiveScore(true);
      window.soundFx.playRecord();

      this.notifyState();
      this.onVictory({
        score: this.currentScore,
        timeFormatted: this.formatTime(this.elapsedSec),
        elapsedSec: this.elapsedSec,
        difficulty: this.difficulty,
        attemptsCount: this.attemptsCount + 1,
        totalHexes: this.gameData.grid.hexList.length,
        numPOIs: this.gameData.pois.length
      });
    } else {
      // Excavación fallida
      this.attemptsCount++;
      this.marks.set(hex.id, 'dug');
      window.soundFx.playError();

      // Generar pista de discrepancia con el primer POI
      const firstPOI = this.gameData.pois[0];
      const actualPath = TreasureGenerator.findShortestPath(firstPOI.hex, hex, this.gameData.straightLineOnly);
      const expectedClue = this.gameData.clues[0];

      this.onToast(`⛏️ ¡Aquí no hay tesoro! (Suma desde ${firstPOI.name}: ${actualPath.sum} vs ${expectedClue.sum} de la pista)`, "warning");
      this.notifyState();
    }
  }

  formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ===========================================================================
  // RENDERIZADO EN CANVAS
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

    // 1. Dibujar hexágonos
    for (const hex of grid.hexList) {
      const corners = grid.getHexCorners(hex);
      const mark = this.marks.get(hex.id);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Colores de fondo y bordes
      if (hex.isPOI) {
        ctx.fillStyle = hex.poiData.bg;
        ctx.strokeStyle = hex.poiData.border;
        ctx.lineWidth = (this.highlightedPOI && this.highlightedPOI.id === hex.id) ? 3.5 : 2;
      } else if (mark === 'treasure' || (this.isWon && hex.id === this.gameData.treasureHex.id)) {
        ctx.fillStyle = "#fef08a"; // Oro brillante
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 3.5;
      } else if (mark === 'dug') {
        ctx.fillStyle = "#e2e8f0"; // Excavado / arena removida
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.2;
      } else if (mark === 'flag') {
        ctx.fillStyle = "#ecfdf5";
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
      } else if (mark === 'discard') {
        ctx.fillStyle = "#fff1f2";
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.5;
      } else if (this.selectedHex && this.selectedHex.id === hex.id) {
        ctx.fillStyle = "#fef3c7";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2.5;
      } else if (this.hoverHex && this.hoverHex.id === hex.id) {
        ctx.fillStyle = "#f1f5f9";
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.8;
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Contenido central (Icono POI, Marcador o Número)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (hex.isPOI) {
        ctx.font = `${Math.round(grid.size * 0.85)}px sans-serif`;
        ctx.fillText(hex.poiData.icon, hex.x, hex.y);
      } else if (mark === 'treasure' || (this.isWon && hex.id === this.gameData.treasureHex.id)) {
        ctx.font = `${Math.round(grid.size * 0.85)}px sans-serif`;
        ctx.fillText("💎", hex.x, hex.y);
      } else if (mark === 'flag') {
        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#047857";
        ctx.fillText(`🚩 ${hex.value}`, hex.x, hex.y);
      } else if (mark === 'discard') {
        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#e11d48";
        ctx.fillText(`❌ ${hex.value}`, hex.x, hex.y);
      } else if (mark === 'dug') {
        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(`🕳️ ${hex.value}`, hex.x, hex.y);
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${Math.max(14, Math.round(grid.size * 0.52))}px Inter, sans-serif`;
        ctx.fillText(hex.value.toString(), hex.x, hex.y);
      }
    }

    // 2. Si hay un POI resaltado, trazar arco de distancia estimada
    if (this.highlightedPOI) {
      const clue = this.gameData.clues.find(c => c.poi.id === this.highlightedPOI.id);
      if (clue) {
        ctx.save();
        ctx.strokeStyle = this.highlightedPOI.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);

        // Dibujar círculo aproximado del radio
        const approxRadius = clue.steps * grid.size * Math.sqrt(3);
        ctx.beginPath();
        ctx.arc(this.highlightedPOI.hex.x, this.highlightedPOI.hex.y, approxRadius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Renderizado en el Canvas de Solución Oficial
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

    TreasurePDFExporter.drawBoardToCanvas(ctx, width, height, this.gameData, true);
  }
}

window.TreasureEngine = TreasureEngine;
