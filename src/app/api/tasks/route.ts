import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveDateDetailed, checkTaskDuplicate } from "@/lib/services/taskService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get("workspace");
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assignedTo");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    const where: any = {};

    if (workspace && workspace !== "all") {
      where.workspace = workspace;
    }
    if (status && status !== "all") {
      where.status = status;
    }
    if (assignedTo && assignedTo !== "all") {
      where.assignedTo = assignedTo;
    }
    if (priority && priority !== "all") {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            workspace: true,
            clientName: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      workspace = "abbay_tv",
      description,
      status = "todo",
      priority = "medium",
      deliverableType,
      assignedTo,
      dueDate,
      startDate,
      estimatedHours,
      recurringSchedule,
      projectId,
      tags,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Task title is required" }, { status: 400 });
    }

    const dupCheck = await checkTaskDuplicate(title.trim(), workspace);
    const dateRes = resolveDateDetailed(dueDate, { isNewTaskCreation: true, allowHistorical: body.allowHistorical === true });
    const parsedDueDate = dateRes.date;
    const parsedStartDate = resolveDateDetailed(startDate, { isNewTaskCreation: true, allowHistorical: body.allowHistorical === true }).date;

    const task = await db.task.create({
      data: {
        title: title.trim(),
        workspace,
        description: description?.trim() || null,
        status,
        priority,
        deliverableType: deliverableType || null,
        assignedTo: assignedTo || null,
        dueDate: parsedDueDate,
        startDate: parsedStartDate,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        recurringSchedule: recurringSchedule || null,
        projectId: projectId || null,
        tags: tags || null,
      },
      include: {
        project: true,
      },
    });

    let details = `Task "${task.title}" created in ${task.workspace}${task.assignedTo ? ` assigned to ${task.assignedTo}` : ""}`;
    if (dupCheck.isDuplicate) {
      details += ` (Duplicate warning: ${dupCheck.reason})`;
    }
    if (dateRes.warning) {
      details += ` (Date note: ${dateRes.warning})`;
    }

    await db.activityLog.create({
      data: {
        taskId: task.id,
        action: "created",
        details,
      },
    });

    let warning = dupCheck.isDuplicate ? dupCheck.reason : undefined;
    if (dateRes.warning) {
      warning = warning ? `${warning} | ${dateRes.warning}` : dateRes.warning;
    }

    return NextResponse.json({
      success: true,
      task,
      warning,
      dateWarning: dateRes.warning,
      clarificationRequired: dateRes.clarificationRequired,
      dateCategory: dateRes.category,
    });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }

    const currentTask = await db.task.findUnique({ where: { id } });
    if (!currentTask) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title.trim();
    if (updates.description !== undefined) data.description = updates.description?.trim() || null;
    if (updates.status !== undefined) {
      data.status = updates.status;
      if (updates.status === "completed" && !currentTask.completedAt) {
        data.completedAt = new Date();
      } else if (updates.status !== "completed") {
        data.completedAt = null;
      }
    }
    if (updates.priority !== undefined) data.priority = updates.priority;
    if (updates.workspace !== undefined) data.workspace = updates.workspace;
    if (updates.deliverableType !== undefined) data.deliverableType = updates.deliverableType;
    if (updates.assignedTo !== undefined) data.assignedTo = updates.assignedTo;
    if (updates.dueDate !== undefined) {
      data.dueDate = updates.dueDate ? resolveDateDetailed(updates.dueDate, { allowHistorical: true }).date : null;
    }
    if (updates.startDate !== undefined) {
      data.startDate = updates.startDate ? resolveDateDetailed(updates.startDate, { allowHistorical: true }).date : null;
    }
    if (updates.estimatedHours !== undefined) {
      data.estimatedHours = updates.estimatedHours ? parseFloat(updates.estimatedHours) : null;
    }
    if (updates.actualHours !== undefined) {
      data.actualHours = updates.actualHours ? parseFloat(updates.actualHours) : null;
    }
    if (updates.recurringSchedule !== undefined) data.recurringSchedule = updates.recurringSchedule;
    if (updates.projectId !== undefined) data.projectId = updates.projectId;
    if (updates.tags !== undefined) data.tags = updates.tags;

    const updatedTask = await db.task.update({
      where: { id },
      data,
      include: {
        project: true,
      },
    });

    // Log status or assignment changes
    let logDetail = `Updated task "${updatedTask.title}"`;
    if (updates.status && updates.status !== currentTask.status) {
      logDetail = `Status changed from ${currentTask.status} to ${updates.status}`;
    } else if (updates.assignedTo && updates.assignedTo !== currentTask.assignedTo) {
      logDetail = `Reassigned from ${currentTask.assignedTo || "Unassigned"} to ${updates.assignedTo}`;
    }

    await db.activityLog.create({
      data: {
        taskId: id,
        action: updates.status ? "status_changed" : "updated",
        details: logDetail,
      },
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error("PUT /api/tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }

    const task = await db.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    await db.task.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" deleted successfully`,
    });
  } catch (error: any) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
