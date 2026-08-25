/**
 * =============================================================================
 * APP TREASURE CONTROLLER - Controlador de UI para HexaTreasure
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const treasureCanvas = document.getElementById('treasureCanvas');
  const solutionCanvas = document.getElementById('solutionCanvas');
  const btnNewGame = document.getElementById('btnNewGame');
  const btnExportPdf = document.getElementById('btnExportPdf');
  const btnToggleRanking = document.getElementById('btnToggleRanking');
  const btnRefreshRanking = document.getElementById('btnRefreshRanking');
  const rankingTableBody = document.getElementById('rankingTableBody');

  // Herramientas de deducción
  const toolButtons = document.querySelectorAll('[data-tool]');
  const btnClearMarks = document.getElementById('btnClearMarks');

  // Panel de Pistas
  const cluesList = document.getElementById('cluesList');

  // Widgets de Estado
  const displayTimer = document.getElementById('displayTimer');
  const displayScore = document.getElementById('displayScore');
  const displayAttempts = document.getElementById('displayAttempts');
  const displayPoisCount = document.getElementById('displayPoisCount');
  const displayDifficulty = document.getElementById('displayDifficulty');
  const displayFooterInfo = document.getElementById('displayFooterInfo');

  // Modales
  const victoryModal = document.getElementById('victoryModal');
  const victoryScoreVal = document.getElementById('victoryScoreVal');
  const victoryTimeVal = document.getElementById('victoryTimeVal');
  const victoryAttemptsVal = document.getElementById('victoryAttemptsVal');
  const btnPlayAgainVictory = document.getElementById('btnPlayAgainVictory');
  const btnCloseVictory = document.getElementById('btnCloseVictory');

  const recordModal = document.getElementById('recordModal');
  const recordScoreVal = document.getElementById('recordScoreVal');
  const recordTimeVal = document.getElementById('recordTimeVal');
  const inputPlayerName = document.getElementById('inputPlayerName');
  const btnSaveRecord = document.getElementById('btnSaveRecord');
  const btnCloseRecord = document.getElementById('btnCloseRecord');

  const toastContainer = document.getElementById('toastContainer');

  // Configuración
  const difficultyRadios = document.querySelectorAll('input[name="difficultyPreset"]');
  const customConfigPanel = document.getElementById('customConfigPanel');
  const inputCols = document.getElementById('inputCols');
  const inputRows = document.getElementById('inputRows');
  const inputPois = document.getElementById('inputPois');
  const inputMaxVal = document.getElementById('inputMaxVal');
  const inputShape = document.getElementById('inputShape');

  // Pestañas
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanes = document.querySelectorAll('.tab-pane');

  let currentGameData = null;
  let lastVictoryData = null;

  // Inicializar Motor
  const engine = new TreasureEngine(treasureCanvas, {
    onStateChange: (state) => updateUIState(state),
    onVictory: (data) => handleVictory(data),
    onToast: (msg, type) => showToast(msg, type)
  });

  // ===========================================================================
  // PRESETS DE DIFICULTAD
  // ===========================================================================
  function getSelectedPresetConfig() {
    let selected = "marinero";
    for (const r of difficultyRadios) {
      if (r.checked) {
        selected = r.value;
        break;
      }
    }

    if (selected === "grumete") {
      return { cols: 7, rows: 7, pois: 3, maxVal: 6, shape: 0, label: "Grumete (Fácil)" };
    } else if (selected === "marinero") {
      return { cols: 9, rows: 9, pois: 3, maxVal: 9, shape: 1, label: "Marinero (Medio)" };
    } else if (selected === "capitan") {
      return { cols: 12, rows: 12, pois: 4, maxVal: 9, shape: 3, label: "Capitán (Difícil)" };
    } else if (selected === "corsario") {
      return { cols: 14, rows: 14, pois: 4, maxVal: 12, shape: 2, label: "Corsario (Experto)" };
    } else {
      return {
        cols: parseInt(inputCols.value, 10) || 9,
        rows: parseInt(inputRows.value, 10) || 9,
        pois: parseInt(inputPois.value, 10) || 3,
        maxVal: parseInt(inputMaxVal.value, 10) || 9,
        shape: parseInt(inputShape.value, 10) || 1,
        label: "Personalizado"
      };
    }
  }

  function startNewGame() {
    const config = getSelectedPresetConfig();
    const grid = new HexGrid(config.cols, config.rows, config.shape);
    currentGameData = TreasureGenerator.generate(grid, config.pois, config.maxVal, false);
    engine.startNewGame(currentGameData, config.label);
    renderClues(currentGameData.clues);
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
  // HERRAMIENTAS DEDUCTIVAS
  // ===========================================================================
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      engine.setTool(tool);

      toolButtons.forEach(b => {
        if (b === btn) {
          b.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-300');
        } else {
          b.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-300');
        }
      });
    });
  });

  if (btnClearMarks) {
    btnClearMarks.addEventListener('click', () => engine.clearMarks());
  }

  // ===========================================================================
  // RENDERIZADO DE PISTAS
  // ===========================================================================
  function renderClues(clues) {
    if (!cluesList) return;
    cluesList.innerHTML = '';

    clues.forEach((clue, idx) => {
      const card = document.createElement('div');
      card.className = "bg-white p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all shadow-sm flex items-center justify-between gap-3 group";
      card.setAttribute('title', 'Haz clic para iluminar el radio estimado de esta baliza en el mapa');

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner" style="background-color: ${clue.poi.bg}; border: 1.5px solid ${clue.poi.border};">
            ${clue.poi.icon}
          </div>
          <div>
            <span class="font-bold text-slate-800 text-sm block group-hover:text-emerald-700 transition-colors">${clue.poi.name}</span>
            <span class="text-xs text-slate-500 font-medium">Distancia: <b class="text-slate-700 font-mono">${clue.steps} pasos</b></span>
          </div>
        </div>
        <div class="text-right bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
          <span class="text-[9px] font-bold text-emerald-800 uppercase block">SUMA RUTA</span>
          <span class="text-lg font-black text-emerald-700 font-mono">${clue.sum}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        engine.setHighlightedPOI(clue.poi);
      });

      cluesList.appendChild(card);
    });
  }

  // ===========================================================================
  // ACTUALIZACIÓN DE ESTADO DE UI
  // ===========================================================================
  function updateUIState(state) {
    if (displayTimer) displayTimer.textContent = state.timeFormatted;
    if (displayScore) displayScore.textContent = state.score.toLocaleString();
    if (displayAttempts) displayAttempts.textContent = state.attemptsCount.toString();
    if (displayDifficulty) displayDifficulty.textContent = state.difficulty;
    if (displayPoisCount) displayPoisCount.textContent = state.pois.length.toString();

    if (displayFooterInfo) {
      displayFooterInfo.textContent = `Balizas activas: ${state.pois.length} | Intentos de excavación: ${state.attemptsCount} | Total casillas: ${state.totalHexes}`;
    }
  }

  // ===========================================================================
  // GESTIÓN DE VICTORIA Y SALÓN DE LA FAMA
  // ===========================================================================
  function handleVictory(data) {
    lastVictoryData = data;
    const qualifies = !engine.hasViewedSolution && window.treasureRankingManager.qualifies(data.score);

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
      window.soundFx.playVictory ? window.soundFx.playVictory() : window.soundFx.playRecord();
      if (victoryScoreVal) victoryScoreVal.textContent = `${data.score.toLocaleString()} pts`;
      if (victoryTimeVal) victoryTimeVal.textContent = data.timeFormatted;
      if (victoryAttemptsVal) victoryAttemptsVal.textContent = `${data.attemptsCount} intentos`;

      const subtitle = document.getElementById('victorySubtitle');
      if (subtitle) {
        if (engine.hasViewedSolution) {
          subtitle.textContent = "⚠️ Partida en Modo Práctica (has consultado la solución oficial previa, no califica para el Top 10)";
          subtitle.className = "text-xs text-amber-600 font-semibold mb-4";
        } else {
          subtitle.textContent = "¡Has desenterrado el cofre del tesoro con éxito!";
          subtitle.className = "text-xs text-slate-500 mb-4";
        }
      }
      if (victoryModal) victoryModal.classList.remove('hidden');
    }
  }

  if (btnSaveRecord) {
    btnSaveRecord.addEventListener('click', () => {
      if (!lastVictoryData || engine.hasViewedSolution) return;
      const playerName = (inputPlayerName.value || "Buscador").trim();

      window.treasureRankingManager.addScore({
        nombre: playerName,
        puntos: lastVictoryData.score,
        dificultad: lastVictoryData.difficulty,
        objetivo: `${lastVictoryData.numPOIs} Balizas`,
        celdas: lastVictoryData.totalHexes,
        hitos: lastVictoryData.attemptsCount,
        tiempoSeg: lastVictoryData.elapsedSec
      });

      if (recordModal) recordModal.classList.add('hidden');
      showToast("🏆 ¡Récord guardado con éxito en el Salón de la Fama!", "success");
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
    const scores = window.treasureRankingManager.getScores();

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
        <td class="py-3 px-4 text-center font-bold text-slate-700">${item.objetivo}</td>
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

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      if (currentGameData) {
        const config = getSelectedPresetConfig();
        TreasurePDFExporter.exportPDF(currentGameData, config.label);
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
