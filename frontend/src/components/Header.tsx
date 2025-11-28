import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";

export const Header = () => {
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
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            <NavLink to="/sobre">Sobre</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
