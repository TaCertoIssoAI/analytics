import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";

export const AnalysisSidebar = () => {
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
              <Checkbox id="whatsapp" />
              <label htmlFor="whatsapp" className="text-sm cursor-pointer">
                Grupo do WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="direct" />
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
              <Checkbox id="text" />
              <label htmlFor="text" className="text-sm cursor-pointer">
                Texto
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="audio" />
              <label htmlFor="audio" className="text-sm cursor-pointer">
                Áudio
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="video" />
              <label htmlFor="video" className="text-sm cursor-pointer">
                Vídeo
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="image" />
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
              <Checkbox id="fake" />
              <label htmlFor="fake" className="text-sm cursor-pointer">
                Falso
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="true" />
              <label htmlFor="true" className="text-sm cursor-pointer">
                Verdadeiro
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="misleading" />
              <label htmlFor="misleading" className="text-sm cursor-pointer">
                Enganoso
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="unknown" />
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
