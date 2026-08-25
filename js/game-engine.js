/**
 * =============================================================================
 * GAME ENGINE - Motor de Juego Interactivo y Renderizado Canvas a 60 FPS
 * Detección táctil/puntero con corrección DPR, control de reglas y puntuación
 * =============================================================================
 */

class GameEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Callbacks para actualizar la UI
    this.onStateChange = options.onStateChange || (() => {});
    this.onVictory = options.onVictory || (() => {});
    this.onToast = options.onToast || (() => {});

    // Estado del juego
    this.gameData = null;
    this.difficulty = "Medio";
    this.completedSegments = []; // Array de arrays de HexCell
    this.currentCheckpoint = null;
    this.currentPath = [];       // Array de HexCell en el tramo activo
    this.currentSum = 0;
    this.faseActual = 1;
    this.totalFases = 1;
    this.isWon = false;
    this.hasViewedSolution = false; // Filtro de seguridad anti-trampas
    this.hoverHex = null;

    // Cronómetro y puntuación
    this.startTime = null;
    this.elapsedSec = 0;
    this.timerInterval = null;
    this.currentScore = 0;

    // Inicializar eventos del Canvas
    this.initEvents();
  }

  // Carga e inicializa una nueva partida
  startNewGame(gameData, difficulty = "Medio") {
    this.gameData = gameData;
    this.difficulty = difficulty;
    
    this.completedSegments = [];
    this.currentCheckpoint = gameData.startHex;
    this.currentPath = [];
    this.currentSum = 0;
    this.faseActual = 1;
    this.totalFases = Math.max(1, gameData.masterHexes.length - 1);
    this.isWon = false;
    this.hasViewedSolution = false; // Reiniciar filtro de seguridad
    this.hoverHex = null;

    // Iniciar cronómetro
    this.stopTimer();
    this.elapsedSec = 0;
    this.startTime = Date.now();
    this.currentScore = 0;
    this.timerInterval = setInterval(() => this.tickTimer(), 1000);

    // Ajustar y renderizar
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

  // Cálculo algorítmico de puntuación
  calculateLiveScore(isVictory = false) {
    if (!this.gameData) return 0;
    const nHitos = this.completedSegments.length;
    const baseHitos = nHitos * 250;
    const bonusVictory = isVictory ? 1000 : 0;
    const baseTotal = baseHitos + bonusVictory;

    const nCeldas = this.gameData.grid.hexList.length;
    const targetVal = this.gameData.targetSum;

    const mTam = 1 + (nCeldas / 100);
    const mObj = 1 + (targetVal / 30);

    const subtotal = baseTotal * mTam * mObj;
    const bonusTiempo = isVictory ? Math.max(0, (300 - this.elapsedSec) * 10) : 0;

    return Math.round(subtotal + bonusTiempo);
  }

  // Notifica los cambios de estado a la interfaz
  notifyState() {
    const mins = Math.floor(this.elapsedSec / 60);
    const secs = this.elapsedSec % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.onStateChange({
      faseActual: this.faseActual,
      totalFases: this.totalFases,
      currentSum: this.currentSum,
      targetSum: this.gameData ? this.gameData.targetSum : 14,
      currentPath: this.currentPath,
      completedSegments: this.completedSegments,
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
  // INTERACCIÓN CELDA A CELDA (EVENTOS POINTER / TOUCH)
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

  // Convierte las coordenadas del evento al espacio lógico del Canvas (independiente de DPR)
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
    const clickedHex = this.gameData.grid.getHexAtPoint(x, y);
    if (!clickedHex) return;

    this.processCellClick(clickedHex);
  }

  // Procesa la regla de clic en la celda
  processCellClick(hex) {
    // 1. Evitar interactuar con celdas de fases ya completadas
    const allCompletedIds = new Set(this.completedSegments.flatMap(s => s.map(h => h.id)));
    if (allCompletedIds.has(hex.id) && hex.id !== this.currentCheckpoint.id) {
      window.soundFx.playError();
      this.onToast("Esta casilla ya pertenece a una fase anterior completada.", "warning");
      return;
    }

    // 2. Regla de Deselección: Si hace clic en la última celda marcada
    if (this.currentPath.length > 0 && hex.id === this.currentPath[this.currentPath.length - 1].id) {
      this.currentPath.pop();
      this.currentSum = this.currentPath.reduce((acc, h) => acc + h.value, 0);
      window.soundFx.playUndo();
      this.notifyState();
      return;
    }

    // 3. Si pulsa una celda intermedia del tramo activo que no es la última
    if (this.currentPath.some(h => h.id === hex.id)) {
      window.soundFx.playError();
      this.onToast("Solo puedes desmarcar pulsando en el último hexágono marcado.", "warning");
      return;
    }

    // 4. Validar adyacencia estricta con el nodo anterior
    const prevNode = this.currentPath.length === 0 ? this.currentCheckpoint : this.currentPath[this.currentPath.length - 1];
    const isAdjacent = prevNode.neighbors.some(n => n.id === hex.id);

    if (!isAdjacent) {
      window.soundFx.playError();
      this.onToast("❌ Casilla no contigua. Debes seleccionar un hexágono adyacente al anterior.", "error");
      return;
    }

    // 5. Si la celda es un Punto Maestro (o Inicio / Fin)
    if (hex.isMaster) {
      if (hex.id === this.currentCheckpoint.id) return;

      if (this.currentSum === this.gameData.targetSum) {
        // ¡Fase completada con éxito!
        const newSegment = [this.currentCheckpoint, ...this.currentPath, hex];
        this.completedSegments.push(newSegment);
        this.currentCheckpoint = hex;
        this.currentPath = [];
        this.currentSum = 0;
        this.faseActual++;

        if (hex.isEnd) {
          // ¡VICTORIA!
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
            totalCeldas: this.gameData.grid.hexList.length
          });
        } else {
          window.soundFx.playMilestone();
          this.onToast(`⭐ ¡Fase ${this.faseActual - 1} completada con la suma exacta!`, "success");
          this.notifyState();
        }
      } else {
        window.soundFx.playError();
        const diff = this.gameData.targetSum - this.currentSum;
        if (diff > 0) {
          this.onToast(`⚠️ Suma insuficiente: llevas ${this.currentSum} y el objetivo es ${this.gameData.targetSum} (te faltan ${diff}).`, "warning");
        } else {
          this.onToast(`⚠️ Te has pasado: llevas ${this.currentSum} y el objetivo es ${this.gameData.targetSum} (sobran ${Math.abs(diff)}).`, "warning");
        }
      }
      return;
    }

    // 6. Casilla normal válida
    this.currentPath.push(hex);
    this.currentSum += hex.value;
    window.soundFx.playStep();

    if (this.currentSum > this.gameData.targetSum) {
      this.onToast(`⚠️ ¡Atención! Suma actual: ${this.currentSum} (Objetivo: ${this.gameData.targetSum}). Puedes desmarcar haciendo clic de nuevo.`, "warning");
    }

    this.notifyState();
  }

  // Deshacer último paso
  undoLastStep() {
    if (this.currentPath.length === 0) return;
    this.currentPath.pop();
    this.currentSum = this.currentPath.reduce((acc, h) => acc + h.value, 0);
    window.soundFx.playUndo();
    this.notifyState();
  }

  // Reiniciar tramo activo
  resetCurrentSegment() {
    if (this.currentPath.length === 0) return;
    this.currentPath = [];
    this.currentSum = 0;
    window.soundFx.playUndo();
    this.onToast("Tramo actual reiniciado.", "info");
    this.notifyState();
  }

  formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ===========================================================================
  // RENDERIZADO DEL CANVAS EN ALTA DEFINICIÓN (RETINA DISPLAY)
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
    const activePathIds = new Set(this.currentPath.map(h => h.id));
    const completedIds = new Set(this.completedSegments.flatMap(s => s.map(h => h.id)));

    // 1. Dibujar todas las celdas
    for (const hex of grid.hexList) {
      const corners = grid.getHexCorners(hex);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Colores de relleno y borde según estado
      if (hex.isStart) {
        ctx.fillStyle = "#86efac"; // Verde claro
        ctx.strokeStyle = "#15803d";
        ctx.lineWidth = 3;
      } else if (hex.isEnd) {
        ctx.fillStyle = "#fda4af"; // Rosa suave
        ctx.strokeStyle = "#be123c";
        ctx.lineWidth = 3;
      } else if (completedIds.has(hex.id) && !hex.isMaster) {
        ctx.fillStyle = "#dcfce7"; // Verde éxito
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2.2;
      } else if (activePathIds.has(hex.id)) {
        ctx.fillStyle = "#fef3c7"; // Ámbar suave
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2.5;
      } else if (hex.isMaster) {
        // Maestro alcanzado vs no alcanzado
        const isReached = this.completedSegments.some(s => s[s.length - 1].id === hex.id);
        ctx.fillStyle = isReached ? "#bbf7d0" : "#e0f2fe";
        ctx.strokeStyle = isReached ? "#15803d" : "#0284c7";
        ctx.lineWidth = 2.5;
      } else {
        // Celda estándar
        ctx.fillStyle = (this.hoverHex && this.hoverHex.id === hex.id) ? "#f1f5f9" : "#f8fafc";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Punto de Control Activo resaltado
      if (this.currentCheckpoint && this.currentCheckpoint.id === hex.id) {
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }

      // Rótulos y números
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (hex.isStart) {
        ctx.fillStyle = "#15803d";
        ctx.font = "bold 13px Inter, sans-serif";
        ctx.fillText("INICIO", hex.x, hex.y);
      } else if (hex.isEnd) {
        ctx.fillStyle = "#be123c";
        ctx.font = "bold 13px Inter, sans-serif";
        ctx.fillText("FINAL", hex.x, hex.y);
      } else if (hex.isMaster) {
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.arc(hex.x, hex.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = activePathIds.has(hex.id) ? "#92400e" : completedIds.has(hex.id) ? "#166534" : "#334155";
        ctx.font = activePathIds.has(hex.id) || completedIds.has(hex.id) ? "bold 17px Inter, sans-serif" : "bold 15px Inter, sans-serif";
        const valText = (hex.value !== null && hex.value !== undefined) ? hex.value.toString() : "0";
        ctx.fillText(valText, hex.x, hex.y);
      }
    }

    // 2. Dibujar líneas de conexión continua en tramos completados
    for (const seg of this.completedSegments) {
      if (seg.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = "#15803d";
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.stroke();
      }
    }

    // 3. Dibujar línea discontinua en el tramo activo
    if (this.currentPath.length > 0) {
      const activeSequence = [this.currentCheckpoint, ...this.currentPath];
      ctx.beginPath();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 5]);
      ctx.moveTo(activeSequence[0].x, activeSequence[0].y);
      for (let i = 1; i < activeSequence.length; i++) {
        ctx.lineTo(activeSequence[i].x, activeSequence[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Renderiza la solución completa en un canvas secundario
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

    PDFExporter.drawBoardToCanvas(ctx, width, height, this.gameData, true);
  }
}

window.GameEngine = GameEngine;
