import type { Analysis } from '@/types/analysis';

export interface AnalysisWithFileId extends Analysis {
  fileId: string;
}

/**
 * Carrega todas as análises disponíveis dos arquivos JSON
 * @returns Promise com array de análises ordenadas por data (mais recente primeiro)
 *
 * TODO: Migrar para usar a API do backend
 * Atualmente usa JSONs mockados. No futuro, deve usar:
 * GET http://localhost:8000/analises (endpoint que retorna lista de todas as análises)
 */
export async function loadAllAnalyses(): Promise<AnalysisWithFileId[]> {
  const analyses: AnalysisWithFileId[] = [];

  // TEMPORÁRIO: Lista hardcoded de análises mockadas
  // Em produção, isso virá de um endpoint da API (GET /analises)
  const analysisIds = ['001', '002', '003'];

  for (const id of analysisIds) {
    try {
      const response = await fetch(`/analises/${id}.json`);
      if (response.ok) {
        const data: Analysis = await response.json();
        // Adiciona o ID do arquivo para usar nas rotas
        analyses.push({ ...data, fileId: id });
      }
    } catch (error) {
      console.error(`Erro ao carregar análise ${id}:`, error);
    }
  }

  // Ordena por data mais recente primeiro
  return analyses.sort((a, b) => {
    return new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime();
  });
}

/**
 * Obtém o status geral de uma análise baseado no overall_verdict
 */
export function getAnalysisStatus(analysis: Analysis): 'true' | 'false' | 'unverifiable' {
  const verdict = analysis.overall_verdict.toUpperCase();

  if (verdict === 'VERDADEIRO') return 'true';
  if (verdict === 'FALSO') return 'false';

  return 'unverifiable';
}

/**
 * Formata a data para exibição
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
