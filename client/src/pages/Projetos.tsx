import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Search, LayoutGrid, List, Pencil, Trash2, FolderOpen,
  Users, DollarSign, Calendar, X, Upload, ImageIcon, ChevronDown, ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusProjeto = "em_andamento" | "pendente" | "aguardando_recurso" | "concluido";

const STATUS_LABELS: Record<StatusProjeto, string> = {
  em_andamento: "Em Andamento",
  pendente: "Pendente",
  aguardando_recurso: "Aguardando Recurso",
  concluido: "Concluído",
};

const STATUS_COLORS: Record<StatusProjeto, string> = {
  em_andamento: "bg-blue-100 text-blue-800 border-blue-200",
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  aguardando_recurso: "bg-orange-100 text-orange-800 border-orange-200",
  concluido: "bg-green-100 text-green-800 border-green-200",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ─── Modal de Sócio ──────────────────────────────────────────────────────────
function ModalSocio({ open, onClose, socio, onSaved }: {
  open: boolean; onClose: () => void;
  socio?: { id: number; nome: string; email?: string | null; telefone?: string | null; documento?: string | null; observacao?: string | null } | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(socio?.nome ?? "");
  const [email, setEmail] = useState(socio?.email ?? "");
  const [telefone, setTelefone] = useState(socio?.telefone ?? "");
  const [documento, setDocumento] = useState(socio?.documento ?? "");
  const [observacao, setObservacao] = useState(socio?.observacao ?? "");
  const utils = trpc.useUtils();
  const create = trpc.projetos.createSocio.useMutation({
    onSuccess: () => { toast.success("Sócio cadastrado!"); utils.projetos.listSocios.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.projetos.updateSocio.useMutation({
    onSuccess: () => { toast.success("Sócio atualizado!"); utils.projetos.listSocios.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (socio) {
      update.mutate({ id: socio.id, nome, email: email || undefined, telefone: telefone || undefined, documento: documento || undefined, observacao: observacao || undefined });
    } else {
      create.mutate({ nome, email: email || undefined, telefone: telefone || undefined, documento: documento || undefined, observacao: observacao || undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{socio ? "Editar Sócio" : "Novo Sócio"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></div>
          <div><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div>
          <div><Label>CPF/CNPJ</Label><Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00" /></div>
          <div><Label>Observação</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de Investimento ────────────────────────────────────────────────────
function ModalInvestimento({ open, onClose, projetoId, investimento, projetoSocios, onSaved }: {
  open: boolean; onClose: () => void; projetoId: number;
  investimento?: { id: number; valor: string; data: string; destinoId?: number | null; socioId?: number | null; descricao?: string | null } | null;
  projetoSocios?: Array<{ socioId: number; nome: string }>;
  onSaved: () => void;
}) {
  const [valor, setValor] = useState(investimento?.valor ? String(Number(investimento.valor)) : "");
  const [data, setData] = useState(investimento?.data ?? new Date().toISOString().split("T")[0]);
  const [destinoId, setDestinoId] = useState<string>(investimento?.destinoId ? String(investimento.destinoId) : "");
  const [socioId, setSocioId] = useState<string>(investimento?.socioId ? String(investimento.socioId) : "");
  const [descricao, setDescricao] = useState(investimento?.descricao ?? "");
  const [novoDestino, setNovoDestino] = useState("");
  const [showNovoDestino, setShowNovoDestino] = useState(false);
  const utils = trpc.useUtils();
  const { data: destinos = [], refetch: refetchDestinos } = trpc.projetos.listDestinos.useQuery();
  const createDestino = trpc.projetos.createDestino.useMutation({
    onSuccess: (d) => { refetchDestinos(); setDestinoId(String(d.id)); setNovoDestino(""); setShowNovoDestino(false); toast.success("Destino criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const create = trpc.projetos.createInvestimento.useMutation({
    onSuccess: () => { toast.success("Investimento registrado!"); utils.projetos.listInvestimentos.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.projetos.updateInvestimento.useMutation({
    onSuccess: () => { toast.success("Investimento atualizado!"); utils.projetos.listInvestimentos.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!valor || isNaN(v) || v <= 0) { toast.error("Valor inválido"); return; }
    if (!data) { toast.error("Data é obrigatória"); return; }
    const payload = { valor: String(v), data, destinoId: destinoId ? Number(destinoId) : null, socioId: (socioId && socioId !== "__none__") ? Number(socioId) : null, descricao: descricao || undefined };
    if (investimento) {
      update.mutate({ id: investimento.id, ...payload });
    } else {
      create.mutate({ projetoId, ...payload });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{investimento ? "Editar Investimento" : "Novo Investimento"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Valor (R$) *</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" type="number" step="0.01" min="0" />
          </div>
          <div>
            <Label>Data *</Label>
            <Input value={data} onChange={(e) => setData(e.target.value)} type="date" />
          </div>
          {projetoSocios && projetoSocios.length > 0 && (
            <div>
              <Label>Investidor (Quem fez este investimento)</Label>
              <Select value={socioId} onValueChange={setSocioId}>
                <SelectTrigger><SelectValue placeholder="Selecione o investidor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não especificado</SelectItem>
                  {projetoSocios.map((s) => (
                    <SelectItem key={s.socioId} value={String(s.socioId)}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Destino do Investimento</Label>
            <Select value={destinoId} onValueChange={(v) => { if (v === "__novo__") setShowNovoDestino(true); else setDestinoId(v); }}>
              <SelectTrigger><SelectValue placeholder="Selecione ou crie um destino" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__novo__" className="text-blue-600 font-medium">+ Criar novo destino</SelectItem>
                {destinos.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showNovoDestino && (
              <div className="flex gap-2 mt-2">
                <Input value={novoDestino} onChange={(e) => setNovoDestino(e.target.value)} placeholder="Nome do novo destino" />
                <Button size="sm" onClick={() => { if (novoDestino.trim()) createDestino.mutate({ nome: novoDestino.trim() }); }} disabled={createDestino.isPending}>
                  {createDestino.isPending ? "..." : "Criar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNovoDestino(false)}><X className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Detalhes do investimento..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de Projeto ─────────────────────────────────────────────────────────
function ModalProjeto({ open, onClose, projeto, onSaved, imgBust }: {
  open: boolean; onClose: () => void;
  projeto?: any | null;
  onSaved: (projetoId?: number) => void;
  imgBust?: number;
}) {
  const [nome, setNome] = useState(projeto?.nome ?? "");
  const [descricao, setDescricao] = useState(projeto?.descricao ?? "");
  const [dataInicio, setDataInicio] = useState(projeto?.dataInicio ?? "");
  const [status, setStatus] = useState<StatusProjeto>(projeto?.status ?? "pendente");
  // imagemPreview: data URL para exibir no modal (base64 ou URL da API)
  const [imagemPreview, setImagemPreview] = useState<string | null>(
    projeto?.id ? `/api/projetos/imagem/${projeto.id}?v=${imgBust ?? Date.now()}` : null
  );
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [imagemMime, setImagemMime] = useState<string | null>(null);
  const [imagemFit, setImagemFit] = useState<"cover" | "contain">(projeto?.imagemFit === "contain" ? "contain" : "cover");
  const [uploading, setUploading] = useState(false);
  // Flag para saber se a imagem foi trocada (independente de base64 ou upload direto)
  const imagemFoiTrocadaRef = useRef(false);
  const [selectedSocios, setSelectedSocios] = useState<Array<{ socioId: number; percentual?: number }>>(
    projeto?.socios?.map((s: any) => ({ socioId: s.socioId, percentual: s.percentual ? Number(s.percentual) : undefined })) ?? []
  );
  const [showModalSocio, setShowModalSocio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { data: socios = [], refetch: refetchSocios } = trpc.projetos.listSocios.useQuery();

  const create = trpc.projetos.create.useMutation({
    onSuccess: async () => {
      toast.success("Projeto criado!");
      await utils.projetos.list.invalidate();
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.projetos.update.useMutation({
    onSuccess: async (data) => {
      toast.success("Projeto atualizado!");
      // Se a imagem foi trocada, força reload de todas as <img> que referenciam esse projeto
      // ANTES do invalidate para que o timestamp novo seja aplicado
      if (imagemFoiTrocadaRef.current && data?.id) {
        const ts = Date.now();
        const imgs = document.querySelectorAll<HTMLImageElement>(`img[src*="/api/projetos/imagem/${data.id}"]`);
        imgs.forEach(img => { img.src = `/api/projetos/imagem/${data.id}?t=${ts}`; });
        imagemFoiTrocadaRef.current = false;
      }
      // Usa refetch para garantir dados frescos do servidor imediatamente
      await utils.projetos.list.refetch();
      onSaved(data?.id);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("imagem", file);
      // Se estiver editando um projeto existente, envia o projetoId para salvar direto no banco
      if (projeto?.id) {
        formData.append("projetoId", String(projeto.id));
      }
      const resp = await fetch("/api/projetos/upload-imagem", { method: "POST", body: formData });
      const data = await resp.json();
      if (data.success) {
        if (projeto?.id) {
          // Imagem já foi salva no banco diretamente
          // Atualiza o preview com timestamp para forçar reload do browser
          setImagemPreview(`/api/projetos/imagem/${projeto.id}?t=${Date.now()}`);
          setImagemBase64(null); // não precisa enviar via tRPC
          setImagemMime(null);
          imagemFoiTrocadaRef.current = true; // marca que a imagem foi trocada
          toast.success("Imagem atualizada!");
        } else {
          // Novo projeto: armazena base64 para enviar junto com o create
          setImagemBase64(data.data);
          setImagemMime(data.mime);
          setImagemPreview(data.url);
          toast.success("Imagem selecionada!");
        }
      } else {
        toast.error(data.error ?? "Erro ao enviar imagem");
      }
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const toggleSocio = (socioId: number) => {
    setSelectedSocios((prev) => {
      const exists = prev.find((s) => s.socioId === socioId);
      if (exists) return prev.filter((s) => s.socioId !== socioId);
      return [...prev, { socioId }];
    });
  };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome,
      descricao: descricao || undefined,
      dataInicio: dataInicio || undefined,
      status,
      imagemBase64: imagemBase64 ?? undefined,
      imagemMime: imagemMime ?? undefined,
      imagemFit,
      socioIds: selectedSocios,
    };
    if (projeto) {
      update.mutate({ id: projeto.id, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{projeto ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Imagem */}
            <div>
              <Label>Imagem do Projeto</Label>
              <div
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                style={{ minHeight: 120 }}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagemPreview ? (
                  <div className="relative w-full">
                    <img
                      src={imagemPreview}
                      alt="Imagem do projeto"
                      className={`w-full max-h-48 rounded-md bg-muted ${imagemFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                      style={{ height: 192 }}
                      onError={() => setImagemPreview(null)}
                    />
                    <button
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                      onClick={(e) => { e.stopPropagation(); setImagemPreview(null); setImagemBase64(null); setImagemMime(null); }}
                    ><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {uploading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /> : <ImageIcon className="h-10 w-10" />}
                    <span className="text-sm">{uploading ? "Enviando..." : "Clique para adicionar uma imagem"}</span>
                    <span className="text-xs">JPG, PNG, WEBP ou GIF — máx. 10MB</span>
                  </div>
                )}
              </div>
              {/* Toggle de ajuste de imagem — visível apenas quando há imagem */}
              {imagemPreview && (
                <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-muted-foreground">Ajuste:</span>
                  <div className="flex border rounded-md overflow-hidden text-xs">
                    <button
                      type="button"
                      className={`px-3 py-1.5 transition-colors ${
                        imagemFit === 'cover'
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      }`}
                      onClick={() => setImagemFit('cover')}
                    >
                      Auto ajuste
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 transition-colors border-l ${
                        imagemFit === 'contain'
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      }`}
                      onClick={() => setImagemFit('contain')}
                    >
                      Original
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {imagemFit === 'cover' ? '(preenche o card)' : '(mostra tudo)'}
                  </span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            </div>

            {/* Nome */}
            <div><Label>Nome do Projeto *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Construção Galpão Industrial" /></div>

            {/* Descrição */}
            <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva o projeto..." /></div>

            {/* Data de Início e Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} type="date" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusProjeto)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as StatusProjeto[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sócios */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Sócios do Projeto</Label>
                <Button size="sm" variant="outline" onClick={() => setShowModalSocio(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Novo Sócio
                </Button>
              </div>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-1">
                {socios.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Nenhum sócio cadastrado</p>
                ) : socios.map((s) => {
                  const selected = selectedSocios.find((ss) => ss.socioId === s.id);
                  return (
                    <div key={s.id} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                      onClick={() => toggleSocio(s.id)}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                          {selected && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                        <span className="text-sm font-medium">{s.nome}</span>
                        {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                      </div>
                      {selected && (
                        <Input
                          className="w-20 h-7 text-xs"
                          placeholder="% part."
                          type="number"
                          min="0" max="100" step="0.01"
                          value={selected.percentual ?? ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            const pct = parseFloat(e.target.value);
                            setSelectedSocios((prev) => prev.map((ss) => ss.socioId === s.id ? { ...ss, percentual: isNaN(pct) ? undefined : pct } : ss));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending || uploading}>
              {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ModalSocio open={showModalSocio} onClose={() => setShowModalSocio(false)} onSaved={() => refetchSocios()} />
    </>
  );
}

// ─── Detalhe do Projeto (investimentos) ───────────────────────────────────────
function DetalhesProjeto({ projeto, onClose, onEdit }: { projeto: any; onClose: () => void; onEdit: () => void }) {
  const [showModalInvest, setShowModalInvest] = useState(false);
  const [editInvest, setEditInvest] = useState<any | null>(null);
  const utils = trpc.useUtils();
  const { data: investimentos = [], refetch } = trpc.projetos.listInvestimentos.useQuery({ projetoId: projeto.id });
  const deleteInvest = trpc.projetos.deleteInvestimento.useMutation({
    onSuccess: () => { toast.success("Investimento removido!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const totalInvestido = investimentos.reduce((acc, i) => acc + Number(i.valor), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {projeto.id && (
              <img src={`/api/projetos/imagem/${projeto.id}?v=${projeto.updatedAt ? new Date(projeto.updatedAt).getTime() : projeto.id}`} alt={projeto.nome} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl">{projeto.nome}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs border ${STATUS_COLORS[projeto.status as StatusProjeto]}`}>
                  {STATUS_LABELS[projeto.status as StatusProjeto]}
                </Badge>
                {projeto.dataInicio && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Início: {formatDate(projeto.dataInicio)}
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
          </div>
        </DialogHeader>

        {projeto.descricao && <p className="text-sm text-muted-foreground">{projeto.descricao}</p>}

        {/* Sócios */}
        {projeto.socios && projeto.socios.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Users className="h-4 w-4" /> Sócios</h4>
            <div className="flex flex-wrap gap-2">
              {projeto.socios.map((s: any) => (
                <div key={s.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
                  <span>{s.socioNome}</span>
                  {s.percentual && <span className="text-muted-foreground text-xs">({Number(s.percentual)}%)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investimentos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Investimentos
              <span className="font-normal text-muted-foreground">— Total: {formatCurrency(totalInvestido)}</span>
            </h4>
            <Button size="sm" onClick={() => { setEditInvest(null); setShowModalInvest(true); }}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          {investimentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum investimento registrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {investimentos.map((inv) => (
                <div key={inv.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-green-700 shrink-0">{formatCurrency(Number(inv.valor))}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(inv.data)}</span>
                    </div>
                    {(inv.destinoNome || (inv as any).investidorNome) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {inv.destinoNome && <Badge variant="outline" className="text-xs">{inv.destinoNome}</Badge>}
                        {(inv as any).investidorNome && <Badge variant="secondary" className="text-xs">👤 {(inv as any).investidorNome}</Badge>}
                      </div>
                    )}
                    {inv.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{inv.descricao}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditInvest(inv); setShowModalInvest(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Remover este investimento?")) deleteInvest.mutate({ id: inv.id }); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
      {showModalInvest && (
        <ModalInvestimento
          open={showModalInvest}
          onClose={() => { setShowModalInvest(false); setEditInvest(null); }}
          projetoId={projeto.id}
          investimento={editInvest}
          projetoSocios={projeto.socios?.map((s: any) => ({ socioId: s.socioId, nome: s.socioNome }))}
          onSaved={() => refetch()}
        />
      )}
    </Dialog>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Projetos() {
    const [viewMode, setViewMode] = useState<"lista" | "icones">("icones");
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editProjeto, setEditProjeto] = useState<any | null>(null);
  const [detalheProjeto, setDetalheProjeto] = useState<any | null>(null);
  // Mapa de cache-busting: projetoId → timestamp. Atualizado ao salvar para forçar reload da imagem.
  const [imgBustMap, setImgBustMap] = useState<Record<number, number>>({});
  const utils = trpc.useUtils();
  const { data: projetos = [], isLoading, refetch: refetchProjetos } = trpc.projetos.list.useQuery(busca ? { busca } : undefined);
  const deleteProjeto = trpc.projetos.delete.useMutation({
    onSuccess: () => { toast.success("Projeto removido!"); utils.projetos.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleEdit = (p: any) => {
    setDetalheProjeto(null);
    setEditProjeto(p);
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus projetos e investimentos</p>
        </div>
        <Button onClick={() => { setEditProjeto(null); setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      {/* Filtros e visualização */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar projetos..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={`px-3 py-2 flex items-center gap-1 text-sm transition-colors ${viewMode === "icones" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setViewMode("icones")}
          ><LayoutGrid className="h-4 w-4" /></button>
          <button
            className={`px-3 py-2 flex items-center gap-1 text-sm transition-colors ${viewMode === "lista" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setViewMode("lista")}
          ><List className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : projetos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum projeto encontrado</p>
          <p className="text-sm">Clique em "Novo Projeto" para começar</p>
        </div>
      ) : viewMode === "icones" ? (
        // Visualização em ícones/cards
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projetos.map((p) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setDetalheProjeto(p)}>
              <div className="relative bg-muted overflow-hidden" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                {p.id ? (
                  <img
                    src={`/api/projetos/imagem/${p.id}?v=${imgBustMap[p.id] ?? (p.updatedAt ? new Date(p.updatedAt).getTime() : p.id)}`}
                    alt={p.nome}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105 ${p.imagemFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'absolute inset-0 flex items-center justify-center';
                        placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7l9 6 9-6"/></svg>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="bg-white/90 hover:bg-white rounded p-1 shadow"
                    onClick={(e) => { e.stopPropagation(); handleEdit(p); }}>
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button className="bg-white/90 hover:bg-red-50 text-red-600 rounded p-1 shadow"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${p.nome}"?`)) deleteProjeto.mutate({ id: p.id }); }}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm truncate">{p.nome}</h3>
                <div className="flex items-center justify-between mt-1">
                  <Badge className={`text-xs border ${STATUS_COLORS[p.status as StatusProjeto]}`}>
                    {STATUS_LABELS[p.status as StatusProjeto]}
                  </Badge>
                  <span className="text-xs font-medium text-green-700">{formatCurrency(Number(p.totalInvestido))}</span>
                </div>
                {p.socios && p.socios.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {p.socios.length} sócio{p.socios.length > 1 ? "s" : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Visualização em lista
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Projeto</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Início</th>
                <th className="text-left p-3 font-medium">Sócios</th>
                <th className="text-right p-3 font-medium">Total Investido</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p, idx) => (
                <tr key={p.id} className={`border-t hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  onClick={() => setDetalheProjeto(p)}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.id ? (
                        <img src={`/api/projetos/imagem/${p.id}?v=${imgBustMap[p.id] ?? (p.updatedAt ? new Date(p.updatedAt).getTime() : p.id)}`} alt={p.nome} className="w-8 h-8 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{p.nome}</span>
                        {p.descricao && <p className="text-xs text-muted-foreground truncate max-w-xs">{p.descricao}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={`text-xs border ${STATUS_COLORS[p.status as StatusProjeto]}`}>
                      {STATUS_LABELS[p.status as StatusProjeto]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(p.dataInicio)}</td>
                  <td className="p-3">
                    {p.socios && p.socios.length > 0 ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" /> {p.socios.length}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-right font-semibold text-green-700">{formatCurrency(Number(p.totalInvestido))}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Excluir "${p.nome}"?`)) deleteProjeto.mutate({ id: p.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {showModal && (
        <ModalProjeto
          open={showModal}
          onClose={() => { setShowModal(false); setEditProjeto(null); }}
          projeto={editProjeto}
          imgBust={editProjeto?.id ? imgBustMap[editProjeto.id] : undefined}
          onSaved={(projetoId?: number) => {
            if (projetoId) setImgBustMap(prev => ({ ...prev, [projetoId]: Date.now() }));
            utils.projetos.list.invalidate();
            refetchProjetos();
          }}
        />
      )}
      {detalheProjeto && (
        <DetalhesProjeto
          projeto={detalheProjeto}
          onClose={() => setDetalheProjeto(null)}
          onEdit={() => handleEdit(detalheProjeto)}
        />
      )}
    </div>
  );
}
