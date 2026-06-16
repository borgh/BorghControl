import { useState } from "react";
import { Paperclip, FileText, ImageIcon, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAnexos, Anexo } from "@/hooks/useAnexos";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf")
    return <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  return <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
}

// Modal de visualização de um único anexo
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
            <a
              href={url}
              download={anexo.nome_arquivo}
              className="text-xs text-muted-foreground hover:text-foreground underline flex-shrink-0"
            >
              Baixar
            </a>
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

// Modal de listagem de anexos (quando há mais de um)
function AnexosListModal({
  open,
  onClose,
  transacaoId,
  descricao,
}: {
  open: boolean;
  onClose: () => void;
  transacaoId: number;
  descricao?: string;
}) {
  const { anexos, loading } = useAnexos(open ? transacaoId : null);
  const [viewAnexo, setViewAnexo] = useState<Anexo | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4" />
              Anexos{descricao ? ` · ${descricao}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : anexos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo encontrado.</p>
            ) : (
              anexos.map((anexo) => (
                <div
                  key={anexo.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setViewAnexo(anexo)}
                >
                  {getFileIcon(anexo.mime_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{anexo.nome_arquivo}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.tamanho)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); setViewAnexo(anexo); }}
                    title="Visualizar"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AnexoViewer anexo={viewAnexo} onClose={() => setViewAnexo(null)} />
    </>
  );
}

// Badge compacto para exibir no card da despesa
export function AnexosBadge({
  transacaoId,
  count,
  descricao,
}: {
  transacaoId: number;
  count?: number; // se fornecido, não faz fetch
  descricao?: string;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [viewAnexo, setViewAnexo] = useState<Anexo | null>(null);
  // Só carrega os anexos quando o badge é clicado ou quando count não é fornecido
  const { anexos, loading } = useAnexos(!listOpen && count !== undefined ? null : transacaoId);

  const total = count !== undefined ? count : anexos.length;

  if (total === 0 && !loading) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (total === 1 && anexos.length === 1) {
      // Abre diretamente o visualizador
      setViewAnexo(anexos[0]);
    } else {
      setListOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`${total} anexo(s) — clique para visualizar`}
        className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200 hover:border-slate-400 transition-colors shrink-0"
      >
        <Paperclip className="h-2.5 w-2.5" />
        {total}
      </button>

      {/* Visualizador direto (1 anexo) */}
      <AnexoViewer anexo={viewAnexo} onClose={() => setViewAnexo(null)} />

      {/* Lista de anexos (múltiplos) */}
      <AnexosListModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        transacaoId={transacaoId}
        descricao={descricao}
      />
    </>
  );
}

// Seção de anexos para o modal de detalhe
export function AnexosDetalheSection({ transacaoId }: { transacaoId: number }) {
  const { anexos, loading } = useAnexos(transacaoId);
  const [viewAnexo, setViewAnexo] = useState<Anexo | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando anexos...
      </div>
    );
  }

  if (anexos.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Anexos ({anexos.length})
        </p>
        <div className="space-y-1.5">
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => setViewAnexo(anexo)}
            >
              {getFileIcon(anexo.mime_type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{anexo.nome_arquivo}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.tamanho)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => { e.stopPropagation(); setViewAnexo(anexo); }}
                title="Visualizar"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <AnexoViewer anexo={viewAnexo} onClose={() => setViewAnexo(null)} />
    </>
  );
}
