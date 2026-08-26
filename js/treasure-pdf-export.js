/**
 * =============================================================================
 * TREASURE PDF EXPORTER - Generador de Documentos PDF A4 para HexaTreasure
 * Soporta escala de terreno topográfica, pistas según nivel y solución gráfica
 * =============================================================================
 */

class TreasurePDFExporter {
  /**
   * Exporta un PDF A4 de 2 páginas (Mapa del Tesoro con Pistas + Solución Oficial)
   */
  static async exportPDF(gameData, difficultyLabel = "Marinero (Medio)") {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("La librería jsPDF no está disponible. Comprueba tu conexión a internet.");
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

    // Canvas virtual de alta resolución
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1400;
    renderCanvas.height = 1050;
    const ctx = renderCanvas.getContext('2d');

    // =========================================================================
    // PÁGINA 1: MAPA DE LA ISLA Y CUADRO DE PISTAS
    // =========================================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(180, 83, 9); // Ámbar oscuro
    doc.text("Busca el Tesoro: La Isla Matemática", pageWidth / 2, 20, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Descubre la casilla del tesoro triangulando las sumas mínimas desde cada baliza.", pageWidth / 2, 26, { align: 'center' });

    // Renderizar tablero sin resolver
    this.drawBoardToCanvas(ctx, renderCanvas.width, renderCanvas.height, gameData, false);
    const imgDataGame = renderCanvas.toDataURL('image/jpeg', 0.95);

    const imgWidth = 175;
    const imgHeight = (renderCanvas.height / renderCanvas.width) * imgWidth;
    doc.addImage(imgDataGame, 'JPEG', (pageWidth - imgWidth) / 2, 32, imgWidth, imgHeight);

    // Cuadro de Pistas
    const boxY = 32 + imgHeight + 6;
    doc.setFillColor(254, 243, 199); // Ámbar muy suave
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(18, boxY, pageWidth - 36, 48, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(120, 53, 15);
    doc.text("📜 PISTAS DE TRIANGULACIÓN (Ruta de suma mínima más corta):", 24, boxY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    let clueOffset = 0;
    gameData.clues.forEach((clue) => {
      const stepText = gameData.showSteps ? ` (${clue.steps} pasos de distancia)` : ` (camino mínimo)`;
      const poiText = `${clue.poi.icon} ${clue.poi.name}: El tesoro se encuentra a una ruta de SUMA ${clue.sum}${stepText}.`;
      doc.text(poiText, 24, boxY + 16 + clueOffset);
      clueOffset += 7;
    });

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Nivel: ${difficultyLabel} | FunnyMathPlanet - Retos de Deducción Matemática`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // =========================================================================
    // PÁGINA 2: SOLUCIÓN OFICIAL
    // =========================================================================
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(180, 83, 9);
    doc.text("Solución Oficial - Ubicación del Tesoro", pageWidth / 2, 20, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Trayectorias mínimas verificadas desde cada punto de referencia hacia el cofre.", pageWidth / 2, 26, { align: 'center' });

    ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    this.drawBoardToCanvas(ctx, renderCanvas.width, renderCanvas.height, gameData, true);
    const imgDataSol = renderCanvas.toDataURL('image/jpeg', 0.95);

    doc.addImage(imgDataSol, 'JPEG', (pageWidth - imgWidth) / 2, 32, imgWidth, imgHeight);

    // Detalle de desglose matemático
    const solBoxY = 32 + imgHeight + 6;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(18, solBoxY, pageWidth - 36, 48, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(22, 101, 52);
    doc.text("💎 DESGLOSE DE SOLUCIÓN EXACTA:", 24, solBoxY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(21, 128, 61);

    let solOffset = 0;
    gameData.clues.forEach((clue) => {
      const pathValues = clue.path.map(h => h.value).join(" + ");
      const txt = `${clue.poi.icon} ${clue.poi.name} ➔ Tesoro: ${pathValues} = ${clue.sum} (${clue.steps} pasos)`;
      doc.text(txt, 24, solBoxY + 16 + solOffset);
      solOffset += 7;
    });

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("FunnyMathPlanet - www.funnymathplanet.com", pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`busca_el_tesoro_${difficultyLabel.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * Dibuja el tablero en un contexto 2D de Canvas con cotas de terreno
   */
  static drawBoardToCanvas(ctx, width, height, gameData, isSolution = false) {
    const grid = gameData.grid;

    // Clonar cuadrícula a escala de renderizado
    const renderGrid = new HexGrid(grid.cols, grid.rows, grid.shape);
    renderGrid.fitToDimensions(width, height, 40);

    for (let i = 0; i < grid.hexList.length; i++) {
      const src = grid.hexList[i];
      const dst = renderGrid.hexList[i];
      dst.value = src.value;
      dst.isPOI = src.isPOI;
      dst.poiData = src.poiData;
      dst.isTreasure = src.isTreasure;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 1. Dibujar hexágonos con colores topográficos
    for (const hex of renderGrid.hexList) {
      const corners = renderGrid.getHexCorners(hex);
      const terrain = TreasureEngine.getTerrainStyle(hex.value);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      if (hex.isPOI) {
        ctx.fillStyle = hex.poiData.bg;
        ctx.strokeStyle = hex.poiData.border;
        ctx.lineWidth = 2.5;
      } else if (isSolution && hex.id === gameData.treasureHex.id) {
        ctx.fillStyle = "#fef08a";
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 3.5;
      } else {
        ctx.fillStyle = terrain.bg;
        ctx.strokeStyle = terrain.border;
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Iconos o Números
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (hex.isPOI) {
        ctx.font = `${Math.round(renderGrid.size * 0.85)}px sans-serif`;
        ctx.fillText(hex.poiData.icon, hex.x, hex.y);
      } else if (isSolution && hex.id === gameData.treasureHex.id) {
        ctx.font = `${Math.round(renderGrid.size * 0.85)}px sans-serif`;
        ctx.fillText("💎", hex.x, hex.y);
      } else if (hex.value === 0) {
        ctx.font = `bold ${Math.max(14, Math.round(renderGrid.size * 0.48))}px Inter, sans-serif`;
        ctx.fillStyle = "#0284c7";
        ctx.fillText("0", hex.x, hex.y);
      } else {
        ctx.fillStyle = terrain.text;
        ctx.font = `bold ${Math.max(16, Math.round(renderGrid.size * 0.52))}px Inter, sans-serif`;
        ctx.fillText(hex.value.toString(), hex.x, hex.y);
      }
    }

    // 2. Si es solución, dibujar las trayectorias coloreadas hacia el tesoro
    if (isSolution && gameData.clues) {
      const treasureHexDst = renderGrid.hexList.find(h => h.id === gameData.treasureHex.id);

      gameData.clues.forEach((clue) => {
        const poiDst = renderGrid.hexList.find(h => h.id === clue.poi.id);
        if (!poiDst || !treasureHexDst) return;

        ctx.beginPath();
        ctx.strokeStyle = clue.poi.color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.moveTo(poiDst.x, poiDst.y);
        for (const pathHex of clue.path) {
          const matchedHex = renderGrid.hexList.find(h => h.id === pathHex.id);
          if (matchedHex) {
            ctx.lineTo(matchedHex.x, matchedHex.y);
          }
        }
        ctx.stroke();
      });
    }
  }
}

window.TreasurePDFExporter = TreasurePDFExporter;
