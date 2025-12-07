import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserProfile, createUserProfile, UserProfile } from "@/auth/userService";
import { User } from "firebase/auth";

const Profile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const { updateUserProfile, updateUserPassword } = useAuth();

  const isOwnProfile = currentUser?.uid === id;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      setLoading(true);
      console.log("Fetching profile for ID:", id);
      console.log("Current User:", currentUser?.uid);
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
            createdAt: Date.now(),
          };
        }
        
        setProfile(userProfile);
        if (userProfile?.displayName) {
          setName(userProfile.displayName);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Update Name
      if (name !== profile?.displayName) {
        await updateUserProfile(name);
      }
      
      // Update Password
      if (password) {
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem");
          setIsSaving(false);
          return;
        }
        await updateUserPassword(password);
      }
      
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
      setPassword("");
      setConfirmPassword("");
      
      // Refresh profile data locally
      setProfile(prev => prev ? { ...prev, displayName: name } : null);
      
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
    <div className="container mx-auto p-4 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Perfil do Usuário</CardTitle>
          <CardDescription>Gerencie suas informações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
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
              
              <div className="flex gap-2 pt-2">
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
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Nome</p>
                <p className="text-lg font-medium">{profile.displayName || "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{profile.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">ID do Usuário</p>
                <p className="text-xs font-mono text-muted-foreground">{profile.uid}</p>
              </div>
              
              {isOwnProfile && (
                <div className="pt-4 space-y-2">
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
    </div>
  );
};

export default Profile;
