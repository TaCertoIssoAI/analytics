import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "As senhas não coincidem",
        description: "Por favor, verifique se as senhas são iguais.",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail(email, password, name);
      toast({
        title: "Conta criada",
        description: "Bem-vindo! Você se registrou com sucesso.",
      });
      navigate("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha no registro",
        description: "Não foi possível criar a conta. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Cadastro de Revisores</CardTitle>
          <CardDescription className="text-center text-base pt-2">
            Para garantir que todos os revisores sejam verificados, o cadastro é realizado manualmente pela nossa equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center pb-8">
          <p className="text-muted-foreground">
            Por favor, envie um email solicitando seu cadastro para:
          </p>
          <div className="p-4 bg-muted rounded-lg font-medium text-lg select-all">
            contato@tacertoissoai.com.br
          </div>
          <Button className="w-full" asChild>
            <a href="mailto:contato@tacertoissoai.com.br?subject=Solicitação de Cadastro de Revisor">
              Enviar Email Agora
            </a>
          </Button>
          <div className="text-sm text-muted-foreground pt-4">
            Já tem uma conta?{" "}
            <Link to="/entrar" className="text-primary hover:underline font-medium">
              Fazer Login
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Register;
