CREATE TABLE "persona" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"npn" text,
	"email" text,
	"telefono" text,
	"companias" text[] NOT NULL,
	"lobs" text[] DEFAULT '{}'::text[] NOT NULL,
	"certificacion_ffm" boolean DEFAULT false NOT NULL,
	"nota" text,
	"ficticio" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculo" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_id" text NOT NULL,
	"tipo" text NOT NULL,
	"agencia_id" text,
	"carrier" text,
	"lob" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_agencia_id_agencia_id_fk" FOREIGN KEY ("agencia_id") REFERENCES "public"."agencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "persona_npn_uq" ON "persona" USING btree ("npn");--> statement-breakpoint
CREATE INDEX "vinculo_persona_idx" ON "vinculo" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "vinculo_agencia_idx" ON "vinculo" USING btree ("agencia_id");