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
import { Linkedin, Twitter, Instagram, Briefcase, Upload, Camera, MapPin, Calendar, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, BadgeCheck } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Image Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSaving(true);
    
    try {
      if (name !== profile.displayName) {
        await updateUserProfile(name);
      }
      
      if (password) {
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem");
          setIsSaving(false);
          return;
        }
        await updateUserPassword(password);
      }
      
      const updatedProfile: UserProfile = {
        ...profile,
        displayName: name,
        bio,
        occupation,
        photoURL,
        socials: {
          linkedin,
          twitter,
          instagram
        }
      };
      
      const success = await saveUserProfile(updatedProfile);
      
      if (success) {
        toast.success("Perfil atualizado com sucesso!");
        setIsEditing(false);
        setPassword("");
        setConfirmPassword("");
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

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
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
                      <AvatarImage src={profile.photoURL} alt={profile.displayName || "User"} className="object-cover" />
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
                  
                  <div className="flex flex-col items-center gap-2 mt-4 justify-center">
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-center">{profile.displayName || "Usuário"}</h1>
                      <BadgeCheck className="h-6 w-6 text-primary" />
                    </div>
                    {isOwnProfile && isAdmin && (
                      <Link to="/admin">
                        <Badge variant="destructive" className="mt-1 hover:bg-destructive/80 cursor-pointer">
                          ADMIN
                        </Badge>
                      </Link>
                    )}
                  </div>
                  
                  {profile.occupation && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                      <Briefcase className="h-4 w-4" />
                      <span>{profile.occupation}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3" />
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
                      <div className="space-y-2">
                        <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn" />
                        <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="Twitter" />
                        <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t">
                      <Label htmlFor="password">Nova Senha (opcional)</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    
                    {password && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={isSaving} className="flex-1">
                        {isSaving ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
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
              <TabsList className="w-full justify-start h-12 bg-transparent border-b rounded-none p-0 gap-8">
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
    </div>
  );
};

export default Profile;
