import { Calendar, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const FilterSection = () => {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Filtros de Pesquisa</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="search">Buscar por conteúdo</Label>
          <Input
            id="search"
            placeholder="Digite palavras-chave..."
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status da Verificação</Label>
          <Select>
            <SelectTrigger id="status">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Verdadeiro</SelectItem>
              <SelectItem value="false">Falso</SelectItem>
              <SelectItem value="misleading">Enganoso</SelectItem>
              <SelectItem value="unverifiable">Não Verificável</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-start">Data Inicial</Label>
          <div className="relative">
            <Input
              id="date-start"
              type="date"
              className="w-full"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-end">Data Final</Label>
          <div className="relative">
            <Input
              id="date-end"
              type="date"
              className="w-full"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="gap-2">
          <Filter className="h-4 w-4" />
          Aplicar Filtros
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Dados
        </Button>
        <Button variant="ghost">
          Limpar Filtros
        </Button>
      </div>
    </Card>
  );
};
