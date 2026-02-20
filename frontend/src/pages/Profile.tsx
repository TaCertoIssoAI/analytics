import { Header } from "@/components/Header";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { getUserProfile, createUserProfile, saveUserProfile, getUserInteractions, UserProfile, UserInteraction } from "@/auth/userService";
import { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin, Twitter, Instagram, Briefcase, Upload, Camera, MapPin, Calendar, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, BadgeCheck, KeyRound, Eye, EyeOff, BookOpen } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getValidPhotoUrl } from "@/lib/utils";

const Profile = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Observation modal state
  const [viewingObservation, setViewingObservation] = useState<UserInteraction | null>(null);
  
  const { updateUserProfile, updateUserPassword } = useAuth();

  const isOwnProfile = currentUser?.uid === id;

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch Profile
        let userProfile = await getUserProfile(id);
        
        // If profile doesn't exist in Firestore but it's the current user, create it
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

        // Fetch Interactions
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

    // Already a full URL
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Strip leading @ for twitter/instagram
    const handle = trimmed.replace(/^@/, "");

    const baseUrls: Record<string, string> = {
      linkedin: "https://linkedin.com/in/",
      twitter: "https://x.com/",
      instagram: "https://instagram.com/",
    };

    // If it looks like just a username (no slashes, no dots from domains)
    if (!/[\/\.]/.test(handle)) {
      return `${baseUrls[network]}${handle}`;
    }

    // Has slashes/dots but no protocol — prepend https://
    return `https://${trimmed.replace(/^\/+/, "")}`;
  };

  const validateSocialLink = (value: string, network: 'linkedin' | 'twitter' | 'instagram'): string | undefined => {
    if (!value.trim()) return undefined; // empty is ok

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Normalize & validate socials before saving
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
        // Update cached photo for Header avatar
        if (photoURL) {
          localStorage.setItem("userPhotoURL", photoURL);
        } else {
          localStorage.removeItem("userPhotoURL");
        }
        window.dispatchEvent(new Event("profile-photo-updated"));

        toast.success("Perfil atualizado com sucesso!");
        setIsEditing(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-12">
        <Header />
        
        {/* Skeleton Cover */}
        <div className="h-48 md:h-64 bg-gradient-to-r from-muted via-muted/60 to-muted w-full animate-[skeleton_1.8s_ease-in-out_infinite]" />

        <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* Skeleton Sidebar */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
              <div className="bg-card rounded-xl shadow-lg p-6 pt-0 border">
                <div className="flex flex-col items-center -mt-12 mb-4">
                  <div className="h-32 w-32 rounded-full bg-muted border-4 border-background shadow-xl animate-[skeleton_1.8s_ease-in-out_infinite]" />
                </div>
                <div className="flex flex-col items-center gap-3 mt-2">
                  <div className="h-6 w-40 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
                  <div className="h-4 w-32 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
                  <div className="h-3 w-28 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
                </div>
                <div className="mt-6 space-y-3">
                  <div className="h-4 w-full rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '400ms' }} />
                  <div className="h-4 w-3/4 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '500ms' }} />
                </div>
              </div>
            </div>
            
            {/* Skeleton Content */}
            <div className="w-full md:w-2/3 flex flex-col gap-6">
              <div className="bg-card rounded-xl shadow-lg p-6 border">
                <div className="flex gap-4 mb-6">
                  <div className="h-9 w-28 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
                  <div className="h-9 w-20 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl border">
                      <div className="h-10 w-10 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite] flex-shrink-0" style={{ animationDelay: `${400 + i * 150}ms` }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-48 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${500 + i * 150}ms` }} />
                        <div className="h-3 w-full rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${600 + i * 150}ms` }} />
                        <div className="h-3 w-2/3 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${700 + i * 150}ms` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-4 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Perfil não encontrado</CardTitle>
            </CardHeader>
            <CardContent>
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
      
      {/* Cover Image */}
      <div className="h-48 md:h-64 bg-gradient-to-r from-primary/20 via-primary/10 to-background w-full relative">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
      </div>

      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          
          {/* Sidebar / Profile Info */}
          <div className="w-full md:w-1/3 flex flex-col gap-6">
            <Card className="overflow-visible border-none shadow-lg">
              <CardContent className="p-6 pt-0">
                <div className="flex flex-col items-center -mt-12 mb-4">
                  <div className="relative group">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                      <AvatarImage src={getValidPhotoUrl(photoURL || profile.photoURL)} alt={profile.displayName || "User"} className="object-cover" />
                      <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                        {profile.displayName?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {isOwnProfile && !isEditing && (
                      <div 
                        className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer border-4 border-transparent"
                        onClick={() => setIsEditing(true)}
                      >
                        <Camera className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 mt-4 justify-center">
                    {isOwnProfile && isAdmin && (
                      <Link to="/admin">
                        <Badge variant="destructive" className="mb-1 hover:bg-destructive/80 cursor-pointer">
                          ADMIN
                        </Badge>
                      </Link>
                    )}
                    <h1 className="text-xl font-bold text-center">{profile.displayName || "Usuário"}</h1>
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  </div>
                  
                  {profile.occupation && (
                    <div className="flex flex-col items-center text-muted-foreground mt-3 gap-1">
                      <span className="text-center">{profile.occupation}</span>
                      <Briefcase className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                    <span>Membro desde {new Date(profile.createdAt).getFullYear()}</span>
                  </div>
                </div>

                {!isEditing && (
                  <div className="space-y-6">
                    {/* Stats */}
                    <div className=" gap-4 py-4 border-t border-b">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{interactions.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Avaliações</div>
                      </div>
                    </div>

                    {/* Bio */}
                    {profile.bio && (
                      <div className="text-sm text-muted-foreground text-center leading-relaxed">
                        {profile.bio}
                      </div>
                    )}

                    {/* Socials */}
                    <div className="flex justify-center gap-4">
                      {profile.socials?.linkedin && (
                        <a href={profile.socials.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                          <Linkedin className="h-5 w-5" />
                        </a>
                      )}
                      {profile.socials?.twitter && (
                        <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                          <Twitter className="h-5 w-5" />
                        </a>
                      )}
                      {profile.socials?.instagram && (
                        <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                          <Instagram className="h-5 w-5" />
                        </a>
                      )}
                    </div>

                    {isOwnProfile && (
                      <div className="pt-4 space-y-2">
                        <Button variant="outline" className="w-full" onClick={() => setIsEditing(true)}>
                          Editar Perfil
                        </Button>
                        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                          Sair
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isEditing && (
                  <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="flex justify-center mb-4">
                      <div className="flex flex-col items-center gap-2">
                         <div className="flex items-center gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Alterar Foto
                          </Button>
                          {photoURL && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPhotoURL("")}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
                      <p className="text-xs text-muted-foreground text-right">{name.length}/50</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="occupation">Ocupação</Label>
                      <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} maxLength={50} />
                      <p className="text-xs text-muted-foreground text-right">{occupation.length}/50</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} />
                      <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Redes Sociais</Label>
                      <div className="space-y-3">
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
                    </div>
                    
                    <div className="pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
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
                    
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={isSaving} className="flex-1">
                        {isSaving ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => {
                        setPhotoURL(profile?.photoURL || "");
                        setIsEditing(false);
                      }} disabled={isSaving}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="w-full md:w-2/3">
            <Tabs defaultValue="reviews" className="w-full">
              <div className="flex items-center justify-between">
                <TabsList className="flex-1 justify-start h-12 bg-transparent border-b rounded-none p-0 gap-8">
                  <TabsTrigger 
                    value="reviews" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base"
                  >
                    Avaliações ({interactions.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="about" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base"
                  >
                    Sobre
                  </TabsTrigger>
                </TabsList>
                {isOwnProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 ml-4 shrink-0"
                    onClick={() => window.open('/guia rapido do revisor - Ta Certo Isso AI.pdf', '_blank')}
                  >
                    <BookOpen className="h-4 w-4" />
                    Guia do Revisor
                  </Button>
                )}
              </div>

              <TabsContent value="reviews" className="mt-6 space-y-4">
                {interactions.length === 0 ? (
                  <Card className="bg-card border-dashed shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <h3 className="text-lg font-medium">Nenhuma avaliação ainda</h3>
                      <p className="text-muted-foreground mt-1">
                        As análises que este usuário avaliar aparecerão aqui.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  interactions.map((interaction) => (
                    <Card key={interaction.document_id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="flex">
                          <div className={`w-2 ${interaction.user_interaction === 'like' ? 'bg-primary' : 'bg-destructive'}`} />
                          <div className="p-5 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  {interaction.user_interaction === 'like' ? (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                                      <ThumbsUp className="h-3 w-3" /> Aprovou
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                                      <ThumbsDown className="h-3 w-3" /> Reprovou
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(interaction.processed_at || Date.now()), "dd 'de' MMM, yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                                
                                <Link to={`/verificacao/${interaction.document_id}`} className="group">
                                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                                    {interaction.analysis_title || "Análise sem título"}
                                  </h3>
                                  <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                                    {interaction.user_message_text}
                                  </p>
                                </Link>
                              </div>
                              
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/verificacao/${interaction.document_id}`}>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </Link>
                              </Button>
                            </div>
                            {(interaction.user_observation || (interaction.user_suggested_sources && Object.keys(interaction.user_suggested_sources).length > 0)) && (
                              <div className="mt-3 pt-3 border-t flex items-center gap-3">
                                <button
                                  onClick={() => setViewingObservation(interaction)}
                                  className={`text-xs flex items-center gap-1 transition-colors ${(interaction.has_custom_observation || (interaction.user_suggested_sources && Object.keys(interaction.user_suggested_sources).length > 0)) ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {interaction.has_custom_observation ? 'Ver observação' : 'Sem observações'}
                                </button>
                                {interaction.user_suggested_sources && Object.keys(interaction.user_suggested_sources).length > 0 && (
                                  <span className="text-xs flex items-center gap-1 text-primary">
                                    <BookOpen className="h-3 w-3" />
                                    {Object.keys(interaction.user_suggested_sources).length} fonte(s) sugerida(s)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="about" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Sobre</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Bio</h4>
                      <p className="text-muted-foreground">{profile.bio || "Nenhuma bio informada."}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Ocupação</h4>
                        <p className="text-muted-foreground">{profile.occupation || "Não informado"}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Membro desde</h4>
                        <p className="text-muted-foreground">{format(new Date(profile.createdAt), "PPP", { locale: ptBR })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
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
              <div>
                {viewingObservation?.user_interaction === "like" ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                    <ThumbsUp className="h-3 w-3" /> Aprovou
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <ThumbsDown className="h-3 w-3" /> Reprovou
                  </Badge>
                )}
              </div>
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
