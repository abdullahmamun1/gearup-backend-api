import app from "./app";
import "dotenv/config";
import config from "./config";
import { prisma } from "./lib/prisma";

const PORT = config.port;

async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to database successfully!!");
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Error starting the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
