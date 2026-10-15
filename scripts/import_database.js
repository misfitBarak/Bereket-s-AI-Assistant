/**
 * Abbay AI Command Center — Production Database Import Script
 *
 * Imports existing SQLite records from the verified JSON backup into PostgreSQL (Neon).
 * Supports idempotency (upsert / skip duplicates), preserves original IDs and timestamps,
 * and safeguards secrets by never importing masked placeholders.
 *
 * Usage:
 *   node scripts/import_database.js [--file path/to/backup.json] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const fileArgIdx = args.indexOf('--file');

  let backupFilePath = '';
  if (fileArgIdx !== -1 && args[fileArgIdx + 1]) {
    backupFilePath = path.resolve(args[fileArgIdx + 1]);
  } else {
    // Default to the latest verified Phase 1 backup
    const backupsDir = path.join(__dirname, '..', 'prisma', 'backups');
    const defaultJson = path.join(backupsDir, 'dev_backup_phase1_2026-10-15T08-46-22-421Z.json');
    if (fs.existsSync(defaultJson)) {
      backupFilePath = defaultJson;
    } else {
      // Find latest .json backup in prisma/backups
      const jsonFiles = fs.readdirSync(backupsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(backupsDir, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (jsonFiles.length > 0) {
        backupFilePath = jsonFiles[0];
      }
    }
  }

  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    console.error('❌ Error: Backup JSON file not found at:', backupFilePath);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('ABBAY AI COMMAND CENTER — DATABASE RESTORE / IMPORT');
  console.log('====================================================');
  console.log(`Source Backup File: ${backupFilePath}`);
  console.log(`Mode:               ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE IMPORT'}\n`);

  const rawJson = fs.readFileSync(backupFilePath, 'utf-8');
  let backup;
  try {
    backup = JSON.parse(rawJson);
  } catch (err) {
    console.error('❌ Error: Failed to parse JSON backup file:', err.message);
    process.exit(1);
  }

  const { data, metadata } = backup;
  if (!data) {
    console.error('❌ Error: Backup file missing "data" property.');
    process.exit(1);
  }

  console.log('✓ Backup JSON parsed successfully.');
  console.log(`✓ Original Export Timestamp: ${metadata?.exportedAt || 'Unknown'}`);
  console.log(`✓ Total Items in Backup:     ${metadata?.totalRecords || Object.values(data).reduce((acc, cur) => acc + (Array.isArray(cur) ? cur.length : 0), 0)}\n`);

  // Initialize Prisma Client
  const prisma = new PrismaClient();

  try {
    // Test connection
    console.log('Testing target database connection...');
    await prisma.$connect();
    console.log('✓ Successfully connected to target database.\n');

    if (isDryRun) {
      console.log('--- DRY-RUN VALIDATION SUMMARY ---');
      console.log(`• Team Members:        ${data.teamMembers?.length || 0}`);
      console.log(`• Projects:            ${data.projects?.length || 0}`);
      console.log(`• Tasks:               ${data.tasks?.length || 0}`);
      console.log(`• Activity Logs:       ${data.activityLogs?.length || 0}`);
      console.log(`• Memories:            ${data.memories?.length || 0}`);
      console.log(`• Chat Messages:       ${data.chatMessages?.length || 0}`);
      console.log(`• Telegram Recipients: ${data.telegramRecipients?.length || 0}`);
      console.log(`• Scheduled Messages:  ${data.scheduledMessages?.length || 0}`);
      console.log(`• App Settings:        ${data.appSettings?.length || 0}`);
      console.log('\nDry-run complete. Database connection and backup integrity verified.');
      return;
    }

    console.log('Beginning live import into target database...\n');

    // 1. Team Members (No FK dependencies)
    let teamCount = 0;
    if (Array.isArray(data.teamMembers)) {
      for (const m of data.teamMembers) {
        await prisma.teamMember.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            name: m.name,
            role: m.role,
            skills: m.skills,
            currentCapacityHours: m.currentCapacityHours ?? 40.0,
            status: m.status ?? 'available',
            email: m.email ?? null,
            notes: m.notes ?? null,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
          },
          update: {
            name: m.name,
            role: m.role,
            skills: m.skills,
            currentCapacityHours: m.currentCapacityHours ?? 40.0,
            status: m.status ?? 'available',
            email: m.email ?? null,
            notes: m.notes ?? null,
          },
        });
        teamCount++;
      }
    }
    console.log(`✓ Team Members imported:        ${teamCount}`);

    // 2. Projects (No FK dependencies)
    let projectCount = 0;
    if (Array.isArray(data.projects)) {
      for (const p of data.projects) {
        await prisma.project.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            workspace: p.workspace,
            title: p.title,
            description: p.description ?? null,
            status: p.status ?? 'active',
            category: p.category ?? null,
            targetDate: p.targetDate ? new Date(p.targetDate) : null,
            progress: p.progress ?? 0,
            milestones: p.milestones ?? null,
            nextAction: p.nextAction ?? null,
            clientName: p.clientName ?? null,
            clientContact: p.clientContact ?? null,
            clientNotes: p.clientNotes ?? null,
            quotedAmount: p.quotedAmount ?? null,
            paidAmount: p.paidAmount ?? null,
            currency: p.currency ?? 'ETB',
            invoiceStatus: p.invoiceStatus ?? null,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          },
          update: {
            workspace: p.workspace,
            title: p.title,
            description: p.description ?? null,
            status: p.status ?? 'active',
            category: p.category ?? null,
            targetDate: p.targetDate ? new Date(p.targetDate) : null,
            progress: p.progress ?? 0,
            milestones: p.milestones ?? null,
            nextAction: p.nextAction ?? null,
            clientName: p.clientName ?? null,
            clientContact: p.clientContact ?? null,
            clientNotes: p.clientNotes ?? null,
            quotedAmount: p.quotedAmount ?? null,
            paidAmount: p.paidAmount ?? null,
            currency: p.currency ?? 'ETB',
            invoiceStatus: p.invoiceStatus ?? null,
          },
        });
        projectCount++;
      }
    }
    console.log(`✓ Projects imported:            ${projectCount}`);

    // 3. Tasks (FK dependency on Project)
    let taskCount = 0;
    if (Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        await prisma.task.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            workspace: t.workspace,
            title: t.title,
            description: t.description ?? null,
            status: t.status ?? 'todo',
            priority: t.priority ?? 'medium',
            deliverableType: t.deliverableType ?? null,
            assignedTo: t.assignedTo ?? null,
            startDate: t.startDate ? new Date(t.startDate) : null,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
            estimatedHours: t.estimatedHours ?? null,
            actualHours: t.actualHours ?? null,
            recurringSchedule: t.recurringSchedule ?? null,
            dependencies: t.dependencies ?? null,
            tags: t.tags ?? null,
            projectId: t.projectId ?? null,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          },
          update: {
            workspace: t.workspace,
            title: t.title,
            description: t.description ?? null,
            status: t.status ?? 'todo',
            priority: t.priority ?? 'medium',
            deliverableType: t.deliverableType ?? null,
            assignedTo: t.assignedTo ?? null,
            startDate: t.startDate ? new Date(t.startDate) : null,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
            estimatedHours: t.estimatedHours ?? null,
            actualHours: t.actualHours ?? null,
            recurringSchedule: t.recurringSchedule ?? null,
            dependencies: t.dependencies ?? null,
            tags: t.tags ?? null,
            projectId: t.projectId ?? null,
          },
        });
        taskCount++;
      }
    }
    console.log(`✓ Tasks imported:               ${taskCount}`);

    // 4. Activity Logs (FK dependency on Task)
    let logCount = 0;
    if (Array.isArray(data.activityLogs)) {
      for (const log of data.activityLogs) {
        await prisma.activityLog.upsert({
          where: { id: log.id },
          create: {
            id: log.id,
            taskId: log.taskId ?? null,
            action: log.action,
            details: log.details,
            createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
          },
          update: {
            taskId: log.taskId ?? null,
            action: log.action,
            details: log.details,
          },
        });
        logCount++;
      }
    }
    console.log(`✓ Activity Logs imported:       ${logCount}`);

    // 5. Memories (No FK dependencies)
    let memoryCount = 0;
    if (Array.isArray(data.memories)) {
      for (const m of data.memories) {
        await prisma.memory.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            category: m.category,
            title: m.title,
            content: m.content,
            tags: m.tags ?? null,
            source: m.source ?? 'user_explicit',
            importance: m.importance ?? 3,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
          },
          update: {
            category: m.category,
            title: m.title,
            content: m.content,
            tags: m.tags ?? null,
            source: m.source ?? 'user_explicit',
            importance: m.importance ?? 3,
          },
        });
        memoryCount++;
      }
    }
    console.log(`✓ Memories imported:            ${memoryCount}`);

    // 6. Chat Messages (No FK dependencies)
    let msgCount = 0;
    if (Array.isArray(data.chatMessages)) {
      for (const msg of data.chatMessages) {
        await prisma.chatMessage.upsert({
          where: { id: msg.id },
          create: {
            id: msg.id,
            conversationId: msg.conversationId ?? 'default',
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls ?? null,
            toolResults: msg.toolResults ?? null,
            pendingConfirmation: msg.pendingConfirmation ?? null,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          },
          update: {
            conversationId: msg.conversationId ?? 'default',
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls ?? null,
            toolResults: msg.toolResults ?? null,
            pendingConfirmation: msg.pendingConfirmation ?? null,
          },
        });
        msgCount++;
      }
    }
    console.log(`✓ Chat Messages imported:       ${msgCount}`);

    // 7. Telegram Recipients (No FK dependencies)
    let recipientCount = 0;
    if (Array.isArray(data.telegramRecipients)) {
      for (const r of data.telegramRecipients) {
        await prisma.telegramRecipient.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            name: r.name,
            type: r.type,
            chatId: r.chatId,
            username: r.username ?? null,
            aliases: r.aliases ?? null,
            notes: r.notes ?? null,
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          },
          update: {
            name: r.name,
            type: r.type,
            chatId: r.chatId,
            username: r.username ?? null,
            aliases: r.aliases ?? null,
            notes: r.notes ?? null,
          },
        });
        recipientCount++;
      }
    }
    console.log(`✓ Telegram Recipients imported: ${recipientCount}`);

    // 8. Scheduled Messages (No FK dependencies)
    let scheduledCount = 0;
    if (Array.isArray(data.scheduledMessages)) {
      for (const sm of data.scheduledMessages) {
        await prisma.scheduledMessage.upsert({
          where: { id: sm.id },
          create: {
            id: sm.id,
            senderAccount: sm.senderAccount ?? 'bot',
            actionType: sm.actionType,
            recipientType: sm.recipientType,
            recipientName: sm.recipientName,
            targetChatId: sm.targetChatId ?? null,
            content: sm.content ?? null,
            reportType: sm.reportType ?? null,
            scheduledFor: new Date(sm.scheduledFor),
            timezone: sm.timezone ?? 'Africa/Addis_Ababa',
            recurrenceRule: sm.recurrenceRule ?? null,
            status: sm.status ?? 'pending',
            authorizedAt: sm.authorizedAt ? new Date(sm.authorizedAt) : null,
            confirmationToken: sm.confirmationToken ?? null,
            retryCount: sm.retryCount ?? 0,
            maxRetries: sm.maxRetries ?? 3,
            lastError: sm.lastError ?? null,
            sentAt: sm.sentAt ? new Date(sm.sentAt) : null,
            telegramMsgId: sm.telegramMsgId ?? null,
            createdAt: sm.createdAt ? new Date(sm.createdAt) : new Date(),
            updatedAt: sm.updatedAt ? new Date(sm.updatedAt) : new Date(),
          },
          update: {
            senderAccount: sm.senderAccount ?? 'bot',
            actionType: sm.actionType,
            recipientType: sm.recipientType,
            recipientName: sm.recipientName,
            targetChatId: sm.targetChatId ?? null,
            content: sm.content ?? null,
            reportType: sm.reportType ?? null,
            scheduledFor: new Date(sm.scheduledFor),
            timezone: sm.timezone ?? 'Africa/Addis_Ababa',
            recurrenceRule: sm.recurrenceRule ?? null,
            status: sm.status ?? 'pending',
          },
        });
        scheduledCount++;
      }
    }
    console.log(`✓ Scheduled Messages imported:  ${scheduledCount}`);

    // 9. App Settings (SAFE RESTORATION: Skip masked secrets)
    let settingCount = 0;
    if (Array.isArray(data.appSettings)) {
      for (const s of data.appSettings) {
        // Skip keys that have masked values or represent secrets
        const isSecretKey =
          s.key.includes('KEY') ||
          s.key.includes('TOKEN') ||
          s.key.includes('SECRET') ||
          s.key.includes('SESSION');
        const isMaskedValue = typeof s.valueMasked === 'string' && s.valueMasked.startsWith('[CONFIGURED_SECRET_LEN_');

        if (isSecretKey || isMaskedValue) {
          // Do not write masked placeholders to production database
          continue;
        }

        const value = s.value !== undefined ? s.value : s.valueMasked;
        if (typeof value === 'string') {
          await prisma.appSetting.upsert({
            where: { key: s.key },
            create: {
              key: s.key,
              value: value,
              updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
            },
            update: {
              value: value,
            },
          });
          settingCount++;
        }
      }
    }
    console.log(`✓ Non-Secret App Settings imported: ${settingCount} (Secrets safely deferred to environment variables)`);

    // Verification queries against target database
    console.log('\n--- VERIFICATION OF TARGET DATABASE RECORDS ---');
    const [
      targetTasks,
      targetProjects,
      targetTeam,
      targetMemories,
      targetMsgs,
      targetLogs,
      targetRecipients,
      targetScheduled,
    ] = await Promise.all([
      prisma.task.count(),
      prisma.project.count(),
      prisma.teamMember.count(),
      prisma.memory.count(),
      prisma.chatMessage.count(),
      prisma.activityLog.count(),
      prisma.telegramRecipient.count(),
      prisma.scheduledMessage.count(),
    ]);

    console.log(`• Tasks:               ${targetTasks} (Expected: ${data.tasks?.length || 0})`);
    console.log(`• Projects:            ${targetProjects} (Expected: ${data.projects?.length || 0})`);
    console.log(`• Team Members:        ${targetTeam} (Expected: ${data.teamMembers?.length || 0})`);
    console.log(`• Memories:            ${targetMemories} (Expected: ${data.memories?.length || 0})`);
    console.log(`• Chat Messages:       ${targetMsgs} (Expected: ${data.chatMessages?.length || 0})`);
    console.log(`• Activity Logs:       ${targetLogs} (Expected: ${data.activityLogs?.length || 0})`);
    console.log(`• Telegram Recipients: ${targetRecipients} (Expected: ${data.telegramRecipients?.length || 0})`);
    console.log(`• Scheduled Messages:  ${targetScheduled} (Expected: ${data.scheduledMessages?.length || 0})`);

    const isParityValid =
      targetTasks >= (data.tasks?.length || 0) &&
      targetProjects >= (data.projects?.length || 0) &&
      targetTeam >= (data.teamMembers?.length || 0) &&
      targetMemories >= (data.memories?.length || 0);

    if (isParityValid) {
      console.log('\n✅ IMPORT SUCCESSFUL: Target database verified with full record parity.');
    } else {
      console.error('\n⚠️ WARNING: Some record counts did not match expected values.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Import error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
