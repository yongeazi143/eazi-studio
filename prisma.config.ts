import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import * as path from "path";

// Load Next.js local environment variables where database keys live
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); // fallback to .env

const dbUrl = process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
});
