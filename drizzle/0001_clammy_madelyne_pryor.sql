CREATE TABLE `apartamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(20) NOT NULL,
	`bloco` varchar(20),
	`responsavel` varchar(120),
	`status` enum('participante','nao_participante') NOT NULL DEFAULT 'participante',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apartamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sorteios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`realizadoEm` timestamp NOT NULL DEFAULT (now()),
	`totalParticipantes` int NOT NULL,
	`totalVagas` int NOT NULL,
	`responsavelId` int,
	`responsavelNome` varchar(120),
	`resultado` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sorteios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vagas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(20) NOT NULL,
	`descricao` text,
	`status` enum('ativa','inativa') NOT NULL DEFAULT 'ativa',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vagas_id` PRIMARY KEY(`id`)
);
