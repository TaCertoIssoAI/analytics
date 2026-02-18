import { Header } from "@/components/Header";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Search, Users, BadgeCheck, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { getTopReviewers, getCommunityMembers, TopReviewersResponse, UserProfile } from "@/auth/userService";
import { getValidPhotoUrl } from "@/lib/utils";
import { useCachedData } from "@/hooks/useCachedData";

const SkeletonCard = ({ delay }: { delay: number }) => (
  <div
    className="flex items-center gap-4 p-4 rounded-xl border bg-card overflow-hidden"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="h-12 w-12 rounded-full bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${delay}ms` }} />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-32 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${delay + 100}ms` }} />
      <div className="h-3 w-24 rounded bg-muted animate-[skeleton_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${delay + 200}ms` }} />
    </div>
  </div>
);

const Community = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const LIMIT = 12;

  // Top reviewers (cached)
  const fetchTopReviewers = useCallback(async () => {
    return await getTopReviewers();
  }, []);

  const { data: topReviewersData } = useCachedData<TopReviewersResponse>(
    'tacerto-top-reviewers',
    fetchTopReviewers,
    { reviewers: [], period: 'week' }
  );

  // Fetch community members
  const fetchMembers = useCallback(async (searchTerm: string, page: number) => {
    setLoading(true);
    try {
      const offset = (page - 1) * LIMIT;
      const result = await getCommunityMembers(LIMIT, offset, searchTerm);
      setMembers(result.users);
      setTotal(result.total);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to page 1 on search change
  useEffect(() => {
    setCurrentPage(1);
    const debounce = setTimeout(() => {
      fetchMembers(searchQuery, 1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, fetchMembers]);

  // Fetch when page changes (but not on search — that resets to 1)
  const goToPage = (page: number) => {
    setCurrentPage(page);
    fetchMembers(searchQuery, page);
    // Scroll to top of members section
    document.getElementById("members-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalPages = Math.ceil(total / LIMIT);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Get top reviewer UIDs for badge display
  const topReviewerUids = new Set(topReviewersData.reviewers.map(r => r.user.uid));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Comunidade</h1>
            </div>
            <p className="text-muted-foreground ml-[52px]">
              Conheça os revisores que fazem parte da plataforma
            </p>
          </div>
          <Button asChild>
            <Link to="/seja-um-revisor">Como se tornar um revisor</Link>
          </Button>
        </div>

        {/* Top Reviewers Section */}
        {topReviewersData.reviewers.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">
                {topReviewersData.period === 'week' ? 'Top Revisores da Semana' : 'Top Revisores'}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topReviewersData.reviewers.map((reviewer, index) => (
                <Link
                  key={reviewer.user.uid}
                  to={`/perfil/${reviewer.user.uid}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarImage src={getValidPhotoUrl(reviewer.user.photoURL)} alt={reviewer.user.displayName || "User"} />
                      <AvatarFallback className="text-lg">{reviewer.user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {index < 3 && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] font-bold text-yellow-950 px-1.5 rounded-full shadow-sm border border-white">
                        {index + 1}º
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold truncate group-hover:text-primary transition-colors">
                        {reviewer.user.displayName}
                      </span>
                      <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {reviewer.user.occupation || "Membro da comunidade"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary text-lg">{reviewer.count}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avaliações</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Members Section */}
        <div id="members-section">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                Todos os Revisores {total > 0 && <span className="text-muted-foreground font-normal text-base">({total})</span>}
              </h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ocupação..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} delay={i * 150} />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "Nenhum revisor encontrado para essa busca." : "Nenhum revisor cadastrado ainda."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Link
                    key={member.uid}
                    to={`/perfil/${member.uid}`}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarImage src={getValidPhotoUrl(member.photoURL)} alt={member.displayName || "User"} />
                      <AvatarFallback className="text-lg">{member.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold truncate group-hover:text-primary transition-colors">
                          {member.displayName || "Sem nome"}
                        </span>
                        {topReviewerUids.has(member.uid) && (
                          <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      {member.occupation && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Briefcase className="h-3 w-3 flex-shrink-0" />
                          {member.occupation}
                        </p>
                      )}
                      {!member.occupation && (
                        <p className="text-xs text-muted-foreground truncate">
                          Membro da comunidade
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-8">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {getPageNumbers().map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground select-none">…</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => goToPage(page as number)}
                      >
                        {page}
                      </Button>
                    )
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Community;
