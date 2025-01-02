import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "turso",
	dbCredentials: {
		url: "file:local.db",
	},
})
