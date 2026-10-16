CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agencia" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"parent_id" text,
	"companias" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agente" (
	"npn" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"lobs" text[] NOT NULL,
	"companias" text[] NOT NULL,
	"certificacion_ffm" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agente_agencia" (
	"agente_npn" text NOT NULL,
	"agencia_id" text NOT NULL,
	CONSTRAINT "agente_agencia_agente_npn_agencia_id_pk" PRIMARY KEY("agente_npn","agencia_id")
);
--> statement-breakpoint
CREATE TABLE "asignacion" (
	"id" text PRIMARY KEY NOT NULL,
	"empleado_id" text NOT NULL,
	"rol_id" text NOT NULL,
	"alcance_tipo" text NOT NULL,
	"alcance_valor" text,
	"lob" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "empleado" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"puesto" text NOT NULL,
	"area_id" text NOT NULL,
	"email" text,
	"nota" text,
	"ficticio" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capacidad_id" text NOT NULL,
	"accion" text NOT NULL,
	"nombre_accion" text NOT NULL,
	"tipo" text NOT NULL,
	"actor" jsonb NOT NULL,
	"canal" text NOT NULL,
	"cuando" timestamp with time zone NOT NULL,
	"regla" text NOT NULL,
	"entrada" jsonb NOT NULL,
	"cambios" jsonb NOT NULL,
	"salida" text,
	"datos" jsonb,
	"emite" text[] DEFAULT '{}'::text[] NOT NULL,
	"procedencia" jsonb,
	"motivo" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agencia" ADD CONSTRAINT "agencia_parent_id_agencia_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."agencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_agencia" ADD CONSTRAINT "agente_agencia_agente_npn_agente_npn_fk" FOREIGN KEY ("agente_npn") REFERENCES "public"."agente"("npn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_agencia" ADD CONSTRAINT "agente_agencia_agencia_id_agencia_id_fk" FOREIGN KEY ("agencia_id") REFERENCES "public"."agencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asignacion_empleado_idx" ON "asignacion" USING btree ("empleado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "empleado_email_uq" ON "empleado" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "evento_capacidad_cuando_idx" ON "evento" USING btree ("capacidad_id","cuando");