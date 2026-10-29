import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTaskMetrics,
  getDepartmentWorkload,
  getRollingSevenDayTeamOutput,
} from "@/lib/services/taskService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const [metrics, workloadReport, sevenDayReport] = await Promise.all([
      getTaskMetrics(now),
      getDepartmentWorkload(now),
      getRollingSevenDayTeamOutput(now),
    ]);

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
        clientProjectsCount: 0,
        sevenDayReport,
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
