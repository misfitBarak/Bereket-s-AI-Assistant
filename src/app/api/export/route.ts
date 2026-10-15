import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabaseIfEmpty } from "@/lib/seed";

export async function GET() {
  try {
    const [tasks, projects, teamMembers, memories, activityLogs] = await Promise.all([
      db.task.findMany(),
      db.project.findMany(),
      db.teamMember.findMany(),
      db.memory.findMany(),
      db.activityLog.findMany({ take: 200, orderBy: { createdAt: "desc" } }),
    ]);

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: "Abbay (Graphics Department Lead)",
      data: {
        tasks,
        projects,
        teamMembers,
        memories,
        activityLogs,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="abbay-command-center-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, backupData } = body;

    if (action === "reset_seed") {
      // Clear and re-seed
      await db.activityLog.deleteMany();
      await db.task.deleteMany();
      await db.project.deleteMany();
      await db.teamMember.deleteMany();
      await db.memory.deleteMany();
      await db.chatMessage.deleteMany();

      await seedDatabaseIfEmpty();

      return NextResponse.json({
        success: true,
        message: "Database reset and successfully re-seeded with official department data",
      });
    }

    if (action === "restore" && backupData?.data) {
      const { tasks, projects, teamMembers, memories } = backupData.data;

      // Wipe current data
      await db.activityLog.deleteMany();
      await db.task.deleteMany();
      await db.project.deleteMany();
      await db.teamMember.deleteMany();
      await db.memory.deleteMany();

      if (Array.isArray(teamMembers)) {
        for (const m of teamMembers) {
          const { id, createdAt, updatedAt, ...rest } = m;
          await db.teamMember.create({ data: rest });
        }
      }

      if (Array.isArray(projects)) {
        for (const p of projects) {
          const { id, createdAt, updatedAt, ...rest } = p;
          await db.project.create({
            data: {
              ...rest,
              targetDate: rest.targetDate ? new Date(rest.targetDate) : null,
            },
          });
        }
      }

      if (Array.isArray(tasks)) {
        for (const t of tasks) {
          const { id, createdAt, updatedAt, project, activityLogs, ...rest } = t;
          await db.task.create({
            data: {
              ...rest,
              dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
              startDate: rest.startDate ? new Date(rest.startDate) : null,
              completedAt: rest.completedAt ? new Date(rest.completedAt) : null,
            },
          });
        }
      }

      if (Array.isArray(memories)) {
        for (const m of memories) {
          const { id, createdAt, updatedAt, ...rest } = m;
          await db.memory.create({ data: rest });
        }
      }

      return NextResponse.json({ success: true, message: "Backup successfully restored" });
    }

    return NextResponse.json({ success: false, error: "Invalid action or payload" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/export error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
