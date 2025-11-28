import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";

export interface AnalysisFilters {
  messageType: {
    whatsapp: boolean;
    direct: boolean;
  };
  modality: {
    text: boolean;
    audio: boolean;
    video: boolean;
    image: boolean;
  };
  result: {
    fake: boolean;
    true: boolean;
    misleading: boolean;
    unknown: boolean;
  };
}

interface AnalysisSidebarProps {
  filters: AnalysisFilters;
  onFilterChange: (filters: AnalysisFilters) => void;
}

export const AnalysisSidebar = ({ filters, onFilterChange }: AnalysisSidebarProps) => {
  const handleMessageTypeChange = (type: 'whatsapp' | 'direct', checked: boolean) => {
    onFilterChange({
      ...filters,
      messageType: {
        ...filters.messageType,
        [type]: checked,
      },
    });
  };

  const handleModalityChange = (modality: 'text' | 'audio' | 'video' | 'image', checked: boolean) => {
    onFilterChange({
      ...filters,
      modality: {
        ...filters.modality,
        [modality]: checked,
      },
    });
  };

  const handleResultChange = (result: 'fake' | 'true' | 'misleading' | 'unknown', checked: boolean) => {
    onFilterChange({
      ...filters,
      result: {
        ...filters.result,
        [result]: checked,
      },
    });
  };

  return (
    <Card className="h-fit sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tipo de Mensagem</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="whatsapp"
                checked={filters.messageType.whatsapp}
                onCheckedChange={(checked) => handleMessageTypeChange('whatsapp', checked as boolean)}
              />
              <label htmlFor="whatsapp" className="text-sm cursor-pointer">
                Grupo do WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="direct"
                checked={filters.messageType.direct}
                onCheckedChange={(checked) => handleMessageTypeChange('direct', checked as boolean)}
              />
              <label htmlFor="direct" className="text-sm cursor-pointer">
                Mensagem Direta
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Modalidade</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="text"
                checked={filters.modality.text}
                onCheckedChange={(checked) => handleModalityChange('text', checked as boolean)}
              />
              <label htmlFor="text" className="text-sm cursor-pointer">
                Texto
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="audio"
                checked={filters.modality.audio}
                onCheckedChange={(checked) => handleModalityChange('audio', checked as boolean)}
              />
              <label htmlFor="audio" className="text-sm cursor-pointer">
                Áudio
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="video"
                checked={filters.modality.video}
                onCheckedChange={(checked) => handleModalityChange('video', checked as boolean)}
              />
              <label htmlFor="video" className="text-sm cursor-pointer">
                Vídeo
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="image"
                checked={filters.modality.image}
                onCheckedChange={(checked) => handleModalityChange('image', checked as boolean)}
              />
              <label htmlFor="image" className="text-sm cursor-pointer">
                Imagem
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Resultado</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fake"
                checked={filters.result.fake}
                onCheckedChange={(checked) => handleResultChange('fake', checked as boolean)}
              />
              <label htmlFor="fake" className="text-sm cursor-pointer">
                Falso
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="true"
                checked={filters.result.true}
                onCheckedChange={(checked) => handleResultChange('true', checked as boolean)}
              />
              <label htmlFor="true" className="text-sm cursor-pointer">
                Verdadeiro
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="misleading"
                checked={filters.result.misleading}
                onCheckedChange={(checked) => handleResultChange('misleading', checked as boolean)}
              />
              <label htmlFor="misleading" className="text-sm cursor-pointer">
                Enganoso
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="unknown"
                checked={filters.result.unknown}
                onCheckedChange={(checked) => handleResultChange('unknown', checked as boolean)}
              />
              <label htmlFor="unknown" className="text-sm cursor-pointer">
                Desconhecido
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
