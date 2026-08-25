/**
 * =============================================================================
 * RANKING - Gestor de Persistencia del Salón de la Fama (Top 10)
 * Almacenamiento local seguro en localStorage para Laberinto y Sumas Emparejadas
 * =============================================================================
 */

class RankingManager {
  constructor(storageKey = 'fmp_ranking_laberinto_v3', defaultEntries = null) {
    this.storageKey = storageKey;
    this.defaultEntries = defaultEntries || [
      { posicion: 1, nombre: "MathMaster", puntos: 14250, dificultad: "Experto", objetivo: 24, celdas: 340, hitos: 7, tiempo: "02:15", tiempoSeg: 135, fecha: "2026-08-20" },
      { posicion: 2, nombre: "HexaPro", puntos: 11800, dificultad: "Difícil", objetivo: 18, celdas: 200, hitos: 5, tiempo: "01:50", tiempoSeg: 110, fecha: "2026-08-21" },
      { posicion: 3, nombre: "Euler_FMP", puntos: 9350, dificultad: "Medio", objetivo: 14, celdas: 120, hitos: 4, tiempo: "01:32", tiempoSeg: 92, fecha: "2026-08-22" },
      { posicion: 4, nombre: "SumaGenius", puntos: 7800, dificultad: "Medio", objetivo: 14, celdas: 120, hitos: 4, tiempo: "02:10", tiempoSeg: 130, fecha: "2026-08-23" },
      { posicion: 5, nombre: "Ada_Lovelace", puntos: 6200, dificultad: "Fácil", objetivo: 10, celdas: 45, hitos: 3, tiempo: "00:58", tiempoSeg: 58, fecha: "2026-08-24" }
    ];
  }

  // Carga las puntuaciones guardadas o los valores por defecto
  getScores() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage:", e);
    }
    return [...this.defaultEntries];
  }

  // Verifica si una puntuación califica para entrar en el Top 10
  qualifies(points) {
    const scores = this.getScores();
    if (scores.length < 10) return true;
    const lowest = Math.min(...scores.map(s => s.puntos));
    return points > lowest;
  }

  // Guarda un nuevo récord y actualiza el Top 10
  addScore({ nombre, puntos, dificultad, objetivo, celdas, hitos, tiempoSeg }) {
    const scores = this.getScores();
    
    let cleanName = (nombre || "Jugador").trim().substring(0, 18);
    if (!cleanName) cleanName = "Jugador";

    const mins = Math.floor(tiempoSeg / 60);
    const secs = tiempoSeg % 60;
    const tiempoFmt = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const now = new Date();
    const fechaFmt = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newEntry = {
      posicion: 0,
      nombre: cleanName,
      puntos: Math.round(puntos),
      dificultad: dificultad || "Medio",
      objetivo: Number(objetivo) || 14,
      celdas: Number(celdas) || 100,
      hitos: Number(hitos) || 4,
      tiempo: tiempoFmt,
      tiempoSeg: Number(tiempoSeg),
      fecha: fechaFmt
    };

    scores.push(newEntry);
    
    // Ordenar: Mayor puntuación primero; a igualdad, menor tiempo
    scores.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return a.tiempoSeg - b.tiempoSeg;
    });

    const top10 = scores.slice(0, 10);
    top10.forEach((item, idx) => {
      item.posicion = idx + 1;
    });

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(top10));
    } catch (e) {
      console.error("Error al guardar en localStorage:", e);
    }

    return top10;
  }

  // Restablece el ranking a los valores predeterminados
  reset() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.defaultEntries));
    } catch (e) {
      console.warn("No se pudo restablecer localStorage:", e);
    }
    return [...this.defaultEntries];
  }
}

// Instancias globales para cada juego
window.RankingManager = RankingManager;
window.rankingManager = new RankingManager('fmp_ranking_laberinto_v3');

window.pairsRankingManager = new RankingManager('fmp_ranking_pairs_v1', [
  { posicion: 1, nombre: "PairMaster", puntos: 13800, dificultad: "Experto (Rombo)", objetivo: 24, celdas: 160, hitos: 10, tiempo: "01:30", tiempoSeg: 90, fecha: "2026-08-21" },
  { posicion: 2, nombre: "HexFinder", puntos: 10500, dificultad: "Difícil (Círculo)", objetivo: 18, celdas: 120, hitos: 8, tiempo: "01:45", tiempoSeg: 105, fecha: "2026-08-22" },
  { posicion: 3, nombre: "MathHero", puntos: 8200, dificultad: "Medio", objetivo: 14, celdas: 64, hitos: 6, tiempo: "01:15", tiempoSeg: 75, fecha: "2026-08-23" },
  { posicion: 4, nombre: "Gauss_Jr", puntos: 6900, dificultad: "Medio", objetivo: 14, celdas: 64, hitos: 6, tiempo: "01:50", tiempoSeg: 110, fecha: "2026-08-24" },
  { posicion: 5, nombre: "Clara_Math", puntos: 5100, dificultad: "Fácil", objetivo: 10, celdas: 36, hitos: 4, tiempo: "00:48", tiempoSeg: 48, fecha: "2026-08-25" }
]);

window.treasureRankingManager = new RankingManager('fmp_ranking_treasure_v1', [
  { posicion: 1, nombre: "BarbaPlata", puntos: 15400, dificultad: "Corsario (Experto)", objetivo: "4 Balizas", celdas: 160, hitos: 1, tiempo: "01:12", tiempoSeg: 72, fecha: "2026-08-22" },
  { posicion: 2, nombre: "IslaSeeker", puntos: 12200, dificultad: "Capitán (Difícil)", objetivo: "4 Balizas", celdas: 120, hitos: 1, tiempo: "01:35", tiempoSeg: 95, fecha: "2026-08-23" },
  { posicion: 3, nombre: "JackSparrow", puntos: 9800, dificultad: "Marinero (Medio)", objetivo: "3 Balizas", celdas: 75, hitos: 1, tiempo: "01:05", tiempoSeg: 65, fecha: "2026-08-24" },
  { posicion: 4, nombre: "DeductionPro", puntos: 7900, dificultad: "Marinero (Medio)", objetivo: "3 Balizas", celdas: 75, hitos: 2, tiempo: "01:50", tiempoSeg: 110, fecha: "2026-08-24" },
  { posicion: 5, nombre: "Grumete_Sam", puntos: 5600, dificultad: "Grumete (Fácil)", objetivo: "3 Balizas", celdas: 45, hitos: 1, tiempo: "00:42", tiempoSeg: 42, fecha: "2026-08-25" }
]);
