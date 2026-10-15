import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const members = await db.teamMember.findMany({
      orderBy: { name: "asc" },
    });

    // Compute active task counts and assigned hours for each member
    const activeTasks = await db.task.findMany({
      where: {
        workspace: "abbay_tv",
        status: { in: ["todo", "in_progress", "in_review"] },
      },
      select: {
        id: true,
        assignedTo: true,
        estimatedHours: true,
        priority: true,
        status: true,
        title: true,
        dueDate: true,
        deliverableType: true,
      },
    });

    const membersWithWorkload = members.map((member) => {
      const assigned = activeTasks.filter(
        (t) => t.assignedTo?.toLowerCase() === member.name.toLowerCase()
      );
      const totalAssignedHours = assigned.reduce((acc, t) => acc + (t.estimatedHours || 4.0), 0);

      // Determine load status dynamically if needed
      let dynamicStatus = member.status;
      if (member.status !== "on_leave") {
        if (totalAssignedHours > member.currentCapacityHours) {
          dynamicStatus = "overloaded";
        } else if (totalAssignedHours >= member.currentCapacityHours * 0.7) {
          dynamicStatus = "busy";
        } else {
          dynamicStatus = "available";
        }
      }

      return {
        ...member,
        status: dynamicStatus,
        activeTaskCount: assigned.length,
        totalAssignedHours: Math.round(totalAssignedHours * 10) / 10,
        assignedTasks: assigned,
      };
    });

    return NextResponse.json({ success: true, team: membersWithWorkload });
  } catch (error: any) {
    console.error("GET /api/team error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, role, skills, currentCapacityHours = 40.0, status = "available", notes, email } = body;

    if (!name || !role) {
      return NextResponse.json({ success: false, error: "Name and Role are required" }, { status: 400 });
    }

    const member = await db.teamMember.create({
      data: {
        name: name.trim(),
        role: role.trim(),
        skills: skills?.trim() || "General Motion & Graphics",
        currentCapacityHours: parseFloat(currentCapacityHours) || 40.0,
        status,
        notes: notes || null,
        email: email || null,
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    console.error("POST /api/team error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Member ID is required" }, { status: 400 });
    }

    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.role !== undefined) data.role = updates.role.trim();
    if (updates.skills !== undefined) data.skills = updates.skills.trim();
    if (updates.currentCapacityHours !== undefined) {
      data.currentCapacityHours = parseFloat(updates.currentCapacityHours);
    }
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.email !== undefined) data.email = updates.email;

    const member = await db.teamMember.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    console.error("PUT /api/team error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Member ID is required" }, { status: 400 });
    }

    await db.teamMember.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Member removed from roster" });
  } catch (error: any) {
    console.error("DELETE /api/team error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
