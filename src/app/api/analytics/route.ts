import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTaskMetrics, getDepartmentWorkload } from "@/lib/services/taskService";

export async function GET() {
  try {
    const now = new Date();
    const [metrics, workloadReport, allProjects] = await Promise.all([
      getTaskMetrics(now),
      getDepartmentWorkload(now),
      db.project.findMany(),
    ]);

    // Client financials summary (calculated strictly from client_work projects)
    const clientProjects = allProjects.filter((p) => p.workspace === "client_work");
    const totalQuoted = clientProjects.reduce((sum, p) => sum + (p.quotedAmount || 0), 0);
    const totalPaid = clientProjects.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const pendingBalance = totalQuoted - totalPaid;

    return NextResponse.json({
      success: true,
      stats: {
        totalTasks: metrics.totalTasks,
        activeTasks: metrics.activeTasks,
        completedTasks: metrics.completedTasks,
        urgentTasks: metrics.urgentTasks,
        overdueCount: metrics.overdueCount,
        todayCount: metrics.todayCount,
        overdueTasks: metrics.overdueTasks,
        todayTasks: metrics.todayTasks,
        upcomingDeadlines: metrics.upcomingDeadlines,
        workspaceStats: metrics.byWorkspace,
        clientProjectsCount: clientProjects.length,
        financials: {
          totalQuoted,
          totalPaid,
          pendingBalance,
          currency: "ETB",
        },
        teamWorkload: workloadReport.team.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          capacity: m.capacityHours,
          assignedHours: m.assignedHours,
          taskCount: m.taskCount,
          loadPercentage: m.loadPercent,
          isOverloaded: m.isOverloaded,
        })),
        workloadRecommendations: workloadReport.recommendations,
      },
    });
  } catch (error: any) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
