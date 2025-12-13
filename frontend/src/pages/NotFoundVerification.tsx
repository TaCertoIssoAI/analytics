import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, Loader2, Home } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const NotFoundVerification = () => {
  const { id } = useParams();
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-16 md:py-24">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <FileQuestion className="h-24 w-24 text-muted-foreground" />
                <Loader2 className="h-8 w-8 text-primary absolute -bottom-2 -right-2 animate-spin" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Verificação Não Encontrada</h1>
              <p className="text-muted-foreground">
                {id ? `ID da verificação: ${id}` : 'Verificação não especificada'}
              </p>
            </div>

            <div className="bg-muted rounded-lg p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta verificação pode estar em uma das seguintes situações:
              </p>
              <ul className="text-sm text-left space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Ainda está sendo processada pela nossa IA</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>O ID fornecido está incorreto ou não existe</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>A verificação foi removida ou arquivada</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              Se você acredita que isto é um erro, entre em contato com nossa equipe ou tente novamente mais tarde.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg">
                <Link to="/" className="gap-2">
                  <Home className="h-4 w-4" />
                  Voltar para Início
                </Link>
              </Button>
              {id && (
                <Button variant="outline" size="lg" asChild>
                  <Link to={`/verificacao/${id}`}>
                    Tentar Novamente
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFoundVerification;
