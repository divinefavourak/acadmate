import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// prisma.config.ts disables automatic .env loading, so we load it manually here
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
});
