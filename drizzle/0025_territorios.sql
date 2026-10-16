ALTER TABLE "baselines" DROP CONSTRAINT "baselines_kind";--> statement-breakpoint
ALTER TABLE "baselines" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "baselines" ADD COLUMN "zips" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_kind" CHECK ("baselines"."kind" IN ('carrier', 'state', 'lob', 'cargo', 'area', 'tipo-comision', 'territorio'));