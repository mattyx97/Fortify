import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import { user } from "../db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 3,

  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "company_admin", // admin, company_admin, analyst
        input: false
      },
      organizationId: {
        type: "string",
        required: false,
        input: true
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: true
      }
    }
  },
  plugins: [
    admin({
      defaultRole: "company_admin",
      adminRoles: ["admin"]
    })
  ],
  advanced: {
    generateId: () => crypto.randomUUID(),
  }
});
