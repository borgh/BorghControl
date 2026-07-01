/**
 * BorghControl - Serviço de Backup
 * Gera backup SQL completo + CSVs por tabela e envia por email
 */
import { Pool } from "pg";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");
// archiver v8 usa ZipArchive diretamente
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require("archiver");
import { PassThrough } from "stream";
import { ENV } from "./_core/env";

// ─── Pool compartilhado ───────────────────────────────────────────────────────
function getPool(): Pool {
  const url = ENV.databaseUrl;
  const isInternal =
    url.includes(".railway.internal") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1");
  return new Pool({
    connectionString: url,
    ssl: isInternal ? undefined : { rejectUnauthorized: false },
  });
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface BackupResult {
  sucesso: boolean;
  mensagem: string;
  tamanhoSql?: number;
  totalCsvs?: number;
  emailEnviado?: boolean;
  detalhes?: string;
}

// ─── Gerar SQL de backup (pg_dump via queries SQL) ───────────────────────────
async function gerarSqlBackup(client: any): Promise<string> {
  const linhas: string[] = [];
  const agora = new Date().toISOString();

  linhas.push(`-- BorghControl Database Backup`);
  linhas.push(`-- Gerado em: ${agora}`);
  linhas.push(`-- ================================================`);
  linhas.push(`SET client_encoding = 'UTF8';`);
  linhas.push(`SET standard_conforming_strings = on;`);
  linhas.push(``);

  // Tabelas a exportar (sem imagem_dados para não explodir o arquivo)
  const tabelas = [
    { nome: "users", colunas: "id, \"openId\", name, email, \"loginMethod\", role, ativo, \"createdAt\", \"updatedAt\", \"lastSignedIn\"" },
    { nome: "categorias", colunas: "id, nome, tipo, cor, icone, \"createdAt\"" },
    { nome: "transacoes", colunas: "id, descricao, valor, tipo, status, \"vencimentoTexto\", \"diaVencimento\", \"dataVencimento\", mes, ano, \"categoriaId\", \"formaPagamento\", observacao, recorrente, emitir_nf, prioridade, \"recorrenciaGrupoId\", \"totalParcelas\", \"parcelaAtual\", \"createdAt\", \"updatedAt\"" },
    { nome: "system_config", colunas: "id, config_key, config_value, updated_at" },
    { nome: "socios", colunas: "id, nome, email, telefone, documento, observacao, \"createdAt\", \"updatedAt\"" },
    { nome: "projetos", colunas: "id, nome, descricao, data_inicio, status, imagem_url, imagem_key, imagem_mime, imagem_fit, \"createdAt\", \"updatedAt\"" },
    { nome: "projeto_socios", colunas: "id, projeto_id, socio_id, percentual, \"createdAt\"" },
    { nome: "destinos_investimento", colunas: "id, nome, descricao, \"createdAt\"" },
    { nome: "investimentos", colunas: "id, projeto_id, valor, data, destino_id, socio_id, descricao, \"createdAt\", \"updatedAt\"" },
    { nome: "backup_agendamentos", colunas: "id, ativo, dias_semana, horario, email_destino, incluir_sql, incluir_csv, \"createdAt\", \"updatedAt\"" },
  ];

  for (const tabela of tabelas) {
    try {
      const res = await client.query(`SELECT ${tabela.colunas} FROM "${tabela.nome}" ORDER BY id`);
      if (res.rows.length === 0) continue;

      linhas.push(`-- Tabela: ${tabela.nome} (${res.rows.length} registros)`);
      linhas.push(`DELETE FROM "${tabela.nome}";`);

      for (const row of res.rows) {
        const valores = Object.values(row).map((v: any) => {
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
          if (typeof v === "number") return String(v);
          if (v instanceof Date) return `'${v.toISOString()}'`;
          // Escapar strings
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        linhas.push(`INSERT INTO "${tabela.nome}" (${tabela.colunas}) VALUES (${valores.join(", ")});`);
      }
      linhas.push(``);
    } catch (e: any) {
      linhas.push(`-- ERRO ao exportar ${tabela.nome}: ${e.message}`);
    }
  }

  return linhas.join("\n");
}

// ─── Gerar CSV de uma tabela ──────────────────────────────────────────────────
function gerarCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const linhas = [headers.join(";")];
  for (const row of rows) {
    const valores = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toLocaleString("pt-BR");
      const s = String(v).replace(/"/g, '""');
      if (s.includes(";") || s.includes('"') || s.includes("\n")) return `"${s}"`;
      return s;
    });
    linhas.push(valores.join(";"));
  }
  return linhas.join("\n");
}

// ─── Gerar todos os CSVs ──────────────────────────────────────────────────────
async function gerarCsvs(client: any): Promise<Array<{ nome: string; conteudo: string }>> {
  const csvs: Array<{ nome: string; conteudo: string }> = [];

  const queries: Array<{ arquivo: string; sql: string }> = [
    {
      arquivo: "contas_a_pagar.csv",
      sql: `SELECT t.id, t.descricao, t.valor, t.status, t."diaVencimento", t."dataVencimento", t.mes, t.ano,
              c.nome as categoria, t."formaPagamento", t.observacao, t.recorrente, t.prioridade,
              t."totalParcelas", t."parcelaAtual", t."createdAt", t."updatedAt"
            FROM transacoes t LEFT JOIN categorias c ON c.id = t."categoriaId"
            WHERE t.tipo = 'despesa' ORDER BY t.ano, t.mes, t."diaVencimento"`,
    },
    {
      arquivo: "contas_a_receber.csv",
      sql: `SELECT t.id, t.descricao, t.valor, t.status, t."diaVencimento", t."dataVencimento", t.mes, t.ano,
              c.nome as categoria, t."formaPagamento", t.observacao, t.recorrente,
              t."totalParcelas", t."parcelaAtual", t."createdAt", t."updatedAt"
            FROM transacoes t LEFT JOIN categorias c ON c.id = t."categoriaId"
            WHERE t.tipo = 'receita' ORDER BY t.ano, t.mes, t."diaVencimento"`,
    },
    {
      arquivo: "projetos.csv",
      sql: `SELECT id, nome, descricao, data_inicio, status, imagem_url, imagem_fit, "createdAt", "updatedAt"
            FROM projetos ORDER BY id`,
    },
    {
      arquivo: "socios.csv",
      sql: `SELECT id, nome, email, telefone, documento, observacao, "createdAt", "updatedAt"
            FROM socios ORDER BY id`,
    },
    {
      arquivo: "projeto_socios.csv",
      sql: `SELECT ps.id, p.nome as projeto, s.nome as socio, ps.percentual, ps."createdAt"
            FROM projeto_socios ps
            LEFT JOIN projetos p ON p.id = ps.projeto_id
            LEFT JOIN socios s ON s.id = ps.socio_id
            ORDER BY ps.id`,
    },
    {
      arquivo: "investimentos.csv",
      sql: `SELECT i.id, p.nome as projeto, i.valor, i.data, d.nome as destino, s.nome as socio,
              i.descricao, i."createdAt", i."updatedAt"
            FROM investimentos i
            LEFT JOIN projetos p ON p.id = i.projeto_id
            LEFT JOIN destinos_investimento d ON d.id = i.destino_id
            LEFT JOIN socios s ON s.id = i.socio_id
            ORDER BY i.id`,
    },
    {
      arquivo: "categorias.csv",
      sql: `SELECT id, nome, tipo, cor, icone, "createdAt" FROM categorias ORDER BY tipo, nome`,
    },
    {
      arquivo: "usuarios.csv",
      sql: `SELECT id, "openId", name, email, "loginMethod", role, ativo, "createdAt", "lastSignedIn" FROM users ORDER BY id`,
    },
  ];

  for (const q of queries) {
    try {
      const res = await client.query(q.sql);
      csvs.push({ nome: q.arquivo, conteudo: gerarCsv(res.rows) });
    } catch (e: any) {
      csvs.push({ nome: q.arquivo, conteudo: `ERRO: ${e.message}` });
    }
  }

  return csvs;
}

// ─── Criar ZIP com SQL + CSVs ─────────────────────────────────────────────────
async function criarZip(
  sqlContent: string,
  csvs: Array<{ nome: string; conteudo: string }>,
  incluirSql: boolean,
  incluirCsv: boolean
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on("data", chunk => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on("error", reject);
    archive.pipe(passthrough);

    const dataStr = new Date().toISOString().slice(0, 10);

    if (incluirSql) {
      archive.append(sqlContent, { name: `borghcontrol_backup_${dataStr}.sql` });
    }

    if (incluirCsv) {
      for (const csv of csvs) {
        archive.append(csv.conteudo, { name: `csv/${csv.nome}` });
      }
    }

    archive.finalize();
  });
}

// ─── Enviar email com backup via Resend API (HTTP) ───────────────────────────
async function enviarEmail(
  emailDestino: string,
  zipBuffer: Buffer,
  dataStr: string,
  resumo: string
): Promise<boolean> {
  if (!ENV.resendApiKey) {
    console.warn("[Backup] RESEND_API_KEY não configurada — email não enviado.");
    return false;
  }

  // Resend aceita anexos como base64 via API REST (sem precisar de porta SMTP)
  const zipBase64 = zipBuffer.toString("base64");
  const filename = `borghcontrol_backup_${dataStr}.zip`;

  const body = JSON.stringify({
    from: "BorghControl Backup <onboarding@resend.dev>",
    to: [emailDestino],
    subject: `[BorghControl] Backup do banco de dados — ${dataStr}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">✅ Backup BorghControl</h2>
        <p>O backup foi gerado com sucesso em <strong>${dataStr}</strong>.</p>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:13px">${resumo}</pre>
        <p>O arquivo ZIP com o dump SQL e todos os CSVs está anexado neste email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb">
        <small style="color:#6b7280">BorghControl — Sistema de Controle Financeiro</small>
      </div>
    `,
    attachments: [
      {
        filename,
        content: zipBase64,
      },
    ],
  });

  const https = require("https") as typeof import("https");
  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.resendApiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log("[Backup] Email enviado via Resend:", data);
            resolve();
          } else {
            reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  return true;
}

// ─── Função principal de backup ───────────────────────────────────────────────
export async function executarBackup(
  agendamentoId: number | null,
  tipo: "agendado" | "manual",
  emailDestino: string,
  incluirSql: boolean,
  incluirCsv: boolean
): Promise<BackupResult> {
  const pool = getPool();
  const client = await pool.connect();
  const logPool = getPool();
  const logClient = await logPool.connect();

  // Criar log inicial
  const logRes = await logClient.query(
    `INSERT INTO backup_logs (agendamento_id, status, tipo, iniciado_em)
     VALUES ($1, 'em_andamento', $2, NOW()) RETURNING id`,
    [agendamentoId, tipo]
  );
  const logId = logRes.rows[0].id;

  try {
    const dataStr = new Date().toISOString().slice(0, 10);
    let sqlContent = "";
    let csvs: Array<{ nome: string; conteudo: string }> = [];

    if (incluirSql) {
      sqlContent = await gerarSqlBackup(client);
    }

    if (incluirCsv) {
      csvs = await gerarCsvs(client);
    }

    const zipBuffer = await criarZip(sqlContent, csvs, incluirSql, incluirCsv);
    const tamanhoSql = Buffer.byteLength(sqlContent, "utf8");
    const totalCsvs = csvs.length;

    const resumo = [
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      `Tipo: ${tipo}`,
      incluirSql ? `SQL: ${(tamanhoSql / 1024).toFixed(1)} KB` : "",
      incluirCsv ? `CSVs: ${totalCsvs} arquivos` : "",
      `ZIP total: ${(zipBuffer.length / 1024).toFixed(1)} KB`,
    ]
      .filter(Boolean)
      .join("\n");

    let emailEnviado = false;
    try {
      emailEnviado = await enviarEmail(emailDestino, zipBuffer, dataStr, resumo);
    } catch (emailErr: any) {
      console.error("[Backup] Erro ao enviar email:", emailErr.message);
    }

    // Atualizar log com sucesso
    await logClient.query(
      `UPDATE backup_logs SET status='sucesso', mensagem=$1, detalhes=$2,
       tamanho_sql=$3, total_csvs=$4, email_enviado=$5, finalizado_em=NOW()
       WHERE id=$6`,
      [
        `Backup gerado com sucesso${emailEnviado ? " e enviado por email" : " (email não enviado)"}`,
        resumo,
        tamanhoSql,
        totalCsvs,
        emailEnviado,
        logId,
      ]
    );

    return {
      sucesso: true,
      mensagem: `Backup concluído${emailEnviado ? " e enviado para " + emailDestino : ""}`,
      tamanhoSql,
      totalCsvs,
      emailEnviado,
      detalhes: resumo,
    };
  } catch (err: any) {
    const msg = err?.message ?? "Erro desconhecido";
    await logClient.query(
      `UPDATE backup_logs SET status='erro', mensagem=$1, finalizado_em=NOW() WHERE id=$2`,
      [msg, logId]
    );
    return { sucesso: false, mensagem: msg };
  } finally {
    client.release();
    logClient.release();
    await pool.end();
    await logPool.end();
  }
}

// ─── Verificar próximos agendamentos ─────────────────────────────────────────
export function calcularProximaExecucao(
  diasSemana: number[] | null,
  horario: string
): Date {
  const [hh, mm] = horario.split(":").map(Number);
  // Horários são em BRT (UTC-3). Calcular "agora" em BRT para comparar corretamente.
  const agora = new Date();
  const agoraBRT = new Date(agora.getTime() - 3 * 60 * 60 * 1000);

  // Construir candidato no mesmo dia em BRT
  const candidatoBRT = new Date(agoraBRT);
  candidatoBRT.setUTCHours(hh, mm, 0, 0);

  if (diasSemana === null || diasSemana.length === 0) {
    // Todos os dias
    if (candidatoBRT <= agoraBRT) {
      candidatoBRT.setUTCDate(candidatoBRT.getUTCDate() + 1);
    }
    // Converter de volta para UTC real para retornar como Date
    return new Date(candidatoBRT.getTime() + 3 * 60 * 60 * 1000);
  }

  // Encontrar o próximo dia da semana válido
  for (let i = 0; i <= 7; i++) {
    const d = new Date(agoraBRT);
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(hh, mm, 0, 0);
    if (diasSemana.includes(d.getUTCDay()) && d > agoraBRT) {
      return new Date(d.getTime() + 3 * 60 * 60 * 1000);
    }
  }

  // Fallback: amanhã
  candidatoBRT.setUTCDate(candidatoBRT.getUTCDate() + 1);
  return new Date(candidatoBRT.getTime() + 3 * 60 * 60 * 1000);
}
