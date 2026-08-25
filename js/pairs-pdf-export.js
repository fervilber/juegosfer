/**
 * =============================================================================
 * PAIRS PDF EXPORTER - Generador de Documentos PDF A4 para Sumas Emparejadas
 * =============================================================================
 */

class PairsPDFExporter {
  /**
   * Exporta un PDF A4 de 2 páginas (Enunciado + Solución) en el navegador con jsPDF.
   */
  static async exportPDF(gameData, difficultyLabel = "Medio") {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("La librería jsPDF no está cargada. Comprueba tu conexión.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Crear canvas virtual de alta resolución (1200x900)
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1400;
    renderCanvas.height = 1050;
    const ctx = renderCanvas.getContext('2d');

    // =========================================================================
    // PÁGINA 1: HOJA DE JUEGO (ENUNCIADO)
    // =========================================================================
    // Cabecera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59); // Verde oscuro FunnyMathPlanet
    doc.text("Juego de Sumas Emparejadas", pageWidth / 2, 22, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(`Encuentra dos hexágonos adyacentes que sumen el valor buscado: ${gameData.targetSum}`, pageWidth / 2, 29, { align: 'center' });

    // Renderizar tablero sin resolver
    this.drawBoardToCanvas(ctx, renderCanvas.width, renderCanvas.height, gameData, false);
    const imgDataGame = renderCanvas.toDataURL('image/jpeg', 0.95);

    const imgWidth = 180;
    const imgHeight = (renderCanvas.height / renderCanvas.width) * imgWidth;
    doc.addImage(imgDataGame, 'JPEG', (pageWidth - imgWidth) / 2, 38, imgWidth, imgHeight);

    // Pie de página
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Hay ${gameData.solutions.length} parejas que suman ${gameData.targetSum}. | Nivel: ${difficultyLabel}`, pageWidth / 2, 38 + imgHeight + 10, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("FunnyMathPlanet - Juegos y Retos de Agilidad Mental | www.funnymathplanet.com", pageWidth / 2, pageHeight - 12, { align: 'center' });

    // =========================================================================
    // PÁGINA 2: HOJA DE SOLUCIÓN OFICIAL
    // =========================================================================
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(6, 78, 59);
    doc.text("Solución Oficial - Sumas Emparejadas", pageWidth / 2, 22, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(`Se encontraron ${gameData.solutions.length} pares que suman exactamente ${gameData.targetSum}`, pageWidth / 2, 29, { align: 'center' });

    // Renderizar tablero con solución
    ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    this.drawBoardToCanvas(ctx, renderCanvas.width, renderCanvas.height, gameData, true);
    const imgDataSol = renderCanvas.toDataURL('image/jpeg', 0.95);

    doc.addImage(imgDataSol, 'JPEG', (pageWidth - imgWidth) / 2, 38, imgWidth, imgHeight);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("FunnyMathPlanet - www.funnymathplanet.com", pageWidth / 2, pageHeight - 12, { align: 'center' });

    // Descarga del archivo
    doc.save(`sumas_emparejadas_obj${gameData.targetSum}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * Dibuja el tablero en un contexto 2D de Canvas (utilizado tanto para PDF como para la pestaña de Solución)
   */
  static drawBoardToCanvas(ctx, width, height, gameData, isSolution = false) {
    const grid = gameData.grid;

    // Clonar cuadrícula para renderizar a tamaño del PDF
    const renderGrid = new HexGrid(grid.cols, grid.rows, grid.shape);
    renderGrid.fitToDimensions(width, height, 40);

    // Mapear valores numéricos
    for (let i = 0; i < grid.hexList.length; i++) {
      renderGrid.hexList[i].value = grid.hexList[i].value;
    }

    // Fondo blanco limpio
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Paleta de colores para pares solución
    const solutionColors = [
      { bg: "rgba(16, 185, 129, 0.25)", border: "#059669", line: "#10b981" },
      { bg: "rgba(14, 165, 233, 0.25)", border: "#0284c7", line: "#38bdf8" },
      { bg: "rgba(168, 85, 247, 0.25)", border: "#7c3aed", line: "#c084fc" },
      { bg: "rgba(245, 158, 11, 0.25)", border: "#d97706", line: "#fbbf24" },
      { bg: "rgba(236, 72, 153, 0.25)", border: "#db2777", line: "#f472b6" },
      { bg: "rgba(20, 184, 166, 0.25)", border: "#0d9488", line: "#2dd4bf" },
      { bg: "rgba(234, 88, 12, 0.25)", border: "#c2410c", line: "#fb923c" }
    ];

    const pairedCellMap = new Map();
    if (isSolution && gameData.solutions) {
      gameData.solutions.forEach((sol, idx) => {
        const col = solutionColors[idx % solutionColors.length];
        pairedCellMap.set(sol.hexA.id, col);
        pairedCellMap.set(sol.hexB.id, col);
      });
    }

    // 1. Dibujar cada hexágono
    for (const hex of renderGrid.hexList) {
      const corners = renderGrid.getHexCorners(hex);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      if (isSolution && pairedCellMap.has(hex.id)) {
        const col = pairedCellMap.get(hex.id);
        ctx.fillStyle = col.bg;
        ctx.strokeStyle = col.border;
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Números
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSolution && pairedCellMap.has(hex.id) ? "#0f172a" : "#334155";
      ctx.font = isSolution && pairedCellMap.has(hex.id) ? "bold 20px Inter, sans-serif" : "bold 18px Inter, sans-serif";

      const valText = (hex.value !== null && hex.value !== undefined) ? hex.value.toString() : "0";
      ctx.fillText(valText, hex.x, hex.y);
    }

    // 2. Si es solución, dibujar las líneas conectoras
    if (isSolution && gameData.solutions) {
      gameData.solutions.forEach((sol, idx) => {
        const hexA = renderGrid.hexList.find(h => h.id === sol.hexA.id);
        const hexB = renderGrid.hexList.find(h => h.id === sol.hexB.id);
        if (hexA && hexB) {
          const col = solutionColors[idx % solutionColors.length];
          ctx.beginPath();
          ctx.strokeStyle = col.line;
          ctx.lineWidth = 4.5;
          ctx.lineCap = "round";
          ctx.moveTo(hexA.x, hexA.y);
          ctx.lineTo(hexB.x, hexB.y);
          ctx.stroke();
        }
      });
    }
  }
}

window.PairsPDFExporter = PairsPDFExporter;
