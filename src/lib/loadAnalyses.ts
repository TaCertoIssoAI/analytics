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
  const analysisIds = ['001', '002'];

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
    return new Date(b.Date).getTime() - new Date(a.Date).getTime();
  });
}

/**
 * Obtém o status geral de uma análise baseado nos resultados das claims
 */
export function getAnalysisStatus(analysis: Analysis): 'true' | 'false' | 'misleading' {
  const results = Object.values(analysis.ResponseByClaim).map(claim => claim.Result);

  // Se todas são verdadeiras, retorna true
  if (results.every(r => r === 'True')) return 'true';

  // Se alguma é fake, retorna false
  if (results.some(r => r === 'Fake')) return 'false';

  // Se alguma é misleading ou unknown, retorna misleading
  if (results.some(r => r === 'Misleading' || r === 'Unknown')) return 'misleading';

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
