CREATE TABLE `cleanup_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`report_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`before_asset_id` text,
	`after_asset_id` text,
	`gps_lat` real,
	`gps_lng` real,
	`checklist` text NOT NULL,
	`status` text NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proof_report_idx` ON `cleanup_proofs` (`report_id`);--> statement-breakpoint
CREATE INDEX `proof_stop_idx` ON `cleanup_proofs` (`stop_id`);--> statement-breakpoint
CREATE TABLE `citizen_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`outcome` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `confirmation_report_idx` ON `citizen_confirmations` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `event_journal` (
	`cursor` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`topic` text NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_version` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_id_unique` ON `event_journal` (`id`);--> statement-breakpoint
CREATE INDEX `event_topic_cursor_idx` ON `event_journal` (`topic`,`cursor`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`route` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idempotency_expiry_idx` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `placement_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`rank` integer NOT NULL,
	`label` text NOT NULL,
	`locality` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`score` real NOT NULL,
	`confidence` real NOT NULL,
	`factor_audit` text NOT NULL,
	`constraints` text NOT NULL,
	`warnings` text NOT NULL,
	`provenance` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `placement_rank_idx` ON `placement_recommendations` (`rank`);--> statement-breakpoint
CREATE TABLE `priority_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`version` text NOT NULL,
	`model_score` real NOT NULL,
	`effective_score` real NOT NULL,
	`model_band` text NOT NULL,
	`effective_band` text NOT NULL,
	`coverage` real NOT NULL,
	`missing_factors` text NOT NULL,
	`manual_review_reasons` text NOT NULL,
	`safety_escalation` text NOT NULL,
	`full_audit` text NOT NULL,
	`calculated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_report_idx` ON `priority_audits` (`report_id`,`calculated_at`);--> statement-breakpoint
CREATE INDEX `audit_score_idx` ON `priority_audits` (`effective_score`);--> statement-breakpoint
CREATE TABLE `priority_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`factor_key` text NOT NULL,
	`present` integer NOT NULL,
	`raw_value` text,
	`normalized_value` real NOT NULL,
	`weight` real NOT NULL,
	`contribution` real NOT NULL,
	`explanation` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_factor_unique` ON `priority_factors` (`audit_id`,`factor_key`);--> statement-breakpoint
CREATE TABLE `priority_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`replacement_score` real,
	`replacement_band` text,
	`expires_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `override_audit_idx` ON `priority_overrides` (`audit_id`);--> statement-breakpoint
CREATE TABLE `garbage_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`locality` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`status` text NOT NULL,
	`priority_score` real NOT NULL,
	`priority_band` text NOT NULL,
	`latest_audit_id` text,
	`assigned_vehicle_id` text,
	`photo_asset_id` text,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_rank_idx` ON `garbage_reports` (`status`,`priority_score`);--> statement-breakpoint
CREATE INDEX `report_created_idx` ON `garbage_reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `route_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text NOT NULL,
	`algorithm` text NOT NULL,
	`seed` integer NOT NULL,
	`trigger` text NOT NULL,
	`weights` text NOT NULL,
	`total_distance_km` real NOT NULL,
	`total_minutes` integer NOT NULL,
	`fallback_used` integer NOT NULL,
	`distance_mode` text NOT NULL,
	`generated_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE INDEX `route_status_idx` ON `route_plans` (`status`,`generated_at`);--> statement-breakpoint
CREATE TABLE `route_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`route_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`work_id` text NOT NULL,
	`kind` text NOT NULL,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`volume_litres` real NOT NULL,
	`explanation` text NOT NULL,
	`locked` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `route_sequence_unique` ON `route_stops` (`route_id`,`vehicle_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `route_work_idx` ON `route_stops` (`work_id`);--> statement-breakpoint
CREATE TABLE `simulation_state` (
	`id` text PRIMARY KEY NOT NULL,
	`seed` integer NOT NULL,
	`tick` integer NOT NULL,
	`now` text NOT NULL,
	`generation` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `smart_bins` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`label` text NOT NULL,
	`locality` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`capacity_litres` real NOT NULL,
	`fill_percent` real NOT NULL,
	`status` text NOT NULL,
	`accepted_streams` text NOT NULL,
	`last_sensor_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bin_fill_idx` ON `smart_bins` (`fill_percent`);--> statement-breakpoint
CREATE INDEX `bin_status_idx` ON `smart_bins` (`status`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`heading` real NOT NULL,
	`capacity_litres` real NOT NULL,
	`load_litres` real NOT NULL,
	`active_route_id` text,
	`last_seen_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vehicle_status_idx` ON `vehicles` (`status`);--> statement-breakpoint
CREATE INDEX `vehicle_seen_idx` ON `vehicles` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `waste_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`amount_band` text NOT NULL,
	`locality` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`status` text NOT NULL,
	`eta_minutes` integer,
	`assigned_vehicle_id` text,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signal_status_idx` ON `waste_signals` (`status`);--> statement-breakpoint
CREATE INDEX `signal_created_idx` ON `waste_signals` (`created_at`);