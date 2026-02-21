import { Header } from "@/components/Header";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef, useMemo } from "react";
import { getUserProfile, createUserProfile, saveUserProfile, getUserInteractions, UserProfile, UserInteraction } from "@/auth/userService";
import { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Linkedin, Twitter, Instagram, Briefcase, Upload, Camera,
  Calendar, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink,
  BadgeCheck, KeyRound, Eye, EyeOff, BookOpen, Lightbulb,
  Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight,
  Pencil, LogOut, ShieldAlert, BarChart3, XCircle, Scale, LinkIcon,
} from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getValidPhotoUrl } from "@/lib/utils";

const ITEMS_PER_PAGE = 8;

const Profile = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [occupation, setOccupation] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [socialErrors, setSocialErrors] = useState<{ linkedin?: string; twitter?: string; instagram?: string }>({});

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Image Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  // Observation modal state
  const [viewingObservation, setViewingObservation] = useState<UserInteraction | null>(null);

  // List management state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { updateUserProfile, updateUserPassword } = useAuth();

  const isOwnProfile = currentUser?.uid === id;

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const token = isOwnProfile ? await currentUser?.getIdToken() : undefined;
        let userProfile = await getUserProfile(id, token);

        if (!userProfile && isOwnProfile && currentUser) {
          await createUserProfile(currentUser as User);
          userProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL || undefined,
            createdAt: Date.now(),
          };
        }

        setProfile(userProfile);

        if (userProfile) {
          setName(userProfile.displayName || "");
          setBio(userProfile.bio || "");
          setOccupation(userProfile.occupation || "");
          setPhotoURL(userProfile.photoURL || "");
          setLinkedin(userProfile.socials?.linkedin || "");
          setTwitter(userProfile.socials?.twitter || "");
          setInstagram(userProfile.socials?.instagram || "");
        }

        const userInteractions = await getUserInteractions(id);
        setInteractions(userInteractions);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, currentUser, isOwnProfile]);

  // --- Computed stats ---
  const stats = useMemo(() => {
    const total = profile?.review_count ?? interactions.length;
    const likes = interactions.filter(i => i.user_interaction === "like").length;
    const neutrals = interactions.filter(i => i.user_interaction === "neutral").length;
    const dislikes = interactions.filter(i => i.user_interaction === "dislike").length;
    const sourcesCount = interactions.reduce((acc, i) => {
      return acc + (i.user_suggested_sources ? Object.keys(i.user_suggested_sources).length : 0);
    }, 0);
    return { total, likes, neutrals, dislikes, sourcesCount };
  }, [interactions, profile]);

  // --- Filtered & sorted & paginated interactions ---
  const filteredInteractions = useMemo(() => {
    let result = [...interactions];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        (i.analysis_title || "").toLowerCase().includes(q) ||
        (i.user_message_text || "").toLowerCase().includes(q) ||
        (i.user_observation || "").toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter(i => i.user_interaction === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.processed_at || 0).getTime();
      const dateB = new Date(b.processed_at || 0).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [interactions, searchQuery, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredInteractions.length / ITEMS_PER_PAGE));
  const paginatedInteractions = filteredInteractions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, sortOrder]);

  const handleLogout = async () => {
    await logout();
    navigate("/entrar");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setTempImage(event.target?.result as string);
      setShowCropper(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImage: string) => {
    setPhotoURL(croppedImage);
    setShowCropper(false);
    setTempImage(null);
    toast.success("Imagem recortada com sucesso!");
  };

  // --- Social link helpers ---
  const normalizeSocialLink = (value: string, network: 'linkedin' | 'twitter' | 'instagram'): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, "");
    const baseUrls: Record<string, string> = {
      linkedin: "https://linkedin.com/in/",
      twitter: "https://x.com/",
      instagram: "https://instagram.com/",
    };
    if (!/[\/\.]/.test(handle)) return `${baseUrls[network]}${handle}`;
    return `https://${trimmed.replace(/^\/+/, "")}`;
  };

  const validateSocialLink = (value: string, network: 'linkedin' | 'twitter' | 'instagram'): string | undefined => {
    if (!value.trim()) return undefined;
    const patterns: Record<string, RegExp> = {
      linkedin: /^https?:\/\/(www\.)?linkedin\.com\//i,
      twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i,
      instagram: /^https?:\/\/(www\.)?instagram\.com\//i,
    };
    if (!patterns[network].test(value)) {
      const names: Record<string, string> = { linkedin: "LinkedIn", twitter: "Twitter / X", instagram: "Instagram" };
      return `Este link não pertence ao ${names[network]}`;
    }
    return undefined;
  };

  const handleSocialBlur = (network: 'linkedin' | 'twitter' | 'instagram') => {
    const setters: Record<string, (v: string) => void> = { linkedin: setLinkedin, twitter: setTwitter, instagram: setInstagram };
    const getters: Record<string, string> = { linkedin, twitter, instagram };
    const normalized = normalizeSocialLink(getters[network], network);
    setters[network](normalized);
    const error = validateSocialLink(normalized, network);
    setSocialErrors(prev => ({ ...prev, [network]: error }));
  };

  const openEditModal = () => {
    if (!profile) return;
    setName(profile.displayName || "");
    setBio(profile.bio || "");
    setOccupation(profile.occupation || "");
    setPhotoURL(profile.photoURL || "");
    setLinkedin(profile.socials?.linkedin || "");
    setTwitter(profile.socials?.twitter || "");
    setInstagram(profile.socials?.instagram || "");
    setSocialErrors({});
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const normalizedLinkedin = normalizeSocialLink(linkedin, 'linkedin');
    const normalizedTwitter = normalizeSocialLink(twitter, 'twitter');
    const normalizedInstagram = normalizeSocialLink(instagram, 'instagram');

    const errs = {
      linkedin: validateSocialLink(normalizedLinkedin, 'linkedin'),
      twitter: validateSocialLink(normalizedTwitter, 'twitter'),
      instagram: validateSocialLink(normalizedInstagram, 'instagram'),
    };
    setSocialErrors(errs);

    if (errs.linkedin || errs.twitter || errs.instagram) {
      toast.error("Corrija os links de redes sociais antes de salvar");
      return;
    }

    setLinkedin(normalizedLinkedin);
    setTwitter(normalizedTwitter);
    setInstagram(normalizedInstagram);

    setIsSaving(true);

    try {
      if (name !== profile.displayName) {
        await updateUserProfile(name);
      }

      const updatedProfile: UserProfile = {
        ...profile,
        displayName: name,
        bio,
        occupation,
        photoURL,
        socials: {
          linkedin: normalizedLinkedin,
          twitter: normalizedTwitter,
          instagram: normalizedInstagram
        }
      };

      const success = await saveUserProfile(updatedProfile);

      if (success) {
        if (photoURL) {
          localStorage.setItem("userPhotoURL", photoURL);
        } else {
          localStorage.removeItem("userPhotoURL");
        }
        window.dispatchEvent(new Event("profile-photo-updated"));
        toast.success("Perfil atualizado com sucesso!");
        setIsEditModalOpen(false);
        setProfile(updatedProfile);
      } else {
        toast.error("Erro ao salvar dados do perfil");
      }

    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!password || password.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!currentPassword) {
      toast.error("Informe sua senha atual");
      return;
    }
    setIsChangingPassword(true);
    try {
      await updateUserPassword(currentPassword, password);
      toast.success("Senha alterada com sucesso!");
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error?.code === "auth/wrong-password") {
        toast.error("Senha atual incorreta");
      } else {
        toast.error("Erro ao alterar senha. Verifique sua senha atual.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // --- Interaction badge helper ---
  const InteractionBadge = ({ type, size = "default" }: { type: string; size?: "default" | "sm" }) => {
    const cls = size === "sm" ? "text-xs py-0 px-1.5 gap-0.5" : "gap-1";
    const iconCls = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
    if (type === "like") return (
      <Badge variant="outline" className={`bg-primary/10 text-primary border-primary/20 ${cls}`}>
        <ThumbsUp className={iconCls} /> Aprovou
      </Badge>
    );
    if (type === "neutral") return (
      <Badge variant="outline" className={`bg-muted text-muted-foreground border-muted-foreground/20 ${cls}`}>
        <Lightbulb className={iconCls} /> Neutro
      </Badge>
    );
    return (
      <Badge variant="outline" className={`bg-destructive/10 text-destructive border-destructive/20 ${cls}`}>
        <ThumbsDown className={iconCls} /> Reprovou
      </Badge>
    );
  };

  // --- Pagination helper ---
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  // ========================
  // LOADING SKELETON
  // ========================
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-12">
        <Header />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Header skeleton */}
          <div className="bg-card rounded-xl border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="h-24 w-24 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                <div className="h-6 w-48 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
                <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
              </div>
            </div>
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border p-4 space-y-2">
                <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* List skeleton */}
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-4 flex items-center gap-4">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-4xl mx-auto px-4 mt-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h2 className="text-lg font-semibold mb-2">Perfil não encontrado</h2>
              <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header />

      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* ========================================= */}
        {/* 1. PROFILE HEADER — Horizontal, Read-Only */}
        {/* ========================================= */}
        <Card className="overflow-hidden">
          {/* Gradient banner */}
          <div className="h-24 sm:h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-background relative">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
          </div>

          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12 sm:-mt-14">
              {/* Avatar */}
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background shadow-lg flex-shrink-0">
                <AvatarImage src={getValidPhotoUrl(profile.photoURL)} alt={profile.displayName || "User"} className="object-cover" />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {profile.displayName?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left min-w-0 pb-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{profile.displayName || "Usuário"}</h1>
                  <BadgeCheck className="h-5 w-5 text-primary flex-shrink-0" />
                  {isOwnProfile && isAdmin && (
                    <Link to="/admin">
                      <Badge variant="destructive" className="hover:bg-destructive/80 cursor-pointer text-[10px] py-0">
                        ADMIN
                      </Badge>
                    </Link>
                  )}
                </div>

                {profile.occupation && (
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground mt-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{profile.occupation}</span>
                  </div>
                )}

                {profile.bio && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{profile.bio}</p>
                )}

                {/* Social links + member since */}
                <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 flex-wrap">
                  {profile.socials?.linkedin && (
                    <a href={profile.socials.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors" title="LinkedIn">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socials?.twitter && (
                    <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors" title="Twitter / X">
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socials?.instagram && (
                    <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors" title="Instagram">
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1">
                    <Calendar className="h-3 w-3" />
                    Membro desde {new Date(profile.createdAt).getFullYear()}
                  </span>
                </div>
              </div>

              {/* Action buttons — top right area */}
              <div className="flex items-center gap-2 flex-shrink-0 sm:self-start sm:mt-14">
                {isOwnProfile && (
                  <>
                    <Button variant="outline" size="sm" className="gap-2" onClick={openEditModal}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar Perfil
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open('/guia rapido do revisor - Ta Certo Isso AI.pdf', '_blank')}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Guia do Revisor</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={handleLogout}
                      title="Sair"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===================================== */}
        {/* 2. STATS DASHBOARD — 4 Mini Cards     */}
        {/* ===================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{stats.total}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Avaliações</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{stats.dislikes}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Fake News Desmentidas</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Scale className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{stats.neutrals}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Análises Neutras</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <LinkIcon className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{stats.sourcesCount}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Fontes Sugeridas</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* =========================================== */}
        {/* 3. LIST MANAGEMENT TOOLBAR                  */}
        {/* =========================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar avaliações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter dropdown */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="like">Aprovado</SelectItem>
              <SelectItem value="neutral">Neutro</SelectItem>
              <SelectItem value="dislike">Rejeitado</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort button */}
          <Button
            variant="outline"
            size="default"
            className="gap-2 shrink-0"
            onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">{sortOrder === "newest" ? "Mais recentes" : "Mais antigas"}</span>
          </Button>
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground -mt-3">
          {filteredInteractions.length} {filteredInteractions.length === 1 ? "resultado" : "resultados"}
          {searchQuery && ` para "${searchQuery}"`}
        </div>

        {/* =========================================== */}
        {/* 4. COMPACT EVALUATION CARDS                 */}
        {/* =========================================== */}
        {paginatedInteractions.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium">
                {interactions.length === 0
                  ? "Nenhuma avaliação ainda"
                  : "Nenhum resultado encontrado"}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {interactions.length === 0
                  ? "As análises que este usuário avaliar aparecerão aqui."
                  : "Tente alterar os filtros ou o termo de busca."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {paginatedInteractions.map((interaction) => (
              <Card
                key={interaction.document_id}
                className="overflow-hidden hover:shadow-md transition-shadow group"
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Color bar */}
                    <div className={`w-1.5 flex-shrink-0 ${
                      interaction.user_interaction === "like"
                        ? "bg-primary"
                        : interaction.user_interaction === "neutral"
                        ? "bg-muted-foreground"
                        : "bg-destructive"
                    }`} />

                    <div className="flex-1 px-4 py-3 min-w-0">
                      {/* Top row: badge + date + link */}
                      <div className="flex items-center gap-2 mb-1">
                        <InteractionBadge type={interaction.user_interaction} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(interaction.processed_at || Date.now()), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <div className="flex-1" />
                        {(interaction.user_observation || (interaction.user_suggested_sources && Object.keys(interaction.user_suggested_sources).length > 0)) && (
                          <button
                            onClick={() => setViewingObservation(interaction)}
                            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                            title="Ver detalhes"
                          >
                            <MessageSquare className="h-3 w-3" />
                            {interaction.user_suggested_sources && Object.keys(interaction.user_suggested_sources).length > 0 && (
                              <span className="text-primary">{Object.keys(interaction.user_suggested_sources).length}</span>
                            )}
                          </button>
                        )}
                        <Link
                          to={`/verificacao/${interaction.document_id}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Ver análise"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>

                      {/* Title */}
                      <Link to={`/verificacao/${interaction.document_id}`} className="group/link">
                        <h3 className="text-sm font-medium group-hover/link:text-primary transition-colors line-clamp-1">
                          {interaction.analysis_title || "Análise sem título"}
                        </h3>
                      </Link>

                      {/* Preview */}
                      {interaction.user_message_text && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {interaction.user_message_text}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* =========================================== */}
        {/* 5. PAGINATION                               */}
        {/* =========================================== */}
        {totalPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              {/* Previous */}
              <PaginationItem>
                <PaginationLink
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={`gap-1 pl-2.5 cursor-pointer select-none ${currentPage === 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </PaginationLink>
              </PaginationItem>

              {/* Page numbers */}
              {getPageNumbers().map((page, idx) =>
                page === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={currentPage === page}
                      onClick={() => setCurrentPage(page as number)}
                      className="cursor-pointer select-none"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              {/* Next */}
              <PaginationItem>
                <PaginationLink
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={`gap-1 pr-2.5 cursor-pointer select-none ${currentPage === totalPages ? "pointer-events-none opacity-50" : ""}`}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* ============================================= */}
      {/* MODALS                                        */}
      {/* ============================================= */}

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) setIsEditModalOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Perfil
            </DialogTitle>
            <DialogDescription>
              Atualize suas informações de perfil público.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-muted">
                <AvatarImage src={getValidPhotoUrl(photoURL)} className="object-cover" />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Alterar Foto
                </Button>
                {photoURL && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setPhotoURL("")}>
                    Remover
                  </Button>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
              <p className="text-xs text-muted-foreground text-right">{name.length}/50</p>
            </div>

            {/* Occupation */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-occupation">Ocupação</Label>
              <Input id="edit-occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} maxLength={50} placeholder="Ex: Jornalista, Pesquisador..." />
              <p className="text-xs text-muted-foreground text-right">{occupation.length}/50</p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea id="edit-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} placeholder="Conte um pouco sobre você..." />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
            </div>

            {/* Socials */}
            <div className="space-y-3">
              <Label>Redes Sociais</Label>
              <div>
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={linkedin}
                    onChange={(e) => { setLinkedin(e.target.value); setSocialErrors(prev => ({ ...prev, linkedin: undefined })); }}
                    onBlur={() => handleSocialBlur('linkedin')}
                    placeholder="linkedin.com/in/usuario ou @usuario"
                    className={socialErrors.linkedin ? 'border-destructive' : ''}
                  />
                </div>
                {socialErrors.linkedin && <p className="text-xs text-destructive mt-1 ml-6">{socialErrors.linkedin}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={twitter}
                    onChange={(e) => { setTwitter(e.target.value); setSocialErrors(prev => ({ ...prev, twitter: undefined })); }}
                    onBlur={() => handleSocialBlur('twitter')}
                    placeholder="x.com/usuario ou @usuario"
                    className={socialErrors.twitter ? 'border-destructive' : ''}
                  />
                </div>
                {socialErrors.twitter && <p className="text-xs text-destructive mt-1 ml-6">{socialErrors.twitter}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={instagram}
                    onChange={(e) => { setInstagram(e.target.value); setSocialErrors(prev => ({ ...prev, instagram: undefined })); }}
                    onBlur={() => handleSocialBlur('instagram')}
                    placeholder="instagram.com/usuario ou @usuario"
                    className={socialErrors.instagram ? 'border-destructive' : ''}
                  />
                </div>
                {socialErrors.instagram && <p className="text-xs text-destructive mt-1 ml-6">{socialErrors.instagram}</p>}
              </div>
            </div>

            {/* Password */}
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCurrentPassword("");
                  setPassword("");
                  setConfirmPassword("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                  setIsPasswordModalOpen(true);
                }}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Cropper */}
      <ImageCropper
        open={showCropper}
        imageSrc={tempImage}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
      />

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={(open) => { if (!open) setIsPasswordModalOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Alterar Senha
            </DialogTitle>
            <DialogDescription>
              Informe sua senha atual e a nova senha desejada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-current-password">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="modal-current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="modal-new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="modal-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !password || password !== confirmPassword}
            >
              {isChangingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Observation Modal */}
      <Dialog open={!!viewingObservation} onOpenChange={(open) => { if (!open) setViewingObservation(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Observação
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes da observação do revisor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* User + Badge row */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-muted">
                <AvatarImage src={getValidPhotoUrl(profile?.photoURL)} />
                <AvatarFallback>{profile?.displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{profile?.displayName || "Usuário"}</div>
                <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
              </div>
              {viewingObservation && <InteractionBadge type={viewingObservation.user_interaction} />}
            </div>

            {/* Analysis info */}
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                <span>Análise avaliada</span>
                <span>{viewingObservation?.processed_at ? format(new Date(viewingObservation.processed_at), "dd 'de' MMM, yyyy", { locale: ptBR }) : ""}</span>
              </div>
              <p className="text-sm font-medium line-clamp-2">{viewingObservation?.analysis_title || "Sem título"}</p>
              {viewingObservation?.overall_verdict && (
                <p className="text-xs text-muted-foreground mt-1">{viewingObservation.overall_verdict}</p>
              )}
            </div>

            {/* Observation text */}
            <div className="bg-secondary/50 rounded-lg p-4 text-sm whitespace-pre-wrap break-words">
              {viewingObservation?.user_observation || "Sem observação"}
            </div>

            {/* Suggested Sources */}
            {viewingObservation?.user_suggested_sources && Object.keys(viewingObservation.user_suggested_sources).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Fontes Sugeridas
                </div>
                {Object.entries(viewingObservation.user_suggested_sources).map(([claimId, entry]) => {
                  const claimText = (viewingObservation as any)?.claims?.find((c: any) => c.claim_id === claimId)?.text;
                  return (
                    <div key={claimId} className="rounded-lg border p-3 space-y-2">
                      {claimText && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          "{claimText}"
                        </p>
                      )}
                      {entry.observation && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Obs:</span> {entry.observation}
                        </p>
                      )}
                      <div className="space-y-1">
                        {entry.items?.map((source, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <ExternalLink className="h-3 w-3 text-primary flex-shrink-0" />
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline truncate"
                            >
                              {source.title || source.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/verificacao/${viewingObservation?.document_id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Análise
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
