import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};
    if (category && category !== "all") {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const memories = await db.memory.findMany({
      where,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ success: true, memories });
  } catch (error: any) {
    console.error("GET /api/memories error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category = "general_notes", title, content, tags, importance = 3, source = "user_explicit" } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "Title and Content are required" }, { status: 400 });
    }

    const memory = await db.memory.create({
      data: {
        category,
        title: title.trim(),
        content: content.trim(),
        tags: tags || null,
        importance: Number(importance) || 3,
        source,
      },
    });

    return NextResponse.json({ success: true, memory });
  } catch (error: any) {
    console.error("POST /api/memories error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Memory ID is required" }, { status: 400 });
    }

    const data: any = {};
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.title !== undefined) data.title = updates.title.trim();
    if (updates.content !== undefined) data.content = updates.content.trim();
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.importance !== undefined) data.importance = Number(updates.importance);

    const memory = await db.memory.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, memory });
  } catch (error: any) {
    console.error("PUT /api/memories error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Memory ID is required" }, { status: 400 });
    }

    await db.memory.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Memory deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/memories error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
