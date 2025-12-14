import { Calendar, Filter, Search, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { AnalysisFilters } from "@/components/analytics/AnalysisSidebar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type DateFilterMode = "last24h" | "last7d" | "last30d" | "custom";

export interface DateFilterValue {
  mode: DateFilterMode;
  startDate?: string; // YYYY-MM-DD (apenas para custom)
  endDate?: string; // YYYY-MM-DD (apenas para custom)
}

interface FilterSectionProps {
  filters?: AnalysisFilters;
  onFilterChange?: (filters: AnalysisFilters) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  dateFilter?: DateFilterValue;
  onDateFilterChange?: (value: DateFilterValue) => void;
}

export const FilterSection = ({
  filters,
  onFilterChange,
  searchTerm = "",
  onSearchChange,
  dateFilter,
  onDateFilterChange,
}: FilterSectionProps) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const parseYmdToDate = (ymd?: string): Date | undefined => {
    if (!ymd) return undefined;
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    // Mantém em meia-noite local para comparação/seleção por dia.
    return new Date(y, m - 1, d);
  };

  const formatDateDisplay = (ymd?: string) => {
    const dt = parseYmdToDate(ymd);
    if (!dt) return "";
    return format(dt, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateYmd = (dt?: Date) => {
    if (!dt) return "";
    return format(dt, "yyyy-MM-dd");
  };

  const handlePercentageChange = (field: 'minTruthScore' | 'maxTruthScore' | 'minFakeScore' | 'maxFakeScore' | 'minUnverifiedScore' | 'maxUnverifiedScore', value: number) => {
    if (filters && onFilterChange) {
      onFilterChange({
        ...filters,
        percentage: {
          ...filters.percentage,
          [field]: value,
        },
      });
    }
  };

  const handleModalityChange = (modality: 'text' | 'audio' | 'video' | 'image', checked: boolean) => {
    if (filters && onFilterChange) {
      onFilterChange({
        ...filters,
        modality: {
          ...filters.modality,
          [modality]: checked,
        },
      });
    }
  };


  const handleClearFilters = () => {
    if (onFilterChange) {
      onFilterChange({
        modality: { text: true, audio: true, video: true, image: true },
        percentage: { 
          minTruthScore: 0, maxTruthScore: 100, 
          minFakeScore: 0, maxFakeScore: 100,
          minUnverifiedScore: 0, maxUnverifiedScore: 100 
        },
      });
    }
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Filtros de Pesquisa</h2>
      </div>

      {/* Busca e Botão de Filtros Avançados */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="search">Buscar por conteúdo</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Digite palavras-chave, tópico ou ID..."
              className="w-full pl-10"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        </div>

        {/* Botão Expandir Filtros Avançados */}
        {filters && (
          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2"
          >
            {showAdvancedFilters ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar Filtros
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Mostrar Filtros
              </>
            )}
          </Button>
        )}
      </div>

      {/* Filtro por Data */}
      {dateFilter && onDateFilterChange && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">Período</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="dateMode">
                Seleção
              </Label>
              <Select
                value={dateFilter.mode}
                onValueChange={(value) =>
                  onDateFilterChange({
                    ...dateFilter,
                    mode: value as DateFilterMode,
                  })
                }
              >
                <SelectTrigger id="dateMode">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last24h">Últimas 24h</SelectItem>
                  <SelectItem value="last7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Data personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter.mode === "custom" && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm">
                    Data de início
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="startDate"
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal group"
                      >
                        <span
                          className={
                            dateFilter.startDate
                              ? "group-hover:text-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          }
                        >
                          {dateFilter.startDate ? formatDateDisplay(dateFilter.startDate) : "Selecionar"}
                        </span>
                        <Calendar className="h-4 w-4 text-muted-foreground opacity-70 group-hover:text-foreground group-hover:opacity-100" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={parseYmdToDate(dateFilter.startDate)}
                        onSelect={(selected) =>
                          onDateFilterChange({
                            ...dateFilter,
                            startDate: selected ? formatDateYmd(selected) : undefined,
                          })
                        }
                        disabled={(day) => {
                          const end = parseYmdToDate(dateFilter.endDate);
                          return end ? day > end : false;
                        }}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm">
                    Data de fim
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="endDate"
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal group"
                      >
                        <span
                          className={
                            dateFilter.endDate
                              ? "group-hover:text-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          }
                        >
                          {dateFilter.endDate ? formatDateDisplay(dateFilter.endDate) : "Selecionar"}
                        </span>
                        <Calendar className="h-4 w-4 text-muted-foreground opacity-70 group-hover:text-foreground group-hover:opacity-100" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={parseYmdToDate(dateFilter.endDate)}
                        onSelect={(selected) =>
                          onDateFilterChange({
                            ...dateFilter,
                            endDate: selected ? formatDateYmd(selected) : undefined,
                          })
                        }
                        disabled={(day) => {
                          const start = parseYmdToDate(dateFilter.startDate);
                          return start ? day < start : false;
                        }}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtros em Grid */}
      {filters && showAdvancedFilters && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Modalidade */}
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

          </div>

          {/* Filtros por Porcentagem */}
          <div className="border-t pt-6">
            <Label className="text-base font-semibold mb-4 block">Filtrar por Porcentagem</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Porcentagem de Afirmações Verdadeiras */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Afirmações Verdadeiras (%)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="minTruth" className="text-xs text-muted-foreground">Mínimo</Label>
                    <Input
                      id="minTruth"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.minTruthScore}
                      onChange={(e) => handlePercentageChange('minTruthScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxTruth" className="text-xs text-muted-foreground">Máximo</Label>
                    <Input
                      id="maxTruth"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.maxTruthScore}
                      onChange={(e) => handlePercentageChange('maxTruthScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Porcentagem de Afirmações Falsas */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Afirmações Falsas (%)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="minFake" className="text-xs text-muted-foreground">Mínimo</Label>
                    <Input
                      id="minFake"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.minFakeScore}
                      onChange={(e) => handlePercentageChange('minFakeScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxFake" className="text-xs text-muted-foreground">Máximo</Label>
                    <Input
                      id="maxFake"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.maxFakeScore}
                      onChange={(e) => handlePercentageChange('maxFakeScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Porcentagem de Afirmações com Fontes Inverificáveis */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Fontes Inverificáveis (%)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="minUnverified" className="text-xs text-muted-foreground">Mínimo</Label>
                    <Input
                      id="minUnverified"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.minUnverifiedScore}
                      onChange={(e) => handlePercentageChange('minUnverifiedScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxUnverified" className="text-xs text-muted-foreground">Máximo</Label>
                    <Input
                      id="maxUnverified"
                      type="number"
                      min="0"
                      max="100"
                      value={filters.percentage.maxUnverifiedScore}
                      onChange={(e) => handlePercentageChange('maxUnverifiedScore', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botões */}
      {filters && showAdvancedFilters && (
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClearFilters}>
            Limpar Filtros
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Dados
          </Button>
        </div>
      )}
    </Card>
  );
};
