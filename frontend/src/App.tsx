import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Verification from "./pages/Verification";
import NotFoundVerification from "./pages/NotFoundVerification";
import Busca from "./pages/Busca";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import JoinReviewers from "./pages/JoinReviewers";
import Methodology from "./pages/Methodology";
import TermsAndPrivacy from "./pages/TermsAndPrivacy";
import Admin from "./pages/Admin";
import Community from "./pages/Community";
import Apoie from "./pages/Apoie";
import { AuthProvider } from "./auth";
import { AdminRoute } from "./auth/AdminRoute";

import { VLibrasController } from "@/components/VLibrasController";

const queryClient = new QueryClient();

const App = () => {
  // Fix for high_contrast flicker: Apply class before paint
  if (typeof window !== "undefined") {
    const savedHighContrast = localStorage.getItem("highContrast") === "true";
    if (savedHighContrast) {
      document.documentElement.classList.add("high-contrast");
    }
  }

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <VLibrasController />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/cadastro" element={<Register />} />
              <Route path="/perfil/:id" element={<Profile />} />
              <Route path="/verificacao/:id" element={<Verification />} />
              <Route path="/verificacao-nao-encontrada/:id?" element={<NotFoundVerification />} />
              <Route path="/busca" element={<Busca />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/comunidade" element={<Community />} />
              <Route path="/seja-um-revisor" element={<JoinReviewers />} />
              <Route path="/metodologia" element={<Methodology />} />
              <Route path="/termos-e-privacidade" element={<TermsAndPrivacy />} />
              <Route path="/apoie" element={<Apoie />} />
              <Route path="/nao-autorizado" element={<Unauthorized />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

};

export default App;
