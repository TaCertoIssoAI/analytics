
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

const Unauthorized = () => {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-8 rounded-full bg-destructive/10 p-6 ring-1 ring-destructive/20">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      
      <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Acesso Restrito
      </h1>
      
      <p className="mb-8 max-w-[500px] text-muted-foreground">
        Você não tem permissão para acessar esta página. Esta área é restrita apenas para administradores do sistema.
      </p>

      <div className="flex gap-4">
        <Button asChild variant="default">
          <Link to="/">
            Voltar para o Início
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Unauthorized;
