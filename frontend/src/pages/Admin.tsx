import { Header } from "@/components/Header";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { getAllUsers, setUserRole, createUser, deleteUser, UserProfile, CreateUserRequest } from "@/auth/userService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShieldCheck, ShieldMinus, Search, User as UserIcon, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getValidPhotoUrl } from "@/lib/utils";

const Admin = () => {
  const { getToken, currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  
  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    email: '',
    password: '',
    displayName: '',
    role: 'user'
  });
  const [isCreating, setIsCreating] = useState(false);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await getAllUsers(token, 100); // Fetch up to 100 users for now
      setUsers(response.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'user') => {
    setProcessingUid(uid);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Sessão expirada");
        return;
      }

      const success = await setUserRole(token, uid, newRole);
      
      if (success) {
        toast.success(`Usuário ${newRole === 'admin' ? 'promovido a Admin' : 'removido de Admin'}`);
        // Update local state
        setUsers(users.map(u => 
          u.uid === uid ? { ...u, role: newRole } : u
        ));
      } else {
        toast.error("Erro ao atualizar permissões");
      }
    } catch (error) {
      console.error("Error changing role:", error);
      toast.error("Erro ao atualizar permissões");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.displayName) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Sessão expirada");
        return;
      }

      const result = await createUser(token, newUser);

      if (result.success) {
        toast.success("Usuário criado com sucesso!");
        setIsAddUserOpen(false);
        setNewUser({ email: '', password: '', displayName: '', role: 'user' }); // Reset form
        fetchUsers(); // Reload list
      } else {
        toast.error(result.message || "Erro ao criar usuário");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Erro ao criar usuário");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Sessão expirada");
        return;
      }

      const result = await deleteUser(token, userToDelete.uid);

      if (result.success) {
        toast.success("Usuário deletado com sucesso!");
        setUsers(users.filter(u => u.uid !== userToDelete.uid));
        setUserToDelete(null);
      } else {
        toast.error(result.message || "Erro ao deletar usuário");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao deletar usuário");
    } finally {
      setIsDeleting(false);
    }
  };



  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header />
      
      <div className="container mx-auto p-4 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Painel Administrativo
          </h1>
          <div className="text-sm text-muted-foreground">
            Total de usuários: {users.length}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Buscar usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    />
                </div>
                
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Usuário
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                            <DialogDescription>
                                Preencha os dados abaixo para criar um novo usuário no sistema.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome: *</Label>
                                <Input 
                                    id="name" 
                                    value={newUser.displayName} 
                                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email: *</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    value={newUser.email} 
                                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha: *</Label>
                                <Input 
                                    id="password" 
                                    type="password"
                                    minLength={6}
                                    value={newUser.password} 
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Função:</Label>
                                <Select 
                                    value={newUser.role} 
                                    onValueChange={(val: 'admin' | 'user') => setNewUser({...newUser, role: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a função" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">Usuário</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Criar Usuário
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Membro desde</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.uid}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={getValidPhotoUrl(user.photoURL)} />
                                <AvatarFallback>
                                  {user.displayName?.charAt(0).toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.displayName || "Sem nome"}</div>
                                <div className="text-xs text-muted-foreground md:hidden">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                          <TableCell>
                            {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {user.role === 'admin' ? (
                              <Badge variant="destructive">Admin</Badge>
                            ) : (
                              <Badge variant="secondary">Usuário</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.uid !== currentUser?.uid && (
                              <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant={user.role === 'admin' ? "outline" : "default"}
                                    size="sm"
                                    disabled={processingUid === user.uid}
                                    onClick={() => handleRoleChange(user.uid, user.role === 'admin' ? 'user' : 'admin')}
                                  >
                                    {processingUid === user.uid ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : user.role === 'admin' ? (
                                      <>
                                        <ShieldMinus className="h-4 w-4 md:mr-2" />
                                        <span className="hidden md:inline">Remover Admin</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-4 w-4 md:mr-2" />
                                        <span className="hidden md:inline">Promover Admin</span>
                                      </>
                                    )}
                                  </Button>
                                  
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => setUserToDelete(user)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                    Isso excluirá permanentemente o usuário <strong>{userToDelete?.displayName || userToDelete?.email}</strong>.
                    Esta ação não pode ser desfeita.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={(e) => {
                        e.preventDefault();
                        handleDeleteUser();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sim, excluir usuário
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
