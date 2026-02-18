import { User, MessageCircle, Menu, Home, Search, Info, Palette, Moon, Sun, Eye, Ear, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getValidPhotoUrl } from "@/lib/utils";
import { getUserProfile } from "@/auth/userService";
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
  const location = useLocation();
  const isOnProfilePage = location.pathname.startsWith("/perfil/");
  const isOnAuthPage = location.pathname === "/entrar" || location.pathname === "/cadastro";
  const isAvatarActive = isOnProfilePage || isOnAuthPage;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [highContrast, setHighContrast] = useState(false);
  const [vlibrasEnabled, setVlibrasEnabled] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | undefined>(() => {
    // Initialize from cache immediately
    return localStorage.getItem("userPhotoURL") || undefined;
  });

  // Fetch the user's photo from Firestore profile, cache in localStorage
  useEffect(() => {
    if (currentUser?.uid) {
      // Use cached value first
      const cached = localStorage.getItem("userPhotoURL");
      if (cached) setUserPhotoURL(cached);

      getUserProfile(currentUser.uid).then((profile) => {
        const photo = profile?.photoURL || currentUser.photoURL || undefined;
        setUserPhotoURL(photo);
        if (photo) {
          localStorage.setItem("userPhotoURL", photo);
        } else {
          localStorage.removeItem("userPhotoURL");
        }
      }).catch(() => {
        if (!cached) setUserPhotoURL(currentUser.photoURL || undefined);
      });
    } else {
      setUserPhotoURL(undefined);
      localStorage.removeItem("userPhotoURL");
    }
  }, [currentUser]);

  // Listen for profile photo updates from the Profile page
  useEffect(() => {
    const handlePhotoUpdate = () => {
      const photo = localStorage.getItem("userPhotoURL") || undefined;
      setUserPhotoURL(photo);
    };
    window.addEventListener("profile-photo-updated", handlePhotoUpdate);
    return () => window.removeEventListener("profile-photo-updated", handlePhotoUpdate);
  }, []);

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
            <NavLink to="/" end className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-primary font-semibold border-b-2 border-primary pb-0.5">Início</NavLink>
            <NavLink to="/busca" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-primary font-semibold border-b-2 border-primary pb-0.5">Busca</NavLink>
            <NavLink to="/comunidade" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-primary font-semibold border-b-2 border-primary pb-0.5">Comunidade</NavLink>
            <NavLink to="/sobre" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-primary font-semibold border-b-2 border-primary pb-0.5">Sobre</NavLink>
            <NavLink to="/termos-e-privacidade" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-primary font-semibold border-b-2 border-primary pb-0.5">Termos</NavLink>
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
              <button
                onClick={handleUserClick}
                className="rounded-full transition-all hover:opacity-80"
                aria-label="User profile"
              >
                <Avatar className={`h-8 w-8 ${isAvatarActive ? "border-2 border-primary" : ""}`}>
                  {userPhotoURL ? (
                    <AvatarImage src={getValidPhotoUrl(userPhotoURL)} alt={currentUser?.displayName || "User"} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {currentUser?.displayName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </button>
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
                  <NavLink 
                    to="/" 
                    end
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary border-l-4 border-primary"
                  >
                    <Home className="h-5 w-5" />
                    Início
                  </NavLink>
                  <NavLink 
                    to="/busca" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary border-l-4 border-primary"
                  >
                    <Search className="h-5 w-5" />
                    Busca
                  </NavLink>
                  <NavLink 
                    to="/comunidade" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary border-l-4 border-primary"
                  >
                    <Users className="h-5 w-5" />
                    Comunidade
                  </NavLink>
                  <NavLink 
                    to="/sobre" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary border-l-4 border-primary"
                  >
                    <Info className="h-5 w-5" />
                    Sobre
                  </NavLink>
                  <NavLink 
                    to="/termos-e-privacidade" 
                    className="flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary border-l-4 border-primary"
                  >
                    <Info className="h-5 w-5" />
                    Termos e Privacidade
                  </NavLink>
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
                      className={`flex items-center gap-3 px-2 py-3 text-lg font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors w-full text-left ${isAvatarActive ? "bg-primary/10 text-primary border-l-4 border-primary" : ""}`}
                   >
                     <Avatar className={`h-7 w-7 ${isAvatarActive ? "border-2 border-primary" : ""}`}>
                       {userPhotoURL ? (
                         <AvatarImage src={getValidPhotoUrl(userPhotoURL)} alt={currentUser?.displayName || "User"} />
                       ) : null}
                       <AvatarFallback className="text-xs">
                         {currentUser?.displayName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                       </AvatarFallback>
                     </Avatar>
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
