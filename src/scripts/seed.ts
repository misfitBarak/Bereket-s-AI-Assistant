import { seedDatabaseIfEmpty } from "../lib/seed";
import { db } from "../lib/db";

async function main() {
  console.log("Seeding database...");
  const res = await seedDatabaseIfEmpty();
  console.log(res.message);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
