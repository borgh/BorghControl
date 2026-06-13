CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status_transacao" AS ENUM('pendente', 'pago', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_transacao" AS ENUM('despesa', 'receita');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"tipo" "tipo_transacao" NOT NULL,
	"cor" varchar(7) DEFAULT '#6366f1',
	"icone" varchar(50) DEFAULT 'tag',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"tipo" "tipo_transacao" NOT NULL,
	"status" "status_transacao" DEFAULT 'pendente' NOT NULL,
	"vencimentoTexto" varchar(20),
	"diaVencimento" integer,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"categoriaId" integer,
	"formaPagamento" varchar(50),
	"observacao" text,
	"recorrente" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"passwordHash" varchar(255),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "idx_mes_ano" ON "transacoes" USING btree ("mes","ano");--> statement-breakpoint
CREATE INDEX "idx_tipo" ON "transacoes" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "idx_status" ON "transacoes" USING btree ("status");