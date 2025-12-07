import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, Brain, LineChart, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

const JoinReviewers = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 bg-muted/30">
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 mb-4">
              Programa Beta Aberto
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Ajude a Promover a <span className="text-primary">Verdade</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Junte-se à nossa comunidade de especialistas e ajude a treinar a próxima geração de IA para combater a desinformação.
            </p>
            <div className="pt-8">
              <Button size="lg" className="gap-2 h-12 px-8 text-lg" asChild>
                <Link to="/cadastro">
                  Quero ser um Revisor
                </Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Content Section */}
      <section className="container py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Quem são os Revisores?</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Para garantir a máxima precisão em nossas análises, contamos com uma rede de revisores autenticados pela equipe do TaCertoIsso AI.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Nossos revisores são profissionais que atuam em áreas críticas para a verificação de fatos, incluindo:
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="font-medium">Jornalistas e Fact-checkers</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <Brain className="h-5 w-5" />
                </div>
                <span className="font-medium">Pesquisadores Acadêmicos</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <LineChart className="h-5 w-5" />
                </div>
                <span className="font-medium">Cientistas de Dados</span>
              </li>
            </ul>
          </div>
          <div className="bg-card border rounded-2xl p-8 shadow-lg">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Comunidade Verificada</h3>
                  <p className="text-sm text-muted-foreground">Rede de confiança</p>
                </div>
              </div>
              <hr />
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  "A participação dos revisores é fundamental para calibrar nossos modelos. Cada avaliação humana ajuda a IA a entender nuances que algoritmos sozinhos podem perder."
                </p>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Equipe TaCertoIsso AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-muted/50 border-none">
            <CardContent className="pt-6 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-xl">Validação de Qualidade</h3>
              <p className="text-muted-foreground">
                As revisões servem para auditarmos se o bot fez uma boa análise de fact-checking, garantindo que a informação entregue aos usuários seja confiável.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50 border-none">
            <CardContent className="pt-6 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-xl">Treinamento da IA</h3>
              <p className="text-muted-foreground">
                O feedback dos revisores cria um ciclo virtuoso. Usamos as melhores e piores análises identificadas para ajustar e refinar nossos modelos de inteligência artificial.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-none">
            <CardContent className="pt-6 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <LineChart className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-xl">Impacto Real</h3>
              <p className="text-muted-foreground">
                Sua contribuição ajuda a combater a desinformação em escala, melhorando uma ferramenta usada diariamente por milhares de pessoas no WhatsApp.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20 border-t">
        <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 text-center space-y-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Estamos em Beta!</h2>
            <p className="text-lg text-primary-foreground/90">
              Neste momento, as inscrições estão abertas para todos que desejam contribuir. 
              Basta criar sua conta e começar a avaliar as análises.
            </p>
            <Button size="lg" variant="secondary" className="h-12 px-8 text-lg font-semibold" asChild>
              <Link to="/cadastro">
                Inscrever-se Agora
              </Link>
            </Button>
          </div>
          
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>
      </section>
    </div>
  );
};

export default JoinReviewers;
