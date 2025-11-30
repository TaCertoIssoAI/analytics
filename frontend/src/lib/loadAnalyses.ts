import type { Analysis } from '@/types/analysis';

export interface AnalysisWithFileId extends Analysis {
  fileId: string;
}

/**
 * Carrega todas as análises disponíveis dos arquivos JSON
 * @returns Promise com array de análises ordenadas por data (mais recente primeiro)
 */
export async function loadAllAnalyses(): Promise<AnalysisWithFileId[]> {
  const analyses: AnalysisWithFileId[] = [];

  // Lista de IDs de análises conhecidas (você pode expandir essa lista conforme adiciona mais arquivos)
  // Em produção, isso poderia vir de um endpoint da API
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
export function getAnalysisStatus(analysis: Analysis): 'true' | 'false' | 'misleading' {
  const verdict = analysis.overall_verdict.toUpperCase();

  if (verdict === 'VERDADEIRO') return 'true';
  if (verdict === 'FALSO') return 'false';
  if (verdict === 'ENGANOSO') return 'misleading';

  return 'false';
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
