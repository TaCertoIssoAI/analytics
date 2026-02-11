import { Header } from "@/components/Header";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllUsers, setUserRole, createUser, deleteUser, UserProfile, CreateUserRequest } from "@/auth/userService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShieldCheck, ShieldMinus, Search, User as UserIcon, Plus, Trash2, X, Upload, Camera, Database, FileText, CheckCircle, XCircle, Eye, Info } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    photoURL: '',
    role: 'user'
  });
  const [isCreating, setIsCreating] = useState(false);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Search State
  const [adminSearchTerm, setAdminSearchTerm] = useState("");
  const [adminSearchResult, setAdminSearchResult] = useState<any>(null);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  const [adminSearchError, setAdminSearchError] = useState("");

  // Inconsistency Check State
  const [inconsistencyLoading, setInconsistencyLoading] = useState(false);
  const [inconsistencyResult, setInconsistencyResult] = useState<any>(null);
  const [showInconsistencyDialog, setShowInconsistencyDialog] = useState(false);
  const [selectedInconsistency, setSelectedInconsistency] = useState<any>(null); // For detailed view
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);



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
        setNewUser({ email: '', password: '', displayName: '', photoURL: '', role: 'user' }); // Reset form
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

  const handleAdminSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSearchTerm.trim()) return;

    setAdminSearchLoading(true);
    setAdminSearchResult(null);
    setAdminSearchError("");

    try {
        const token = await getToken();
        if (!token) {
            toast.error("Sessão expirada");
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/analises/admin/search?document_id=${adminSearchTerm}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Erro ao buscar análise");

        const data = await response.json();
        if (data.success) {
            setAdminSearchResult(data.data);
            if (!data.data.bigquery_exists && !data.data.firestore_exists) {
                setAdminSearchError("Análise não encontrada em nenhuma base.");
            }
        }
    } catch (error) {
        console.error("Error searching analysis:", error);
        setAdminSearchError("Erro ao buscar análise. Verifique o ID.");
    } finally {
        setAdminSearchLoading(false);
    }
  };

  const handleCheckInconsistencies = async () => {
    setInconsistencyLoading(true);
    setInconsistencyResult(null);
    setShowInconsistencyDialog(true);

    try {
        const token = await getToken();
        if (!token) {
            toast.error("Sessão expirada");
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/analises/admin/inconsistencies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Erro ao verificar inconsistências");

        const data = await response.json();
        if (data.success) {
            setInconsistencyResult(data.data);
        }
    } catch (error) {
        console.error("Error checking inconsistencies:", error);
        toast.error("Erro ao verificar inconsistências");
    } finally {
        setInconsistencyLoading(false);
    }
  };

  const handleShowDetails = async (docId: string, source: string) => {
    // Determine where to fetch details from based on where it EXISTS
    // If missing in Firestore, it exists in BigQuery, and vice versa.
    const existsIn = source === 'Firestore' ? 'firestore' : 'bigquery'; 
    // Wait, the 'source' in the inconsistency list is the one where it EXISTS (based on my previous code: 'source': 'BigQuery' means it is missing in Firestore)
    
    // Let's re-verify the earlier logic:
    // missing_in_firestore -> source="BigQuery"
    // missing_in_bigquery -> source="Firestore"
    
    // So if source is BigQuery, we fetch from BigQuery.
    // However, we don't have a direct "get raw json" endpoint for admin yet, but we can reuse search?
    // Actually, search returns formatted data.
    // For now, let's use the search endpoint which returns data from both if available.
    
    setLoading(true); // Reuse main loading or create a new one? Let's use a local one or just reuse adminSearch capabilities?
    // Let's just set the ID in the search box and trigger search? 
    // No, user wants a specific modal.
    
    // Let's fetch the data using the search endpoint as it already retrieves data.
    try {
        const token = await getToken();
        if (!token) return;
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/analises/admin/search?document_id=${docId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                setSelectedInconsistency(data.data);
                setShowDetailsDialog(true);
            }
        }
    } catch (e) {
        toast.error("Erro ao buscar detalhes");
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteAnalysis = async (docId: string, context: 'inconsistency' | 'search' = 'search') => {
      const confirmMessage = context === 'inconsistency' 
        ? `Tem certeza que deseja apagar a análise ${docId}? Me certifiquei que ela realmente é uma inconsistência.`
        : `Tem certeza que deseja apagar a análise ${docId}? Esta ação não pode ser desfeita.`;

      if (!confirm(confirmMessage)) return;

      setIsDeleting(true);
      try {
          const token = await getToken();
          if (!token) return;

          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const response = await fetch(`${apiUrl}/analises/${docId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
              toast.success("Análise removida com sucesso");
              
              if (context === 'inconsistency') {
                  handleCheckInconsistencies();
              } else {
                  setAdminSearchResult(null);
                  setAdminSearchTerm("");
              }
          } else {
              throw new Error("Erro ao deletar");
          }
      } catch (e) {
          toast.error("Erro ao deletar análise");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleResolveAllInconsistencies = async () => {
      if (!confirm(`Tem certeza que deseja apagar TODAS as ${inconsistencyResult?.inconsistencies?.length} inconsistências? Isso removerá os registros excedentes de onde eles existirem.`)) return;

      setIsDeleting(true);
      try {
          const token = await getToken();
          if (!token) return;

          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const response = await fetch(`${apiUrl}/analises/admin/inconsistencies`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
              const data = await response.json();
              toast.success(`Resolvido! Removidos: ${data.data.total_resolved}`);
              handleCheckInconsistencies();
          } else {
              throw new Error("Erro ao resolver inconsistências");
          }
      } catch (e) {
          toast.error("Erro ao resolver inconsistências");
      } finally {
          setIsDeleting(false);
      }
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
    setNewUser({ ...newUser, photoURL: croppedImage });
    setShowCropper(false);
    setTempImage(null);
    toast.success("Imagem recortada com sucesso!");
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

        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Buscar Análise por ID
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAdminSearch} className="flex gap-4 mb-4">
                    <Input 
                        placeholder="Cole o ID do documento aqui (ex: 556fb9c4-645d-4f81-a75d-357422dc081e)"
                        value={adminSearchTerm}
                        onChange={(e) => setAdminSearchTerm(e.target.value)}
                        className="max-w-xl"
                    />
                    <Button type="submit" disabled={adminSearchLoading}>
                        {adminSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar
                    </Button>
                </form>

                {adminSearchError && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-4 flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        {adminSearchError}
                    </div>
                )}

                {adminSearchResult && (
                    <div className="border rounded-md p-4 bg-card">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Document ID</h3>
                                    <p className="font-mono text-lg">{adminSearchResult.document_id}</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className={`flex items-center gap-2 p-3 rounded-md border ${adminSearchResult.bigquery_exists ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                                        {adminSearchResult.bigquery_exists ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                        <div className="flex flex-col">
                                            <span className="font-bold">BigQuery</span>
                                            <span className="text-xs">Analytics & Histórico</span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-2 p-3 rounded-md border ${adminSearchResult.firestore_exists ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                                        {adminSearchResult.firestore_exists ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                        <div className="flex flex-col">
                                            <span className="font-bold">Firestore</span>
                                            <span className="text-xs">App & Tempo Real</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {adminSearchResult.analise && (
                                <div className="space-y-2 border-l pl-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Dados da Análise
                                        </h3>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedInconsistency(adminSearchResult);
                                                    setShowDetailsDialog(true);
                                                }}
                                                title="Ver JSON da Análise"
                                            >
                                                <Info className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="destructive" 
                                                size="sm"
                                                onClick={() => handleDeleteAnalysis(adminSearchResult.document_id, 'search')}
                                                disabled={isDeleting}
                                                title="Apagar Análise"
                                            >
                                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Data:</span>
                                            <p>{adminSearchResult.analise.processed_at ? format(new Date(adminSearchResult.analise.processed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Veredito:</span>
                                            <p className="font-bold">{adminSearchResult.analise.overall_verdict}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">Título/Resumo:</span>
                                            <p className="line-clamp-2">{adminSearchResult.analise.analysis_title || adminSearchResult.analise.user_message_text}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="mt-4" asChild>
                                        <a href={`/verificacao/${adminSearchResult.document_id}`} target="_blank" rel="noopener noreferrer">
                                            Ver Página Pública
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <div className="flex justify-end mb-8">
            <Dialog open={showInconsistencyDialog} onOpenChange={setShowInconsistencyDialog}>
                <DialogTrigger asChild>
                    <Button variant="outline" onClick={handleCheckInconsistencies} className="gap-2">
                        <ShieldMinus className="h-4 w-4" />
                        Verificar Inconsistências
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Relatório de Inconsistências</DialogTitle>
                        <DialogDescription>
                            Comparação entre registros do BigQuery (Analytics) e Firestore (App).
                        </DialogDescription>
                    </DialogHeader>
                    
                    {inconsistencyLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Verificando consistência dos bancos...</p>
                        </div>
                    ) : inconsistencyResult ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-secondary/20 border text-center">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Total BigQuery</h4>
                                    <p className="text-2xl font-bold">{inconsistencyResult.stats.total_bigquery}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-secondary/20 border text-center">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Firestore</h4>
                                    <p className="text-2xl font-bold">{inconsistencyResult.stats.total_firestore}</p>
                                </div>
                            </div>
                            
                    {inconsistencyResult.total_inconsistencies === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-semibold">Tudo Certo!</h3>
                            <p className="text-muted-foreground">Nenhuma inconsistência encontrada entre os bancos.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-md font-semibold flex items-center gap-2 text-destructive">
                                    <XCircle className="h-5 w-5" />
                                    {inconsistencyResult.total_inconsistencies} Inconsistências Encontradas
                                </h3>
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={handleResolveAllInconsistencies}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                    Resolver Todas
                                </Button>
                            </div>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Document ID</TableHead>
                                            <TableHead>Problema</TableHead>
                                            <TableHead>Origem Existente</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inconsistencyResult.inconsistencies.map((item: any) => (
                                            <TableRow key={item.document_id}>
                                                <TableCell className="font-mono text-xs">{item.document_id}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                                        {item.issue === 'Missing in Firestore' ? 'Falta no Firestore' : 'Falta no BigQuery'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{item.source}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => handleShowDetails(item.document_id, item.source)}
                                                            title="Ver Detalhes"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            <span className="sr-only">Ver Detalhes</span>
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            title="Apagar Inconsistência"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Apagar</span>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
            
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Detalhes da Análise: {selectedInconsistency?.document_id}
                        </DialogTitle>
                        <DialogDescription>
                            Dados recuperados via busca administrativa.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedInconsistency && (
                        <Tabs defaultValue={selectedInconsistency.bigquery_exists ? "bigquery" : "firestore"} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="bigquery" disabled={!selectedInconsistency.bigquery_exists}>
                                    BigQuery {selectedInconsistency.bigquery_exists ? '✅' : '❌'}
                                </TabsTrigger>
                                <TabsTrigger value="firestore" disabled={!selectedInconsistency.firestore_exists}>
                                    Firestore {selectedInconsistency.firestore_exists ? '✅' : '❌'}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="bigquery">
                                <div className="space-y-4 mt-4">
                                    <div className={`p-4 rounded border ${selectedInconsistency.bigquery_exists ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            {selectedInconsistency.bigquery_exists ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            Dados do BigQuery
                                        </h4>
                                        <p className="text-xs text-muted-foreground">Fonte: Data Warehouse (Analytics)</p>
                                    </div>
                                    
                                    {selectedInconsistency.bigquery_data ? (
                                        <div className="rounded-md border bg-muted/50 p-4 overflow-auto">
                                            <pre className="text-xs font-mono whitespace-pre-wrap max-h-[400px]">
                                                {JSON.stringify(selectedInconsistency.bigquery_data, null, 2)}
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                                            Dados do BigQuery não disponíveis.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="firestore">
                                <div className="space-y-4 mt-4">
                                    <div className={`p-4 rounded border ${selectedInconsistency.firestore_exists ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                        <h4 className="font-bold mb-2 flex items-center gap-2">
                                            {selectedInconsistency.firestore_exists ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            Dados do Firestore
                                        </h4>
                                        <p className="text-xs text-muted-foreground">Fonte: Banco de Dados da Aplicação (Tempo Real)</p>
                                    </div>

                                    {selectedInconsistency.firestore_data ? (
                                        <div className="rounded-md border bg-muted/50 p-4 overflow-auto">
                                            <pre className="text-xs font-mono whitespace-pre-wrap max-h-[400px]">
                                                {JSON.stringify(selectedInconsistency.firestore_data, null, 2)}
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                                            Dados do Firestore não disponíveis.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
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
                                <Label>Foto de Perfil (Opcional):</Label>
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-16 w-16 border-2 border-muted">
                                    <AvatarImage src={getValidPhotoUrl(newUser.photoURL)} />
                                    <AvatarFallback>
                                      {newUser.displayName ? newUser.displayName.charAt(0).toUpperCase() : <UserIcon className="h-8 w-8 text-muted-foreground" />}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex flex-col gap-2">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => fileInputRef.current?.click()}
                                    >
                                      <Upload className="h-4 w-4 mr-2" />
                                      Carregar Foto
                                    </Button>
                                    {newUser.photoURL && (
                                      <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-destructive hover:text-destructive h-auto p-0 px-2"
                                        onClick={() => setNewUser({...newUser, photoURL: ''})}
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
      
      <ImageCropper
        open={showCropper}
        imageSrc={tempImage}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default Admin;
