import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Paperclip, Trash2, Eye, FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { invalidateAnexosCache } from "@/hooks/useAnexos";

interface Anexo {
  id: number;
  transacao_id: number;
  nome_arquivo: string;
  mime_type: string;
  tamanho: number;
  created_at: string;
}

interface AnexosUploadProps {
  transacaoId: number | null; // null = novo lançamento (upload após salvar)
  onPendingFiles?: (files: File[]) => void; // callback para novo lançamento
  pendingFiles?: File[]; // arquivos pendentes (antes de salvar)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <ImageIcon className="h-4 w-4 text-blue-500" />;
}

// Modal de visualização
function AnexoViewer({ anexo, onClose }: { anexo: Anexo | null; onClose: () => void }) {
  if (!anexo) return null;
  const url = `/api/anexos/view/${anexo.id}`;
  const isPdf = anexo.mime_type === "application/pdf";

  return (
    <Dialog open={!!anexo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium truncate pr-4 flex items-center gap-2">
              {getFileIcon(anexo.mime_type)}
              {anexo.nome_arquivo}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={url}
                download={anexo.nome_arquivo}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Baixar
              </a>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden min-h-0 bg-muted/30">
          {isPdf ? (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              className="w-full h-full min-h-[60vh]"
              title={anexo.nome_arquivo}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[60vh] p-4">
              <img
                src={url}
                alt={anexo.nome_arquivo}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnexosUpload({ transacaoId, onPendingFiles, pendingFiles = [] }: AnexosUploadProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewAnexo, setViewAnexo] = useState<Anexo | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega lista de anexos quando há transacaoId
  const loadAnexos = useCallback(async () => {
    if (!transacaoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/anexos/list/${transacaoId}`);
      if (!res.ok) throw new Error("Erro ao carregar anexos");
      const data = await res.json();
      setAnexos(data.anexos || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [transacaoId]);

  useEffect(() => {
    loadAnexos();
  }, [loadAnexos]);

  const validateFile = (file: File): string | null => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      return `"${file.name}" não é permitido. Use imagem (JPG, PNG, GIF, WEBP) ou PDF.`;
    }
    if (file.size > 5 * 1024 * 1024) {
      return `"${file.name}" excede o limite de 5MB (${formatBytes(file.size)}).`;
    }
    return null;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const err = validateFile(file);
      if (err) {
        toast.error(err);
        return;
      }
    }

    // Se não tem transacaoId ainda (novo lançamento), apenas guarda pendente
    if (!transacaoId) {
      onPendingFiles?.([...pendingFiles, ...fileArray]);
      return;
    }

    // Faz upload imediato
    setUploading(true);
    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("arquivo", file);
        const res = await fetch(`/api/anexos/upload/${transacaoId}`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Erro ao enviar arquivo.");
          return;
        }
        toast.success(`"${file.name}" anexado com sucesso!`);
        if (transacaoId) invalidateAnexosCache(transacaoId);
      }
      await loadAnexos();
    } catch {
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Remover o anexo "${nome}"?`)) return;
    try {
      const res = await fetch(`/api/anexos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Anexo removido.");
      if (transacaoId) invalidateAnexosCache(transacaoId);
      setAnexos((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Erro ao remover anexo.");
    }
  };

  const removePending = (index: number) => {
    const updated = pendingFiles.filter((_, i) => i !== index);
    onPendingFiles?.(updated);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const totalAnexos = anexos.length + pendingFiles.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Anexos
          {totalAnexos > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {totalAnexos}
            </span>
          )}
        </label>
        <span className="text-xs text-muted-foreground">JPG, PNG, PDF • máx. 5MB</span>
      </div>

      {/* Área de drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground text-center">
          {uploading ? "Enviando..." : "Clique ou arraste arquivos aqui"}
        </p>
      </div>

      {/* Lista de anexos salvos */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando anexos...
        </div>
      ) : (
        <>
          {/* Arquivos já salvos */}
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
            >
              <div className="flex-shrink-0">{getFileIcon(anexo.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{anexo.nome_arquivo}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.tamanho)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setViewAnexo(anexo)}
                  title="Visualizar"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(anexo.id, anexo.nome_arquivo)}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {/* Arquivos pendentes (novo lançamento) */}
          {pendingFiles.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2"
            >
              <div className="flex-shrink-0">{getFileIcon(file.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-[10px] text-amber-600">{formatBytes(file.size)} · Será salvo ao criar</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-600 hover:text-destructive flex-shrink-0"
                onClick={() => removePending(i)}
                title="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </>
      )}

      {/* Modal de visualização */}
      <AnexoViewer anexo={viewAnexo} onClose={() => setViewAnexo(null)} />
    </div>
  );
}

// Função utilitária para fazer upload de arquivos pendentes após criar a transação
export async function uploadPendingAnexos(transacaoId: number, files: File[]): Promise<void> {
  for (const file of files) {
    const formData = new FormData();
    formData.append("arquivo", file);
    const res = await fetch(`/api/anexos/upload/${transacaoId}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ao enviar "${file.name}"`);
    }
  }
}
