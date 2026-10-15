import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get("workspace");

    const where: any = {};
    if (workspace && workspace !== "all") {
      where.workspace = workspace;
    }

    const projects = await db.project.findMany({
      where,
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assignedTo: true,
            dueDate: true,
            deliverableType: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
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
      status = "active",
      category,
      targetDate,
      progress = 0,
      milestones,
      nextAction,
      clientName,
      clientContact,
      clientNotes,
      quotedAmount,
      paidAmount,
      currency = "ETB",
      invoiceStatus,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Project title is required" }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        title: title.trim(),
        workspace,
        description: description?.trim() || null,
        status,
        category: category || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        progress: Number(progress) || 0,
        milestones: typeof milestones === "string" ? milestones : milestones ? JSON.stringify(milestones) : null,
        nextAction: nextAction || null,
        clientName: clientName || null,
        clientContact: clientContact || null,
        clientNotes: clientNotes || null,
        quotedAmount: quotedAmount !== undefined ? parseFloat(quotedAmount) : null,
        paidAmount: paidAmount !== undefined ? parseFloat(paidAmount) : null,
        currency: currency || "ETB",
        invoiceStatus: invoiceStatus || null,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Project ID is required" }, { status: 400 });
    }

    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title.trim();
    if (updates.description !== undefined) data.description = updates.description?.trim() || null;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.workspace !== undefined) data.workspace = updates.workspace;
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.targetDate !== undefined) data.targetDate = updates.targetDate ? new Date(updates.targetDate) : null;
    if (updates.progress !== undefined) data.progress = Number(updates.progress);
    if (updates.milestones !== undefined) {
      data.milestones = typeof updates.milestones === "string" ? updates.milestones : JSON.stringify(updates.milestones);
    }
    if (updates.nextAction !== undefined) data.nextAction = updates.nextAction;
    if (updates.clientName !== undefined) data.clientName = updates.clientName;
    if (updates.clientContact !== undefined) data.clientContact = updates.clientContact;
    if (updates.clientNotes !== undefined) data.clientNotes = updates.clientNotes;
    if (updates.quotedAmount !== undefined) data.quotedAmount = updates.quotedAmount ? parseFloat(updates.quotedAmount) : null;
    if (updates.paidAmount !== undefined) data.paidAmount = updates.paidAmount ? parseFloat(updates.paidAmount) : null;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.invoiceStatus !== undefined) data.invoiceStatus = updates.invoiceStatus;

    const project = await db.project.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("PUT /api/projects error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Project ID is required" }, { status: 400 });
    }

    await db.project.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/projects error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
