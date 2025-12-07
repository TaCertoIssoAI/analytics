import { MessageSquare, CheckCircle2, User, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";

export const Header = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleUserClick = () => {
    if (currentUser) {
      navigate(`/perfil/${currentUser.uid}`);
    } else {
      navigate("/entrar");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="relative">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CheckCircle2 className="h-4 w-4 text-primary absolute -bottom-1 -right-1 bg-background rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-foreground">Tá Certo Isso AI?</span>
            <span className="text-xs text-muted-foreground">Analytics Platform</span>
          </div>
        </Link>
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="hidden md:flex gap-2 text-green-600 border-green-600 hover:bg-green-50" asChild>
            <a href="https://wa.me/553584248271" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Adicionar Bot
            </a>
          </Button>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/busca">Busca</NavLink>
            <NavLink to="/sobre">Sobre</NavLink>
          </nav>
          <ThemeToggle />
          <button
            onClick={handleUserClick}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="User profile"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
