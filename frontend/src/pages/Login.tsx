import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { IS_MOCK_MODE } from "@/mocks/config";
import { DEMO_ACCOUNTS } from "@/mocks/mockAuth";
import { ShieldCheck, UserCheck } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo de volta!",
      });
      navigate("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha no login",
        description: "Verifique suas credenciais e tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (kind: "reviewer" | "admin") => {
    setIsLoading(true);
    try {
      const account = DEMO_ACCOUNTS[kind];
      await signInWithEmail(account.email, "demo-password");
      toast({
        title: kind === "admin" ? "Acesso Admin Demo ativo" : "Acesso Revisor Demo ativo",
        description: "Sessão demonstrativa salva localmente no navegador.",
      });
      navigate(kind === "admin" ? "/admin" : "/");
    } catch {
      toast({
        variant: "destructive",
        title: "Falha no login demo",
        description: "Não foi possível iniciar a sessão demonstrativa.",
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
          <CardTitle className="text-2xl font-bold text-center">Entrar</CardTitle>
          <CardDescription className="text-center">
            Digite seu email e senha para acessar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          {IS_MOCK_MODE && (
            <div className="border-t pt-5 space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Acesso demonstrativo (salvo apenas no seu navegador)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleDemoLogin("reviewer")}
                  className="gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Revisor Demo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleDemoLogin("admin")}
                  className="gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin Demo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link to="/cadastro" className="text-primary hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
};

export default Login;
