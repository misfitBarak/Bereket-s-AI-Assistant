const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const srcDb = path.join(__dirname, '..', 'prisma', 'dev.db');
const backupsDir = path.join(__dirname, '..', 'prisma', 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDb = path.join(backupsDir, `dev_backup_voice_mission_${timestamp}.db`);

fs.copyFileSync(srcDb, backupDb);
const stat = fs.statSync(backupDb);
console.log(`✓ Backup created: ${backupDb} (${stat.size} bytes)`);

// Verify queryability with isolated Prisma instance
async function verify() {
  const p = new PrismaClient({
    datasources: {
      db: {
        url: `file:${backupDb.replace(/\\/g, '/')}`,
      },
    },
  });

  try {
    const tasks = await p.task.count();
    const projects = await p.project.count();
    const team = await p.teamMember.count();
    console.log(`✓ Backup verified readable and queryable: Tasks=${tasks}, Projects=${projects}, Team=${team}`);
  } finally {
    await p.$disconnect();
  }
}

verify().catch(console.error);
