CREATE TABLE `adminLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(256) NOT NULL,
	`targetUserId` int,
	`targetTableId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameTables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`gameType` enum('holdem','omaha') NOT NULL DEFAULT 'holdem',
	`tableSize` enum('2','4','6','9') NOT NULL DEFAULT '6',
	`smallBlind` int NOT NULL,
	`bigBlind` int NOT NULL,
	`minBuyIn` int NOT NULL,
	`maxBuyIn` int NOT NULL,
	`status` enum('waiting','playing','paused') NOT NULL DEFAULT 'waiting',
	`playerCount` int NOT NULL DEFAULT 0,
	`gameState` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gameTables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableId` int NOT NULL,
	`handNumber` int NOT NULL,
	`handData` json NOT NULL,
	`potTotal` bigint NOT NULL,
	`winnerId` int,
	`winnerName` varchar(128),
	`winningHand` varchar(128),
	`rakeAmount` int NOT NULL DEFAULT 0,
	`playedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tablePlayers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableId` int NOT NULL,
	`userId` int NOT NULL,
	`seatIndex` int NOT NULL,
	`chipStack` bigint NOT NULL,
	`isBot` boolean NOT NULL DEFAULT false,
	`botName` varchar(64),
	`botAvatar` varchar(512),
	`botDifficulty` enum('beginner','medium','pro'),
	`status` enum('active','sitting_out','disconnected') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tablePlayers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdraw','buy_in','cash_out','bonus','rake','rakeback','admin_adjust') NOT NULL,
	`amount` bigint NOT NULL,
	`currency` varchar(16) NOT NULL DEFAULT 'USDT',
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`txHash` varchar(256),
	`walletAddress` varchar(256),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `nickname` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `balanceReal` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `balanceBonus` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tournamentTickets` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `handsPlayed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `handsWon` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalWinnings` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalLosses` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `level` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `xp` int DEFAULT 0 NOT NULL;