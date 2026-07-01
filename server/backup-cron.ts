/**
 * BorghControl - Gerenciador de Cron de Backup
 * Carrega agendamentos do banco e agenda execuções com node-cron
 */
import cron from "node-cron";
import { Pool } from "pg";
import { executarBackup } from "./backup";
import { ENV } from "./_core/env";

// Mapa de tasks ativas: agendamentoId -> task
const tarefasAtivas = new Map<number, cron.ScheduledTask>();

function getPool(): Pool {
  const url = ENV.databaseUrl;
  const isInternal =
    url.includes(".railway.internal") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1");
  return new Pool({
    connectionString: url,
    ssl: isInternal ? undefined : { rejectUnauthorized: false },
    max: 2,
  });
}

// Converter horario HH:MM e diasSemana para expressão cron
// Cron: "minuto hora * * diasSemana"
function buildCronExpression(horario: string, diasSemana: number[] | null): string {
  const [hh, mm] = horario.split(":").map(Number);
  const dias = diasSemana && diasSemana.length > 0 ? diasSemana.join(",") : "*";
  return `${mm} ${hh} * * ${dias}`;
}

export async function iniciarCronBackup(): Promise<void> {
  if (!ENV.databaseUrl) return;

  // Verificar agendamentos a cada minuto
  cron.schedule("* * * * *", async () => {
    await verificarEExecutarAgendamentos();
  });

  console.log("[Backup Cron] Iniciado — verificando agendamentos a cada minuto.");
}

async function verificarEExecutarAgendamentos(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM backup_agendamentos WHERE ativo = true`
    );

    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const diaAtual = agora.getDay(); // 0=Dom, 1=Seg, ...

    for (const ag of res.rows) {
      if (ag.horario !== horaAtual) continue;

      // Verificar dia da semana
      const diasSemana: number[] | null = ag.dias_semana
        ? JSON.parse(ag.dias_semana)
        : null;

      const deveExecutar =
        !diasSemana || diasSemana.length === 0 || diasSemana.includes(diaAtual);

      if (!deveExecutar) continue;

      // Verificar se já executou hoje
      const jaExecutouHoje = await client.query(
        `SELECT id FROM backup_logs
         WHERE agendamento_id = $1
           AND status IN ('sucesso', 'em_andamento')
           AND DATE(iniciado_em) = CURRENT_DATE`,
        [ag.id]
      );

      if (jaExecutouHoje.rows.length > 0) continue;

      console.log(`[Backup Cron] Executando agendamento #${ag.id} às ${horaAtual}`);

      // Executar em background para não bloquear o cron
      executarBackup(
        ag.id,
        "agendado",
        ag.email_destino,
        ag.incluir_sql,
        ag.incluir_csv
      )
        .then(result => {
          console.log(`[Backup Cron] Agendamento #${ag.id}: ${result.mensagem}`);
        })
        .catch(err => {
          console.error(`[Backup Cron] Erro no agendamento #${ag.id}:`, err);
        });
    }
  } catch (err: any) {
    console.error("[Backup Cron] Erro ao verificar agendamentos:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
