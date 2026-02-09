import { Header } from "@/components/Header";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { getAllUsers, setUserRole, UserProfile } from "@/auth/userService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShieldCheck, ShieldMinus, Search, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Admin = () => {
  const { getToken, currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingUid, setProcessingUid] = useState<string | null>(null);

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
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
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
                                <AvatarImage src={user.photoURL} />
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
                                    <ShieldMinus className="h-4 w-4 mr-2" />
                                    Remover Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Promover Admin
                                  </>
                                )}
                              </Button>
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
    </div>
  );
};

export default Admin;
