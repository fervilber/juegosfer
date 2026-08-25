/**
 * =============================================================================
 * APP CONTROLLER - Controlador Principal y Enlace con la Interfaz (UI)
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const gameCanvas = document.getElementById('gameCanvas');
  const solutionCanvas = document.getElementById('solutionCanvas');
  const btnNewGame = document.getElementById('btnNewGame');
  const btnUndo = document.getElementById('btnUndo');
  const btnResetSegment = document.getElementById('btnResetSegment');
  const btnExportPdf = document.getElementById('btnExportPdf');
  const btnToggleRanking = document.getElementById('btnToggleRanking');
  const btnRefreshRanking = document.getElementById('btnRefreshRanking');

  // Widgets del encabezado y dashboard
  const displayTimer = document.getElementById('displayTimer');
  const displayScore = document.getElementById('displayScore');
  const displayPhase = document.getElementById('displayPhase');
  const displaySum = document.getElementById('displaySum');
  const displayTarget = document.getElementById('displayTarget');
  const displayBreakdown = document.getElementById('displayBreakdown');
  const displayDifficulty = document.getElementById('displayDifficulty');
  const displayFooterInfo = document.getElementById('displayFooterInfo');

  // Modales
  const victoryModal = document.getElementById('victoryModal');
  const recordModal = document.getElementById('recordModal');
  const inputPlayerName = document.getElementById('inputPlayerName');
  const btnSaveRecord = document.getElementById('btnSaveRecord');
  const btnCloseRecord = document.getElementById('btnCloseRecord');
  const btnPlayAgainVictory = document.getElementById('btnPlayAgainVictory');
  const btnCloseVictory = document.getElementById('btnCloseVictory');
  const toastContainer = document.getElementById('toastContainer');

  // Controles de dificultad
  const difficultyRadios = document.querySelectorAll('input[name="difficultyPreset"]');
  const customConfigPanel = document.getElementById('customConfigPanel');
  const inputCols = document.getElementById('inputCols');
  const inputRows = document.getElementById('inputRows');
  const inputTarget = document.getElementById('inputTarget');
  const inputRandomness = document.getElementById('inputRandomness');
  const inputRelleno = document.getElementById('inputRelleno');
  const inputShape = document.getElementById('inputShape');

  // Pestañas
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanes = document.querySelectorAll('.tab-pane');

  let currentGameData = null;
  let lastVictoryData = null;

  // Inicializar Motor de Juego
  const engine = new GameEngine(gameCanvas, {
    onStateChange: (state) => updateUIState(state),
    onVictory: (victoryData) => handleVictory(victoryData),
    onToast: (msg, type) => showToast(msg, type)
  });

  // ===========================================================================
  // CONFIGURACIÓN DE PRESETS Y GENERACIÓN
  // ===========================================================================
  function getSelectedPresetConfig() {
    let selected = "medio";
    for (const r of difficultyRadios) {
      if (r.checked) {
        selected = r.value;
        break;
      }
    }

    if (selected === "facil") {
      return { cols: 8, rows: 8, target: 10, randomness: 5, relleno: 0, shape: 0, label: "Fácil", waypoints: 2 };
    } else if (selected === "medio") {
      return { cols: 13, rows: 13, target: 14, randomness: 15, relleno: 0, shape: 0, label: "Medio", waypoints: 3 };
    } else if (selected === "dificil") {
      return { cols: 17, rows: 17, target: 18, randomness: 25, relleno: 0, shape: 0, label: "Difícil", waypoints: 4 };
    } else if (selected === "experto") {
      return { cols: 22, rows: 22, target: 24, randomness: 35, relleno: 0, shape: 0, label: "Experto", waypoints: 5 };
    } else {
      // Personalizado
      return {
        cols: parseInt(inputCols.value, 10) || 13,
        rows: parseInt(inputRows.value, 10) || 13,
        target: parseInt(inputTarget.value, 10) || 14,
        randomness: parseInt(inputRandomness.value, 10) || 15,
        relleno: parseInt(inputRelleno.value, 10) || 0,
        shape: parseInt(inputShape.value, 10) || 0,
        label: "Personalizado",
        waypoints: 3
      };
    }
  }

  function startNewGame() {
    const config = getSelectedPresetConfig();
    const grid = new HexGrid(config.cols, config.rows, config.shape);
    currentGameData = MazeGenerator.generate(grid, config.target, config.randomness, config.relleno, config.waypoints);
    engine.startNewGame(currentGameData, config.label);
    renderRankingTable();
  }

  // Escuchar cambios en los presets
  difficultyRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'custom') {
        customConfigPanel.classList.remove('hidden');
      } else {
        customConfigPanel.classList.add('hidden');
      }
    });
  });

  // ===========================================================================
  // ACTUALIZACIÓN DE LA INTERFAZ
  // ===========================================================================
  function updateUIState(state) {
    if (displayTimer) displayTimer.textContent = state.timeFormatted;
    if (displayScore) displayScore.textContent = state.score.toLocaleString();
    if (displayPhase) displayPhase.textContent = `Hito ${Math.min(state.faseActual, state.totalFases)} de ${state.totalFases}`;
    if (displayTarget) displayTarget.textContent = state.targetSum;
    if (displayDifficulty) displayDifficulty.textContent = state.difficulty;

    if (displaySum) {
      displaySum.textContent = `${state.currentSum} / ${state.targetSum}`;
      
      // Color dinámico del badge
      displaySum.className = "inline-block px-3 py-1 rounded-lg font-extrabold text-lg transition-colors ";
      if (state.currentSum === state.targetSum) {
        displaySum.classList.add("bg-emerald-500", "text-white");
      } else if (state.currentSum > state.targetSum) {
        displaySum.classList.add("bg-rose-500", "text-white");
      } else {
        displaySum.classList.add("bg-amber-100", "text-amber-900");
      }
    }

    if (displayBreakdown) {
      if (state.currentPath.length > 0) {
        const values = state.currentPath.map(h => h.value).join(" + ");
        displayBreakdown.textContent = `${values} = ${state.currentSum}`;
      } else {
        displayBreakdown.textContent = "Selecciona la primera casilla contigua...";
      }
    }

    if (displayFooterInfo) {
      displayFooterInfo.textContent = `Celdas marcadas: ${state.currentPath.length} | Fases completadas: ${state.completedSegments.length} | Total celdas: ${state.totalCeldas}`;
    }
  }

  // Manejo de la victoria
  function handleVictory(data) {
    lastVictoryData = data;
    // Solo califica para el Salón de la Fama si NO ha consultado la solución oficial
    const qualifies = !engine.hasViewedSolution && window.rankingManager.qualifies(data.score);

    if (qualifies) {
      window.soundFx.playRecord();
      document.getElementById('recordScoreVal').textContent = `${data.score.toLocaleString()} pts`;
      document.getElementById('recordTimeVal').textContent = data.timeFormatted;
      inputPlayerName.value = "";
      recordModal.classList.remove('hidden');
      inputPlayerName.focus();
    } else {
      window.soundFx.playVictory();
      document.getElementById('victoryScoreVal').textContent = `${data.score.toLocaleString()} pts`;
      document.getElementById('victoryTimeVal').textContent = data.timeFormatted;
      
      const subtitle = document.getElementById('victorySubtitle');
      if (subtitle) {
        if (engine.hasViewedSolution) {
          subtitle.textContent = "⚠️ Partida en Modo Práctica (has consultado la solución oficial previa, no califica para el Top 10)";
          subtitle.className = "text-xs text-amber-600 font-semibold mb-4";
        } else {
          subtitle.textContent = "Has conectado Inicio con Final con sumas exactas";
          subtitle.className = "text-xs text-slate-500 mb-4";
        }
      }
      victoryModal.classList.remove('hidden');
    }
  }

  // Guardar récord
  btnSaveRecord.addEventListener('click', () => {
    const name = inputPlayerName.value.trim() || "Jugador";
    if (lastVictoryData && !engine.hasViewedSolution) {
      window.rankingManager.addScore({
        nombre: name,
        puntos: lastVictoryData.score,
        dificultad: lastVictoryData.difficulty,
        objetivo: lastVictoryData.targetSum,
        celdas: lastVictoryData.totalCeldas,
        hitos: lastVictoryData.totalFases,
        tiempoSeg: lastVictoryData.elapsedSec
      });
      renderRankingTable();
      recordModal.classList.add('hidden');
      switchTab('tabRanking');
      showToast("🏆 ¡Puntuación registrada en el Salón de la Fama!", "success");
    }
  });

  btnCloseRecord.addEventListener('click', () => recordModal.classList.add('hidden'));
  btnCloseVictory.addEventListener('click', () => victoryModal.classList.add('hidden'));
  btnPlayAgainVictory.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    startNewGame();
  });

  // ===========================================================================
  // BOTONES Y EVENTOS
  // ===========================================================================
  btnNewGame.addEventListener('click', () => startNewGame());
  btnUndo.addEventListener('click', () => engine.undoLastStep());
  btnResetSegment.addEventListener('click', () => engine.resetCurrentSegment());

  btnExportPdf.addEventListener('click', () => {
    if (currentGameData) {
      const config = getSelectedPresetConfig();
      PDFExporter.exportPDF(currentGameData, config.label);
    }
  });

  btnToggleRanking.addEventListener('click', () => {
    switchTab('tabRanking');
  });

  if (btnRefreshRanking) {
    btnRefreshRanking.addEventListener('click', () => {
      renderRankingTable();
      showToast("Tabla de ranking actualizada.", "info");
    });
  }

  // Cambio de pestañas
  function switchTab(targetId) {
    tabPanes.forEach(pane => {
      if (pane.id === targetId) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab-target') === targetId) {
        btn.classList.add('border-emerald-600', 'text-emerald-700', 'bg-emerald-50');
        btn.classList.remove('border-transparent', 'text-slate-600');
      } else {
        btn.classList.remove('border-emerald-600', 'text-emerald-700', 'bg-emerald-50');
        btn.classList.add('border-transparent', 'text-slate-600');
      }
    });

    if (targetId === 'tabSolution') {
      if (!engine.isWon && !engine.hasViewedSolution) {
        engine.hasViewedSolution = true;
        showToast("⚠️ Solución oficial consultada. Esta partida queda en Modo Práctica y no entrará en el Salón de la Fama.", "warning");
      }
      engine.renderSolution(solutionCanvas);
    } else if (targetId === 'tabGame') {
      engine.resizeCanvas();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab-target');
      switchTab(targetId);
    });
  });

  // Renderizar la tabla del ranking
  function renderRankingTable() {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const scores = window.rankingManager.getScores();

    scores.forEach((s) => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";

      let medal = `${s.posicion}º`;
      if (s.posicion === 1) medal = `🥇 1º`;
      else if (s.posicion === 2) medal = `🥈 2º`;
      else if (s.posicion === 3) medal = `🥉 3º`;

      tr.innerHTML = `
        <td class="py-3 px-4 text-center font-bold text-slate-700">${medal}</td>
        <td class="py-3 px-4 font-semibold text-slate-900">${escapeHtml(s.nombre)}</td>
        <td class="py-3 px-4 text-right font-extrabold text-emerald-600">${s.puntos.toLocaleString()}</td>
        <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">${s.dificultad}</span></td>
        <td class="py-3 px-4 text-center text-slate-600 font-mono">${s.objetivo}</td>
        <td class="py-3 px-4 text-center text-slate-600">${s.celdas}</td>
        <td class="py-3 px-4 text-center font-mono text-slate-600">${s.tiempo}</td>
        <td class="py-3 px-4 text-center text-xs text-slate-400">${s.fecha}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Notificaciones Toast flotantes
  function showToast(msg, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    
    let bgClass = "bg-slate-900 text-white";
    if (type === "error") bgClass = "bg-rose-600 text-white";
    else if (type === "warning") bgClass = "bg-amber-600 text-white";
    else if (type === "success") bgClass = "bg-emerald-600 text-white";

    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 flex items-center gap-2 ${bgClass}`;
    toast.textContent = msg;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Iniciar la primera partida al cargar
  startNewGame();
});
