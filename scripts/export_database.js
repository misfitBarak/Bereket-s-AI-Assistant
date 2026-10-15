const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function exportDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupsDir = path.join(__dirname, '..', 'prisma', 'backups');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // 1. Physical copy of dev.db
  const srcDb = path.join(__dirname, '..', 'prisma', 'dev.db');
  const physicalBackupFile = path.join(backupsDir, `dev_backup_phase1_${timestamp}.db`);
  fs.copyFileSync(srcDb, physicalBackupFile);
  const dbStat = fs.statSync(physicalBackupFile);
  console.log(`✓ Physical SQLite backup created: ${physicalBackupFile} (${dbStat.size} bytes)`);

  // 2. Query all tables from Prisma
  console.log('Querying database tables for JSON export...');
  const [
    tasks,
    projects,
    teamMembers,
    memories,
    chatMessages,
    activityLogs,
    scheduledMessages,
    telegramRecipients,
    appSettings,
  ] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.teamMember.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.memory.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.scheduledMessage.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.telegramRecipient.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.appSetting.findMany({ orderBy: { key: 'asc' } }),
  ]);

  const exportPayload = {
    metadata: {
      exportedAt: new Date().toISOString(),
      sourceDatabase: 'prisma/dev.db',
      version: '1.0.0',
      totalRecords:
        tasks.length +
        projects.length +
        teamMembers.length +
        memories.length +
        chatMessages.length +
        activityLogs.length +
        scheduledMessages.length +
        telegramRecipients.length +
        appSettings.length,
      counts: {
        tasks: tasks.length,
        projects: projects.length,
        teamMembers: teamMembers.length,
        memories: memories.length,
        chatMessages: chatMessages.length,
        activityLogs: activityLogs.length,
        scheduledMessages: scheduledMessages.length,
        telegramRecipients: telegramRecipients.length,
        appSettings: appSettings.length,
      },
    },
    data: {
      tasks,
      projects,
      teamMembers,
      memories,
      chatMessages,
      activityLogs,
      scheduledMessages,
      telegramRecipients,
      // Include appSettings with masked sensitive values for security
      appSettings: appSettings.map((s) => ({
        key: s.key,
        valueMasked:
          s.key.includes('KEY') || s.key.includes('TOKEN') || s.key.includes('SECRET') || s.key.includes('SESSION')
            ? `[CONFIGURED_SECRET_LEN_${s.value.length}]`
            : s.value,
        updatedAt: s.updatedAt,
      })),
    },
  };

  // 3. Save JSON export
  const jsonBackupFile = path.join(backupsDir, `dev_backup_phase1_${timestamp}.json`);
  fs.writeFileSync(jsonBackupFile, JSON.stringify(exportPayload, null, 2), 'utf-8');
  const jsonStat = fs.statSync(jsonBackupFile);
  console.log(`✓ JSON export created: ${jsonBackupFile} (${jsonStat.size} bytes)`);

  // 4. Verification summary
  console.log('\n--- VERIFICATION OF EXPORTED RECORDS ---');
  console.log(`• Tasks:               ${tasks.length}`);
  console.log(`• Projects:            ${projects.length}`);
  console.log(`• Team Members:        ${teamMembers.length}`);
  console.log(`• Memories:            ${memories.length}`);
  console.log(`• Chat Messages:       ${chatMessages.length}`);
  console.log(`• Activity Logs:       ${activityLogs.length}`);
  console.log(`• Scheduled Messages:  ${scheduledMessages.length}`);
  console.log(`• Telegram Recipients: ${telegramRecipients.length}`);
  console.log(`• App Settings:        ${appSettings.length}`);
  console.log(`• Total Items:         ${exportPayload.metadata.totalRecords}`);

  return { physicalBackupFile, jsonBackupFile, counts: exportPayload.metadata.counts };
}

exportDatabase()
  .catch((err) => {
    console.error('❌ Export failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
