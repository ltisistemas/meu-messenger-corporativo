CREATE TABLE "file_transfer_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"uploader_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/octet-stream' NOT NULL,
	"storage_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"total_recipients_count" integer DEFAULT 1 NOT NULL,
	"pending_downloads_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"text" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"creator_id" uuid,
	"question" text NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"gateway" varchar(50) DEFAULT 'asaas' NOT NULL,
	"gateway_subscription_id" varchar(255),
	"gateway_customer_id" varchar(255),
	"plan" varchar(50) NOT NULL,
	"billing_cycle" varchar(50) DEFAULT 'monthly' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_gateway_subscription_id_unique" UNIQUE("gateway_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"subscription_id" uuid,
	"gateway_invoice_id" varchar(255),
	"amount_cents" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"pdf_url" varchar(1000),
	"bank_slip_url" varchar(1000),
	"pix_qr_code" varchar(2000),
	"pix_copy_paste" varchar(2000),
	"due_date" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_gateway_invoice_id_unique" UNIQUE("gateway_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "signature_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"ip_address" varchar(100),
	"user_agent" text,
	"token" varchar(255),
	"details" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"creator_id" uuid,
	"title" varchar(255) NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"provider" varchar(50) DEFAULT 'clicksign' NOT NULL,
	"external_document_key" varchar(255) NOT NULL,
	"original_sha256" varchar(64) NOT NULL,
	"signed_sha256" varchar(64),
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"deadline_at" timestamp with time zone,
	"auto_close" boolean DEFAULT true NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" uuid NOT NULL,
	"user_id" uuid,
	"external_signer_key" varchar(255) NOT NULL,
	"request_signature_key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"documentation" varchar(50),
	"phone_number" varchar(50),
	"auth_type" varchar(50) DEFAULT 'email' NOT NULL,
	"sign_as" varchar(50) DEFAULT 'sign' NOT NULL,
	"group_order" integer DEFAULT 1 NOT NULL,
	"sign_url" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_transfer_downloads" ADD CONSTRAINT "file_transfer_downloads_transfer_id_file_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."file_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_transfer_downloads" ADD CONSTRAINT "file_transfer_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_transfers" ADD CONSTRAINT "file_transfers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_transfers" ADD CONSTRAINT "file_transfers_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_transfers" ADD CONSTRAINT "file_transfers_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_transfers" ADD CONSTRAINT "file_transfers_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_evidence" ADD CONSTRAINT "signature_evidence_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_evidence" ADD CONSTRAINT "signature_evidence_signer_id_signature_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signature_signers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_transfer_user_download_unique_idx" ON "file_transfer_downloads" USING btree ("transfer_id","user_id");--> statement-breakpoint
CREATE INDEX "file_transfer_downloads_transfer_idx" ON "file_transfer_downloads" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "file_transfer_downloads_user_idx" ON "file_transfer_downloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_transfers_account_idx" ON "file_transfers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "file_transfers_conversation_idx" ON "file_transfers" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "file_transfers_message_idx" ON "file_transfers" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "file_transfers_expires_at_idx" ON "file_transfers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "file_transfers_status_idx" ON "file_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_unique_idx" ON "poll_votes" USING btree ("poll_id","option_id","user_id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_user_idx" ON "poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "polls_conversation_idx" ON "polls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "sig_evidence_req_idx" ON "signature_evidence" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "sig_req_account_idx" ON "signature_requests" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sig_req_conv_idx" ON "signature_requests" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "sig_req_ext_key_idx" ON "signature_requests" USING btree ("external_document_key");--> statement-breakpoint
CREATE INDEX "sig_signers_request_idx" ON "signature_signers" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "sig_signers_req_key_idx" ON "signature_signers" USING btree ("request_signature_key");