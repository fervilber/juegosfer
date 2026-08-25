/**
 * =============================================================================
 * APP PAIRS CONTROLLER - Controlador de UI para Sumas Emparejadas con Ranking Top 10
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const pairsCanvas = document.getElementById('pairsCanvas');
  const solutionCanvas = document.getElementById('solutionCanvas');
  const btnNewGame = document.getElementById('btnNewGame');
  const btnUndoPair = document.getElementById('btnUndoPair');
  const btnResetBoard = document.getElementById('btnResetBoard');
  const btnExportPdf = document.getElementById('btnExportPdf');
  const btnToggleRanking = document.getElementById('btnToggleRanking');
  const btnRefreshRanking = document.getElementById('btnRefreshRanking');
  const rankingTableBody = document.getElementById('rankingTableBody');

  // Widgets de Estado
  const displayTimer = document.getElementById('displayTimer');
  const displayScore = document.getElementById('displayScore');
  const displayPairsCount = document.getElementById('displayPairsCount');
  const displayTarget = document.getElementById('displayTarget');
  const displayPrompt = document.getElementById('displayPrompt');
  const displayDifficulty = document.getElementById('displayDifficulty');
  const displayFooterInfo = document.getElementById('displayFooterInfo');

  // Modales
  const victoryModal = document.getElementById('victoryModal');
  const victoryScoreVal = document.getElementById('victoryScoreVal');
  const victoryTimeVal = document.getElementById('victoryTimeVal');
  const btnPlayAgainVictory = document.getElementById('btnPlayAgainVictory');
  const btnCloseVictory = document.getElementById('btnCloseVictory');

  const recordModal = document.getElementById('recordModal');
  const recordScoreVal = document.getElementById('recordScoreVal');
  const recordTimeVal = document.getElementById('recordTimeVal');
  const inputPlayerName = document.getElementById('inputPlayerName');
  const btnSaveRecord = document.getElementById('btnSaveRecord');
  const btnCloseRecord = document.getElementById('btnCloseRecord');

  const toastContainer = document.getElementById('toastContainer');

  // Controles de Configuración
  const difficultyRadios = document.querySelectorAll('input[name="difficultyPreset"]');
  const customConfigPanel = document.getElementById('customConfigPanel');
  const inputCols = document.getElementById('inputCols');
  const inputRows = document.getElementById('inputRows');
  const inputTarget = document.getElementById('inputTarget');
  const inputRelleno = document.getElementById('inputRelleno');
  const inputShape = document.getElementById('inputShape');

  // Pestañas
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanes = document.querySelectorAll('.tab-pane');

  let currentGameData = null;
  let lastVictoryData = null;

  // Inicializar Motor
  const engine = new PairsEngine(pairsCanvas, {
    onStateChange: (state) => updateUIState(state),
    onVictory: (data) => handleVictory(data),
    onToast: (msg, type) => showToast(msg, type)
  });

  // ===========================================================================
  // CONFIGURACIÓN DE PRESETS
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
      return { cols: 6, rows: 6, target: 10, relleno: 0, shape: 0, label: "Fácil" };
    } else if (selected === "medio") {
      return { cols: 8, rows: 8, target: 14, relleno: 0, shape: 0, label: "Medio" };
    } else if (selected === "dificil") {
      return { cols: 11, rows: 11, target: 18, relleno: 0, shape: 1, label: "Difícil (Círculo)" };
    } else if (selected === "experto") {
      return { cols: 14, rows: 14, target: 24, relleno: 0, shape: 3, label: "Experto (Rombo)" };
    } else {
      return {
        cols: parseInt(inputCols.value, 10) || 8,
        rows: parseInt(inputRows.value, 10) || 8,
        target: parseInt(inputTarget.value, 10) || 14,
        relleno: parseInt(inputRelleno.value, 10) || 0,
        shape: parseInt(inputShape.value, 10) || 0,
        label: "Personalizado"
      };
    }
  }

  function startNewGame() {
    const config = getSelectedPresetConfig();
    const grid = new HexGrid(config.cols, config.rows, config.shape);
    currentGameData = PairsGenerator.generate(grid, config.target, config.relleno);
    engine.startNewGame(currentGameData, config.label);
  }

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
  // ACTUALIZACIÓN DE INTERFAZ Y ESTADO
  // ===========================================================================
  function updateUIState(state) {
    if (displayTimer) displayTimer.textContent = state.timeFormatted;
    if (displayScore) displayScore.textContent = state.score.toLocaleString();
    if (displayTarget) displayTarget.textContent = state.targetSum;
    if (displayDifficulty) displayDifficulty.textContent = state.difficulty;

    if (displayPairsCount) {
      displayPairsCount.textContent = `${state.foundCount} / ${state.totalSolutions}`;
      if (state.foundCount === state.totalSolutions && state.totalSolutions > 0) {
        displayPairsCount.className = "inline-block px-3 py-1 rounded-lg font-extrabold text-lg bg-emerald-500 text-white transition-colors";
      } else {
        displayPairsCount.className = "inline-block px-3 py-1 rounded-lg font-extrabold text-lg bg-emerald-100 text-emerald-900 transition-colors";
      }
    }

    if (displayPrompt) {
      if (state.selectedHex) {
        displayPrompt.textContent = `Seleccionado: [${state.selectedHex.value}]. Toca una casilla vecina que sume ${state.targetSum - state.selectedHex.value}.`;
        displayPrompt.className = "text-xs font-bold text-amber-700 mt-1";
      } else {
        displayPrompt.textContent = `Encuentra parejas contiguas que sumen exactamente ${state.targetSum}`;
        displayPrompt.className = "text-xs font-medium text-slate-500 mt-1";
      }
    }

    if (displayFooterInfo) {
      displayFooterInfo.textContent = `Pares descubiertos: ${state.foundCount} de ${state.totalSolutions} | Total celdas: ${state.totalCeldas}`;
    }
  }

  // ===========================================================================
  // GESTIÓN DE VICTORIA Y SALÓN DE LA FAMA
  // ===========================================================================
  function handleVictory(data) {
    lastVictoryData = data;
    // Solo califica para el Salón de la Fama si NO ha consultado la solución oficial
    const qualifies = !engine.hasViewedSolution && window.pairsRankingManager.qualifies(data.score);

    if (qualifies) {
      window.soundFx.playRecord();
      if (recordScoreVal) recordScoreVal.textContent = `${data.score.toLocaleString()} pts`;
      if (recordTimeVal) recordTimeVal.textContent = data.timeFormatted;
      if (inputPlayerName) {
        inputPlayerName.value = "";
        setTimeout(() => inputPlayerName.focus(), 200);
      }
      if (recordModal) recordModal.classList.remove('hidden');
    } else {
      window.soundFx.playVictory ? window.soundFx.playVictory() : window.soundFx.playMilestone();
      if (victoryScoreVal) victoryScoreVal.textContent = `${data.score.toLocaleString()} pts`;
      if (victoryTimeVal) victoryTimeVal.textContent = data.timeFormatted;
      
      const subtitle = document.getElementById('victorySubtitle');
      if (subtitle) {
        if (engine.hasViewedSolution) {
          subtitle.textContent = "⚠️ Partida en Modo Práctica (has consultado la solución oficial previa, no califica para el Top 10)";
          subtitle.className = "text-xs text-amber-600 font-semibold mb-4";
        } else {
          subtitle.textContent = "Has completado con éxito todo el tablero";
          subtitle.className = "text-xs text-slate-500 mb-4";
        }
      }
      if (victoryModal) victoryModal.classList.remove('hidden');
    }
  }

  if (btnSaveRecord) {
    btnSaveRecord.addEventListener('click', () => {
      if (!lastVictoryData || engine.hasViewedSolution) return;
      const playerName = (inputPlayerName.value || "Jugador").trim();
      
      window.pairsRankingManager.addScore({
        nombre: playerName,
        puntos: lastVictoryData.score,
        dificultad: lastVictoryData.difficulty,
        objetivo: lastVictoryData.targetSum,
        celdas: lastVictoryData.totalCeldas,
        hitos: lastVictoryData.foundPairs,
        tiempoSeg: lastVictoryData.elapsedSec
      });

      if (recordModal) recordModal.classList.add('hidden');
      showToast("🏆 ¡Puntuación guardada con éxito en el Salón de la Fama!", "success");
      renderRankingTable();
      switchTab('tabRanking');
    });
  }

  if (btnCloseRecord) {
    btnCloseRecord.addEventListener('click', () => {
      if (recordModal) recordModal.classList.add('hidden');
    });
  }

  if (btnCloseVictory) {
    btnCloseVictory.addEventListener('click', () => victoryModal.classList.add('hidden'));
  }
  if (btnPlayAgainVictory) {
    btnPlayAgainVictory.addEventListener('click', () => {
      victoryModal.classList.add('hidden');
      startNewGame();
    });
  }

  // ===========================================================================
  // RENDERIZADO DEL SALÓN DE LA FAMA
  // ===========================================================================
  function renderRankingTable() {
    if (!rankingTableBody) return;
    const scores = window.pairsRankingManager.getScores();

    rankingTableBody.innerHTML = '';
    if (scores.length === 0) {
      rankingTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">Aún no hay récords guardados.</td></tr>`;
      return;
    }

    scores.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.className = index % 2 === 0 ? "bg-white hover:bg-slate-50 transition-colors" : "bg-slate-50/60 hover:bg-slate-100/60 transition-colors";

      let medal = `<span class="font-bold text-slate-500">${item.posicion}º</span>`;
      if (item.posicion === 1) medal = `<span class="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-extrabold">🥇 1º</span>`;
      if (item.posicion === 2) medal = `<span class="inline-block bg-slate-200 text-slate-800 text-xs px-2 py-0.5 rounded-full font-extrabold">🥈 2º</span>`;
      if (item.posicion === 3) medal = `<span class="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-extrabold">🥉 3º</span>`;

      tr.innerHTML = `
        <td class="py-3 px-4 text-center font-bold">${medal}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${item.nombre}</td>
        <td class="py-3 px-4 text-right font-extrabold text-emerald-600">${item.puntos.toLocaleString()}</td>
        <td class="py-3 px-4 text-center"><span class="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-semibold">${item.dificultad}</span></td>
        <td class="py-3 px-4 text-center font-mono font-bold text-slate-700">${item.objetivo}</td>
        <td class="py-3 px-4 text-center font-bold text-slate-700">${item.hitos}</td>
        <td class="py-3 px-4 text-center font-mono text-xs text-slate-600">${item.tiempo}</td>
        <td class="py-3 px-4 text-center text-xs text-slate-400">${item.fecha ? item.fecha.slice(0, 10) : '-'}</td>
      `;
      rankingTableBody.appendChild(tr);
    });
  }

  if (btnRefreshRanking) {
    btnRefreshRanking.addEventListener('click', () => {
      renderRankingTable();
      showToast("Ranking actualizado.", "info");
    });
  }

  if (btnToggleRanking) {
    btnToggleRanking.addEventListener('click', () => {
      switchTab('tabRanking');
    });
  }

  // ===========================================================================
  // BOTONES DE ACCIÓN
  // ===========================================================================
  if (btnNewGame) btnNewGame.addEventListener('click', () => startNewGame());
  if (btnUndoPair) btnUndoPair.addEventListener('click', () => engine.undoLastPair());
  if (btnResetBoard) btnResetBoard.addEventListener('click', () => engine.resetAllPairs());

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      if (currentGameData) {
        const config = getSelectedPresetConfig();
        PairsPDFExporter.exportPDF(currentGameData, config.label);
      }
    });
  }

  // Pestañas
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
        btn.classList.add('border-brand-600', 'text-brand-700', 'bg-brand-50');
        btn.classList.remove('border-transparent', 'text-slate-600');
      } else {
        btn.classList.remove('border-brand-600', 'text-brand-700', 'bg-brand-50');
        btn.classList.add('border-transparent', 'text-slate-600');
      }
    });

    if (targetId === 'tabSolution') {
      if (!engine.isWon && !engine.hasViewedSolution) {
        engine.hasViewedSolution = true;
        showToast("⚠️ Solución oficial consultada. Esta partida queda en Modo Práctica y no entrará en el Salón de la Fama.", "warning");
      }
      engine.renderSolution(solutionCanvas);
    } else if (targetId === 'tabRanking') {
      renderRankingTable();
    } else if (targetId === 'tabGame') {
      engine.resizeCanvas();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab-target'));
    });
  });

  // Toasts
  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement('div');

    let bgClass = "bg-slate-900 text-white";
    let icon = "ℹ️";
    if (type === "success") {
      bgClass = "bg-emerald-600 text-white";
      icon = "✅";
    } else if (type === "warning") {
      bgClass = "bg-amber-500 text-white";
      icon = "⚠️";
    } else if (type === "error") {
      bgClass = "bg-rose-600 text-white";
      icon = "❌";
    }

    toast.className = `${bgClass} px-4 py-2.5 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Inicializar ranking y comenzar primer juego
  renderRankingTable();
  startNewGame();
});
