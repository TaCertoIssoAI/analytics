import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { getUserProfile, createUserProfile, saveUserProfile, UserProfile } from "@/auth/userService";
import { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin, Twitter, Instagram, Briefcase, User as UserIcon, Upload, Camera } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

const Profile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
    const fetchProfile = async () => {
      if (!id) return;
      setLoading(true);
      console.log("Fetching profile for ID:", id);
      try {
        let userProfile = await getUserProfile(id);
        console.log("Fetched profile:", userProfile);
        
        // If profile doesn't exist in Firestore but it's the current user, create it
        if (!userProfile && isOwnProfile && currentUser) {
          console.log("Profile missing for current user, creating...");
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
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, currentUser, isOwnProfile]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB before cropping)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTempImage(event.target?.result as string);
      setShowCropper(true);
      // Reset input value so same file can be selected again if needed
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
      // Update Name in Firebase Auth
      if (name !== profile.displayName) {
        await updateUserProfile(name);
      }
      
      // Update Password in Firebase Auth
      if (password) {
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem");
          setIsSaving(false);
          return;
        }
        await updateUserPassword(password);
      }
      
      // Save full profile to Backend
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
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Perfil não encontrado</CardTitle>
            <CardDescription>O usuário que você está procurando não existe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="relative group">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.photoURL} alt={profile.displayName || "User"} />
              <AvatarFallback className="text-2xl">{profile.displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            {isOwnProfile && !isEditing && (
              <div 
                className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">{profile.displayName || "Usuário"}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              {profile.occupation && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {profile.occupation}
                </span>
              )}
            </CardDescription>
            {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
            
            {/* Social Links Display */}
            <div className="flex gap-3 mt-3">
              {profile.socials?.linkedin && (
                <a href={profile.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {profile.socials?.twitter && (
                <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {profile.socials?.instagram && (
                <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex justify-center mb-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={photoURL} />
                    <AvatarFallback className="text-3xl">{name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
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
                  <p className="text-xs text-muted-foreground">Max 5MB. JPG/PNG.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Seu nome"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="occupation">Ocupação / Cargo</Label>
                  <Input 
                    id="occupation" 
                    value={occupation} 
                    onChange={(e) => setOccupation(e.target.value)} 
                    placeholder="Ex: Jornalista, Analista..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Sobre</Label>
                <Textarea 
                  id="bio" 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  placeholder="Conte um pouco sobre você..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Redes Sociais</Label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={linkedin} 
                      onChange={(e) => setLinkedin(e.target.value)} 
                      placeholder="LinkedIn URL"
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={twitter} 
                      onChange={(e) => setTwitter(e.target.value)} 
                      placeholder="Twitter URL"
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={instagram} 
                      onChange={(e) => setInstagram(e.target.value)} 
                      placeholder="Instagram URL"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={profile.email || ""} 
                  disabled 
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha (opcional)</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Deixe em branco para manter a atual"
                />
              </div>
              
              {password && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required={!!password}
                  />
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">Email</p>
                  <p>{profile.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">ID do Usuário</p>
                  <p className="font-mono text-xs text-muted-foreground">{profile.uid}</p>
                </div>
              </div>
              
              {isOwnProfile && (
                <div className="pt-6 space-y-2 border-t">
                  <Button variant="outline" className="w-full" onClick={() => setIsEditing(true)}>
                    Editar Perfil
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={handleLogout}>
                    Sair
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
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
