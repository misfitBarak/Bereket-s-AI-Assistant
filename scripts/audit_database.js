const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  const tasks = await prisma.task.findMany({
    include: {
      project: { select: { title: true, workspace: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  const projects = await prisma.project.findMany();
  const members = await prisma.teamMember.findMany();

  console.log('--- DATABASE AUDIT ---');
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`Total projects: ${projects.length}`);
  console.log(`Total team members: ${members.length}`);

  const byStatus = {};
  const byPriority = {};
  const byWorkspace = {};
  tasks.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    byWorkspace[t.workspace] = (byWorkspace[t.workspace] || 0) + 1;
  });

  console.log('\nStatus Breakdown:', byStatus);
  console.log('Priority Breakdown:', byPriority);
  console.log('Workspace Breakdown:', byWorkspace);

  console.log('\n--- ALL TASKS ---');
  tasks.forEach((t, i) => {
    const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'None';
    const proj = t.project?.title || 'No Project';
    const who = t.assignedTo || 'Unassigned';
    console.log(`${(i + 1).toString().padStart(2, ' ')}. [${t.status.padEnd(11)}] [${t.priority.padEnd(6)}] [${t.workspace.padEnd(8)}] ${t.title}`);
    console.log(`    ID: ${t.id} | Due: ${due} | Project: ${proj} | Assignee: ${who}`);
  });

  // Check for duplicates
  console.log('\n--- POTENTIAL DUPLICATES ---');
  const seenTitles = {};
  tasks.forEach(t => {
    const norm = t.title.trim().toLowerCase();
    if (!seenTitles[norm]) seenTitles[norm] = [];
    seenTitles[norm].push(t);
  });

  let duplicateCount = 0;
  for (const [norm, list] of Object.entries(seenTitles)) {
    if (list.length > 1) {
      duplicateCount++;
      console.log(`Duplicate group: "${norm}" (${list.length} tasks)`);
      list.forEach(t => {
        console.log(`  - [ID: ${t.id}] Status: ${t.status}, Due: ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'None'}, Created: ${t.createdAt.toISOString()}`);
      });
    }
  }
  if (duplicateCount === 0) {
    console.log('No exact title duplicates found.');
  }

  // Check outdated deadlines (before 2026-10-14)
  console.log('\n--- OUTDATED DEADLINES (Relative to 2026-10-14) ---');
  const now = new Date('2026-10-14T00:00:00.000Z');
  let overdueCount = 0;
  tasks.forEach(t => {
    if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed') {
      overdueCount++;
      console.log(`  - [Overdue] "${t.title}" | Due: ${t.dueDate.toISOString().slice(0, 10)} | Status: ${t.status} | Workspace: ${t.workspace}`);
    }
  });
  console.log(`Total active overdue tasks: ${overdueCount}`);
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
