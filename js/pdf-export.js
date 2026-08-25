/**
 * =============================================================================
 * PDF EXPORT - Generación de Hojas de Ejercicios Imprimibles (A4) en el Navegador
 * Usa jsPDF para crear el PDF en el cliente sin servidor
 * =============================================================================
 */

class PDFExporter {
  /**
   * Genera y descarga un PDF con el laberinto y su solución.
   * @param {Object} gameData Datos del juego generado
   * @param {string} difficulty Nombre de la dificultad
   */
  static exportPDF(gameData, difficulty = "Medio") {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("La biblioteca jsPDF se está cargando. Por favor, inténtalo de nuevo en unos segundos.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // -------------------------------------------------------------------------
    // PÁGINA 1: EL LABERINTO PARA JUGAR
    // -------------------------------------------------------------------------
    this.renderHeader(doc, "Laberinto de Sumas", `Objetivo por tramo: ${gameData.targetSum}  |  Dificultad: ${difficulty}`);

    // Renderizar gráfico del juego a un canvas temporal
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 1200;
    tempCanvas.height = 1200;
    const ctx = tempCanvas.getContext("2d");

    // Dibujar tablero en modo juego
    this.drawBoardToCanvas(ctx, tempCanvas.width, tempCanvas.height, gameData, false);

    const imgData1 = tempCanvas.toDataURL("image/png");
    doc.addImage(imgData1, "PNG", 15, 45, pageWidth - 30, pageWidth - 30);

    // Instrucciones al pie
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Instrucciones: Conecta INICIO con FINAL pasando por los Puntos Maestros (azul).", pageWidth / 2, pageHeight - 25, { align: "center" });
    doc.text(`Entre dos Puntos Maestros la suma de los hexágonos intermedios debe ser exactamente ${gameData.targetSum}.`, pageWidth / 2, pageHeight - 20, { align: "center" });
    doc.setFontSize(8);
    doc.text("FunnyMathPlanet © Material educativo para cálculo mental", pageWidth / 2, pageHeight - 12, { align: "center" });

    // -------------------------------------------------------------------------
    // PÁGINA 2: SOLUCIÓN OFICIAL
    // -------------------------------------------------------------------------
    doc.addPage();
    this.renderHeader(doc, "Solución Oficial - Laberinto de Sumas", `Objetivo: ${gameData.targetSum}  |  Longitud del camino: ${gameData.path.length} hexágonos`);

    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    this.drawBoardToCanvas(ctx, tempCanvas.width, tempCanvas.height, gameData, true);

    const imgData2 = tempCanvas.toDataURL("image/png");
    doc.addImage(imgData2, "PNG", 15, 45, pageWidth - 30, pageWidth - 30);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Solución encontrada con ${gameData.masterHexes.length} Puntos Maestros.`, pageWidth / 2, pageHeight - 20, { align: "center" });
    doc.setFontSize(8);
    doc.text("FunnyMathPlanet © Material educativo para cálculo mental", pageWidth / 2, pageHeight - 12, { align: "center" });

    // Descargar archivo
    const today = new Date().toISOString().slice(0, 10);
    doc.save(`laberinto_sumas_${today}.pdf`);
  }

  static renderHeader(doc, title, subtitle) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(6, 95, 70); // #065f46
    doc.text(title, pageWidth / 2, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105); // #475569
    doc.text(subtitle, pageWidth / 2, 30, { align: "center" });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(20, 36, pageWidth - 20, 36);
  }

  static drawBoardToCanvas(ctx, width, height, gameData, isSolution = false) {
    const grid = gameData.grid;
    
    // Clonar cuadrícula para renderizar a tamaño del PDF
    const renderGrid = new HexGrid(grid.cols, grid.rows, grid.shape);
    renderGrid.fitToDimensions(width, height, 40);

    // Mapear valores del juego
    for (let i = 0; i < grid.hexList.length; i++) {
      const orig = grid.hexList[i];
      const target = renderGrid.hexList[i];
      target.value = orig.value;
      target.isMaster = orig.isMaster;
      target.isStart = orig.isStart;
      target.isEnd = orig.isEnd;
      target.isPath = orig.isPath;
      target.masterIndex = orig.masterIndex;
    }

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Dibujar cada hexágono
    for (const hex of renderGrid.hexList) {
      const corners = renderGrid.getHexCorners(hex);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Colores de fondo y borde
      if (isSolution && hex.isPath && !hex.isMaster) {
        ctx.fillStyle = "#fef9c3"; // Amarillo suave
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 2.5;
      } else if (hex.isStart) {
        ctx.fillStyle = "#86efac"; // Verde claro
        ctx.strokeStyle = "#15803d";
        ctx.lineWidth = 3;
      } else if (hex.isEnd) {
        ctx.fillStyle = "#fda4af"; // Rosa claro
        ctx.strokeStyle = "#be123c";
        ctx.lineWidth = 3;
      } else if (hex.isMaster) {
        ctx.fillStyle = "#bae6fd"; // Azul claro
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.2;
      }

      ctx.fill();
      ctx.stroke();

      // Números y rótulos
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (hex.isStart) {
        ctx.fillStyle = "#15803d";
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.fillText("INICIO", hex.x, hex.y);
      } else if (hex.isEnd) {
        ctx.fillStyle = "#be123c";
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.fillText("FINAL", hex.x, hex.y);
      } else if (hex.isMaster) {
        // Círculo pequeño decorativo en el centro
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.arc(hex.x, hex.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isSolution && hex.isPath ? "#0f172a" : "#334155";
        ctx.font = isSolution && hex.isPath ? "bold 20px Inter, sans-serif" : "bold 18px Inter, sans-serif";
        const valText = (hex.value !== null && hex.value !== undefined) ? hex.value.toString() : "0";
        ctx.fillText(valText, hex.x, hex.y);
      }
    }

    // Si es la solución, dibujar la línea roja de camino
    if (isSolution && gameData.path.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);

      for (let i = 0; i < gameData.path.length; i++) {
        const hId = gameData.path[i].id;
        const targetHex = renderGrid.hexList.find(h => h.id === hId);
        if (targetHex) {
          if (i === 0) ctx.moveTo(targetHex.x, targetHex.y);
          else ctx.lineTo(targetHex.x, targetHex.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

window.PDFExporter = PDFExporter;
