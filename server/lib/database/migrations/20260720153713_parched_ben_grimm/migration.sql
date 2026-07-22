CREATE TYPE "campaign_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "campaign_status" AS ENUM('draft', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "interaction_event" AS ENUM('email_opened', 'link_clicked', 'form_submitted', 'payload_executed');--> statement-breakpoint
CREATE TYPE "member_role" AS ENUM('company_admin', 'analyst');--> statement-breakpoint
CREATE TYPE "platform" AS ENUM('linkedin', 'github', 'twitter', 'facebook', 'instagram');--> statement-breakpoint
CREATE TYPE "scraping_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "better_auth_account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth_session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth_verification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_target" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"campaign_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"personalized_subject" text,
	"personalized_content" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_template" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"channel" "campaign_channel" NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"landing_page_config" jsonb,
	"attachment_config" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phishing_campaign" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft'::"campaign_status" NOT NULL,
	"channel" "campaign_channel" NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"campaign_target_id" uuid NOT NULL,
	"event_type" "interaction_event" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_scraping_result" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"social_profile_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_social_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"target_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"profile_url" text NOT NULL,
	"username" text,
	"scraping_status" "scraping_status" DEFAULT 'pending'::"scraping_status" NOT NULL,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_target" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"job_title" text,
	"department" text,
	"website_url" text,
	"website_scraping_status" "scraping_status",
	"website_last_scraped_at" timestamp,
	"website_profile_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "better_auth_account_user_id_index" ON "better_auth_account" ("user_id");--> statement-breakpoint
CREATE INDEX "better_auth_session_user_id_index" ON "better_auth_session" ("user_id");--> statement-breakpoint
CREATE INDEX "better_auth_verification_identifier_index" ON "better_auth_verification" ("identifier");--> statement-breakpoint
CREATE INDEX "campaign_target_campaign_id_index" ON "campaign_target" ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_target_target_id_index" ON "campaign_target" ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_target_campaign_id_target_id_index" ON "campaign_target" ("campaign_id","target_id");--> statement-breakpoint
CREATE INDEX "campaign_template_organization_id_index" ON "campaign_template" ("organization_id");--> statement-breakpoint
CREATE INDEX "campaign_template_channel_index" ON "campaign_template" ("channel");--> statement-breakpoint
CREATE INDEX "campaign_template_created_by_id_index" ON "campaign_template" ("created_by_id");--> statement-breakpoint
CREATE INDEX "phishing_campaign_organization_id_index" ON "phishing_campaign" ("organization_id");--> statement-breakpoint
CREATE INDEX "phishing_campaign_organization_id_status_index" ON "phishing_campaign" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "phishing_campaign_template_id_index" ON "phishing_campaign" ("template_id");--> statement-breakpoint
CREATE INDEX "phishing_campaign_created_by_id_index" ON "phishing_campaign" ("created_by_id");--> statement-breakpoint
CREATE INDEX "interaction_log_campaign_target_id_index" ON "interaction_log" ("campaign_target_id");--> statement-breakpoint
CREATE INDEX "interaction_log_campaign_target_id_event_type_index" ON "interaction_log" ("campaign_target_id","event_type");--> statement-breakpoint
CREATE INDEX "interaction_log_created_at_index" ON "interaction_log" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_user_id_organization_id_index" ON "organization_member" ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_organization_id_index" ON "organization_member" ("organization_id");--> statement-breakpoint
CREATE INDEX "employee_scraping_result_social_profile_id_index" ON "employee_scraping_result" ("social_profile_id");--> statement-breakpoint
CREATE INDEX "employee_social_profile_target_id_index" ON "employee_social_profile" ("target_id");--> statement-breakpoint
CREATE INDEX "employee_social_profile_target_id_platform_index" ON "employee_social_profile" ("target_id","platform");--> statement-breakpoint
CREATE INDEX "employee_target_organization_id_index" ON "employee_target" ("organization_id");--> statement-breakpoint
CREATE INDEX "employee_target_email_organization_id_index" ON "employee_target" ("email","organization_id");--> statement-breakpoint
ALTER TABLE "better_auth_account" ADD CONSTRAINT "better_auth_account_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "better_auth_session" ADD CONSTRAINT "better_auth_session_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_target" ADD CONSTRAINT "campaign_target_campaign_id_phishing_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "phishing_campaign"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_target" ADD CONSTRAINT "campaign_target_target_id_employee_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "employee_target"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_template" ADD CONSTRAINT "campaign_template_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_template" ADD CONSTRAINT "campaign_template_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "phishing_campaign" ADD CONSTRAINT "phishing_campaign_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "phishing_campaign" ADD CONSTRAINT "phishing_campaign_template_id_campaign_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "campaign_template"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "phishing_campaign" ADD CONSTRAINT "phishing_campaign_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "interaction_log" ADD CONSTRAINT "interaction_log_campaign_target_id_campaign_target_id_fkey" FOREIGN KEY ("campaign_target_id") REFERENCES "campaign_target"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_scraping_result" ADD CONSTRAINT "employee_scraping_result_9WbseocAJh0t_fkey" FOREIGN KEY ("social_profile_id") REFERENCES "employee_social_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_social_profile" ADD CONSTRAINT "employee_social_profile_target_id_employee_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "employee_target"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_target" ADD CONSTRAINT "employee_target_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;