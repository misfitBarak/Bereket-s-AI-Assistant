import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    // 1. Fetch custom recorded achievements
    const achievementWhere: any = {};
    if (category && category !== "all") {
      achievementWhere.category = category;
    }
    if (search && search.trim()) {
      achievementWhere.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
        { metric: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [achievements, completedTasks, allProjects, completedProjects] = await Promise.all([
      db.achievement.findMany({
        where: achievementWhere,
        orderBy: [{ achievedAt: "desc" }, { createdAt: "desc" }],
      }),
      db.task.findMany({
        where: { status: "completed" },
        orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      }),
      db.project.findMany(),
      db.project.findMany({
        where: { status: "completed" },
      }),
    ]);

    // Financial milestone
    const clientProjects = allProjects.filter((p) => p.workspace === "client_work");
    const totalClientRevenue = clientProjects.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    // Derived deliverable achievements from completed tasks
    const derivedTaskAccomplishments = completedTasks.map((t) => ({
      id: `task_${t.id}`,
      title: `Delivered: ${t.title}`,
      description: t.description || `Completed broadcast deliverable [${t.deliverableType || "Graphic"}] assigned to ${t.assignedTo || "Team"}.`,
      category: t.workspace as any,
      type: "deliverable" as const,
      metric: t.deliverableType ? `${t.deliverableType} Done` : "Deliverable 100%",
      impact: t.priority === "urgent" || t.priority === "high" ? "high" : "medium",
      achievedAt: t.completedAt ? t.completedAt.toISOString() : t.updatedAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      isDerived: true,
      originalId: t.id,
    }));

    // Derived project accomplishments
    const derivedProjectAccomplishments = completedProjects.map((p) => ({
      id: `proj_${p.id}`,
      title: `Project Completed: ${p.title}`,
      description: p.description || `Reached 100% completion milestone for ${p.category || "Project"}.`,
      category: p.workspace as any,
      type: "milestone" as const,
      metric: "100% Finished",
      impact: "major" as const,
      achievedAt: p.updatedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      isDerived: true,
      originalId: p.id,
    }));

    // Filter derived items if category or search was provided
    let combinedAccomplishments = [...achievements, ...derivedTaskAccomplishments, ...derivedProjectAccomplishments];

    if (category && category !== "all") {
      combinedAccomplishments = combinedAccomplishments.filter((a) => a.category === category);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      combinedAccomplishments = combinedAccomplishments.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.metric && a.metric.toLowerCase().includes(q))
      );
    }

    // Sort combined by achievedAt desc
    combinedAccomplishments.sort(
      (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
    );

    // Progress stream ("what changed")
    const progressTimeline = combinedAccomplishments.slice(0, 20).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      type: item.type,
      metric: item.metric,
      impact: item.impact,
      date: item.achievedAt,
      detail: item.description,
    }));

    const metrics = {
      totalAccomplishments: combinedAccomplishments.length,
      totalCompletedDeliverables: completedTasks.length,
      totalProjectsCompleted: completedProjects.length,
      totalClientRevenue,
      majorBreakthroughsCount: combinedAccomplishments.filter(
        (a) => a.impact === "major" || a.impact === "breakthrough" || a.impact === "high"
      ).length,
    };

    return NextResponse.json({
      success: true,
      metrics,
      accomplishments: combinedAccomplishments,
      progressTimeline,
    });
  } catch (error: any) {
    console.error("GET /api/growth error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      category = "abbay_tv",
      type = "milestone",
      metric,
      impact = "medium",
      achievedAt,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const achievement = await db.achievement.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category,
        type,
        metric: metric?.trim() || null,
        impact,
        achievedAt: achievedAt ? new Date(achievedAt) : new Date(),
      },
    });

    return NextResponse.json({ success: true, achievement });
  } catch (error: any) {
    console.error("POST /api/growth error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    // Only custom achievements can be deleted directly
    if (id.startsWith("task_") || id.startsWith("proj_")) {
      return NextResponse.json(
        { success: false, error: "Deliverable achievements are synced with tasks and cannot be directly deleted here" },
        { status: 400 }
      );
    }

    await db.achievement.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Accomplishment removed" });
  } catch (error: any) {
    console.error("DELETE /api/growth error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
