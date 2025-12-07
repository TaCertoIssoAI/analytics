import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Header } from "@/components/Header";

const Controls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      <Button variant="secondary" size="icon" onClick={() => zoomIn()}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" onClick={() => zoomOut()}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" onClick={() => resetTransform()}>
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
};

const Methodology = () => {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "loose",
      themeVariables: {
        fontFamily: "Inter, sans-serif",
        primaryColor: "#2374f7",
        primaryTextColor: "#fff",
        primaryBorderColor: "#000",
        lineColor: "#F8B229",
        secondaryColor: "#006100",
        tertiaryColor: "#fff",
      },
    });
    
    if (mermaidRef.current) {
      mermaid.run({
        nodes: [mermaidRef.current],
      });
    }
  }, []);

  const diagram = `
flowchart LR

%% Colors %%
linkStyle default stroke-width:2px
classDef blue fill:#2374f7,stroke:#000,stroke-width:2px,color:#fff
classDef orange fill:#fc822b,stroke:#000,stroke-width:2px,color:#fff
classDef green fill:#16b552,stroke:#000,stroke-width:2px,color:#fff
classDef red fill:#ed2633,stroke:#000,stroke-width:2px,color:#fff
classDef magenta fill:magenta,stroke:#000,stroke-width:2px,color:#fff

A(IMG):::green ===> P[Separação por Modalidade]:::default
AA(IMG + Texto):::green ===> P[Separação por Modalidade]:::default
AAAAAA(Texto):::green ===> P[Separação por Modalidade]:::default
AAAA(Áudio):::green ===> P[Separação por Modalidade]:::default
AAAAAAAA(Vídeo):::green ===> P[Separação por Modalidade]:::default
AAA(Vídeo + Texto):::green ===> P[Separação por Modalidade]:::default



%% 1,2,3,4 %%
P ---o ALEK(Texto Original)
P ---o ALEKI(Imagem)
P ---o ALEKII(Transcri. Áudio)
P ---o ALEKIII(Vídeo?)

ALEK ---o |Contexto de Links|PD(Extrator de Afirmações<br>Afirmação 1<br>Afirmação 2<br>...<br>Afirmação n<br>):::orange
ALEK ---o |Texto Original|PD
ALEKI ---o PD
ALEKII ---o PD
ALEKIII ---o PD
PD --- MT([APIs de fact-checking<br>Busca na Web]):::blue
MT --- |Contexto Externo| ZOIO(Lista de Afirmações<br>enriquecidas) 
ZOIO ----  OV(Julgamento Final - Contexto de todas afirmações e LLM):::red ---> Whatsapp{Whatsapp}:::green

OV --- |Cada entrada do dataset é<br>por afirmação, mas apenas ingerida após<br> o julgamento final| IC[(Analytics)]:::blue
`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center text-primary">
          Metodologia Tá Certo Isso AI
        </h1>
      
      <Card className="mb-10 overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Arquitetura do Sistema</CardTitle>
        </CardHeader>
          <div className="relative w-full h-[80vh] min-h-[600px] bg-background">
            <TransformWrapper
              initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              minScale={0.2}
              maxScale={8}
              centerOnInit={true}
              wheel={{ step: 0.2 }}
            >
              <Controls />
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                <div className="mermaid p-6 flex justify-center items-center w-full h-full" ref={mermaidRef}>
                  {diagram}
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
      </Card>

      <div className="space-y-12">
        <section className="prose dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-muted-foreground">
            A arquitetura do <strong>Tá Certo Isso AI</strong> foi pensada como um pipeline de checagem multimodal, que vai desde a entrada de conteúdo no WhatsApp até a geração de insights em um módulo de analytics.
          </p>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 text-sm font-bold">1</span>
                Entrada multimodal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O sistema recebe diferentes tipos de conteúdo enviados pelos usuários: apenas imagem, imagem acompanhada de texto, vídeo com texto e mensagens de áudio. Cada tipo de mídia é tratado como uma fonte de sinal distinta, mas todos são encaminhados para o mesmo núcleo de processamento.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-bold">2</span>
                Processamento multimodal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                No bloco de processamento multimodal, aplicamos modelos especializados para cada tipo de mídia, unificando tudo em uma representação estruturada e comparável. A ideia é extrair o máximo de contexto possível: quem está sendo citado, qual é o tema central, qual é o tom da mensagem e quais são os elementos que podem indicar desinformação. O resultado desta etapa é um texto enriquecido com contexto incluso, pronto para análise semântica mais profunda.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 text-sm font-bold">3</span>
                Extração de afirmações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Em seguida, o extrator de afirmações quebra o conteúdo em unidades verificáveis, como "afirmação 1", "afirmação 2" até "afirmação n". Cada afirmação é tratada como um item independente que pode ser checado em bases externas. Isso permite lidar, por exemplo, com um único vídeo que traz várias alegações diferentes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-sm font-bold">4</span>
                Consulta a APIs e Web
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Para cada afirmação, o sistema consulta APIs de fact checking e mecanismos de busca na web. Aqui é onde entramos em contato com o contexto externo: checagens já existentes, notícias confiáveis, bases oficiais e outras fontes que ajudam a confirmar, refutar ou qualificar aquela afirmação.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-sm font-bold">5</span>
                Julgamento final com contexto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Combinando o contexto incluso (originado do próprio conteúdo enviado) com o contexto externo (resultado das buscas e das APIs de fact checking), o módulo de julgamento final produz uma classificação da afirmação, como verdadeira, falsa, enganosa ou fora de contexto. Além do rótulo, o sistema também gera uma explicação estruturada, pensada para ser transparente e compreensível para o usuário final.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-teal-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300 text-sm font-bold">6</span>
                Retorno e Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O resultado dessa checagem alimenta o fluxo do WhatsApp, que decide como responder ao usuário com uma mensagem curta no app e, quando fizer sentido, com um link detalhado para a nossa plataforma web. Ao mesmo tempo, cada checagem é registrada em um dataset anonimizado, que abastece o módulo de analytics. Esse módulo permitirá visualizar padrões de desinformação, temas recorrentes, formatos mais usados e a evolução das fake news ao longo do tempo.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Methodology;
