import { User, MessageCircle, Menu, Home, Search, Info, Palette, Moon, Sun, Eye, Ear } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Header = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [highContrast, setHighContrast] = useState(false);
  const [vlibrasEnabled, setVlibrasEnabled] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");

    const savedHighContrast = localStorage.getItem("highContrast") === "true";
    setHighContrast(savedHighContrast);
    document.documentElement.classList.toggle("high-contrast", savedHighContrast);

    const savedVlibras = localStorage.getItem("vlibrasEnabled") === "true";
    setVlibrasEnabled(savedVlibras);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const toggleHighContrast = () => {
    const newHighContrast = !highContrast;
    setHighContrast(newHighContrast);
    localStorage.setItem("highContrast", String(newHighContrast));
    document.documentElement.classList.toggle("high-contrast", newHighContrast);
  };

  const toggleVLibras = () => {
    const newState = !vlibrasEnabled;
    setVlibrasEnabled(newState);
    localStorage.setItem("vlibrasEnabled", String(newState));
    
    // Dispatch custom event to notify VLibrasController
    window.dispatchEvent(new Event('vlibras-toggle'));
  };

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
          <img src="/tacertoissoai-logo.png" alt="Tá Certo Isso AI Logo" className="h-10 w-10 object-contain" />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-foreground">Tá Certo Isso AI?</span>
            <span className="text-xs text-muted-foreground">Analytics Platform</span>
          </div>
        </Link>
        
        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center gap-6">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/busca">Busca</NavLink>
            <NavLink to="/sobre">Sobre</NavLink>
            <NavLink to="/termos-e-privacidade">Termos</NavLink>
          </nav>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="https://wa.me/553584248271" target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="h-4 w-4" />
              Adicionar Bot
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVLibras}
                className="h-9 w-9"
                aria-label="Toggle VLibras"
              >
                <Ear className={`h-4 w-4 ${vlibrasEnabled ? "text-primary" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{vlibrasEnabled ? "Desativar VLibras" : "Ativar VLibras"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleHighContrast}
                className={`h-9 w-9 border-2 hover:text-foreground ${
                  theme === 'dark' || highContrast
                    ? 'border-yellow-400 hover:bg-yellow-400/10' 
                    : 'border-red-600 hover:bg-red-600/10'
                }`}
                aria-label="Toggle high contrast"
              >
                <Eye className={`h-4 w-4 ${highContrast ? "text-primary" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Alto Contraste</p>
            </TooltipContent>
          </Tooltip>

          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUserClick}
                className="rounded-full"
                aria-label="User profile"
              >
                <User className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentUser ? "Ver Perfil" : "Entrar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-4">
          <a 
            href="https://wa.me/553584248271" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary transition-colors"
            aria-label="Adicionar Bot no WhatsApp"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader className="text-left border-b pb-4 mb-6">
                <SheetTitle className="text-2xl font-bold">Menu</SheetTitle>
                <SheetDescription className="sr-only">Menu de navegação principal</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6">
                <nav className="flex flex-col gap-2">
                  <Link 
                    to="/" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Home className="h-5 w-5" />
                    Início
                  </Link>
                  <Link 
                    to="/busca" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Search className="h-5 w-5" />
                    Busca
                  </Link>
                  <Link 
                    to="/sobre" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Info className="h-5 w-5" />
                    Sobre
                  </Link>
                  <Link 
                    to="/termos-e-privacidade" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Info className="h-5 w-5" />
                    Termos e Privacidade
                  </Link>
                </nav>
                
                <div className="border-t pt-6 flex flex-col gap-2">
                   <button
                     onClick={toggleTheme}
                     className="flex items-center justify-between px-2 py-3 w-full text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                   >
                     <span className="flex items-center gap-3">
                       <Palette className="h-5 w-5" />
                       Tema
                     </span>
                     {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                   </button>

                   <button
                     onClick={toggleHighContrast}
                     className="flex items-center justify-between px-2 py-3 w-full text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                   >
                     <span className="flex items-center gap-3">
                       <Eye className="h-5 w-5" />
                       Alto Contraste
                     </span>
                     <div className={`h-4 w-4 rounded-full border ${highContrast ? "bg-primary border-primary" : "border-foreground"}`} />
                   </button>

                   <button
                     onClick={toggleVLibras}
                     className="flex items-center justify-between px-2 py-3 w-full text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                   >
                     <span className="flex items-center gap-3">
                       <Ear className="h-5 w-5" />
                       VLibras
                     </span>
                     <div className={`h-4 w-4 rounded-full border ${vlibrasEnabled ? "bg-primary border-primary" : "border-foreground"}`} />
                   </button>
                   
                   <button
                      onClick={handleUserClick}
                      className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors w-full text-left"
                   >
                     <User className="h-5 w-5" />
                     <span>{currentUser ? "Meu Perfil" : "Entrar"}</span>
                   </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
