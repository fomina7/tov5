CREATE TABLE `botConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`avatar` varchar(512) NOT NULL,
	`difficulty` enum('beginner','medium','pro') NOT NULL DEFAULT 'medium',
	`personality` varchar(64) NOT NULL DEFAULT 'balanced',
	`isActive` boolean NOT NULL DEFAULT true,
	`gamesPlayed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `botConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rakeLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableId` int NOT NULL,
	`handNumber` int NOT NULL,
	`potAmount` bigint NOT NULL,
	`rakeAmount` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rakeLedger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gameTables` ADD `rakePercentage` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `gameTables` ADD `rakeCap` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gameTables` ADD `botsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `gameTables` ADD `botCount` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `gameTables` ADD `botDifficulty` enum('beginner','medium','pro','mixed') DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `rakebackBalance` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalRakeGenerated` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `rakebackPercentage` int DEFAULT 10 NOT NULL;