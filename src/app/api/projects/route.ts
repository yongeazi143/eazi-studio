import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/projects - List all projects for current user or fetch a specific project by id
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure Prisma User exists to avoid DB foreign key errors
    await db.user.upsert({
      where: { id: user.id },
      update: { email: user.email || "" },
      create: { id: user.id, email: user.email || "" },
    });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const project = await db.project.findUnique({
        where: { id },
        include: {
          script: true,
          audio: true,
          scenes: true,
          metadata: true,
        }
      });
      if (!project || project.userId !== user.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ project });
    }

    const projects = await db.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        script: true,
        audio: true,
        scenes: true,
        metadata: true,
      }
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("List projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, niche, brief } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Ensure Prisma User exists to avoid DB foreign key errors
    await db.user.upsert({
      where: { id: user.id },
      update: { email: user.email || "" },
      create: { id: user.id, email: user.email || "" },
    });

    const project = await db.project.create({
      data: {
        userId: user.id,
        title,
        niche: niche || null,
        brief: brief ? JSON.stringify(brief) : null,
        status: "IDEA",
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/projects - Update an existing project
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, niche, brief, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Ensure Prisma User exists to avoid DB foreign key errors
    await db.user.upsert({
      where: { id: user.id },
      update: { email: user.email || "" },
      create: { id: user.id, email: user.email || "" },
    });

    // Verify ownership
    const existing = await db.project.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const project = await db.project.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        niche: niche !== undefined ? niche : existing.niche,
        brief: brief !== undefined ? (brief ? JSON.stringify(brief) : null) : existing.brief,
        status: status !== undefined ? status : existing.status,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Update project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/projects - Delete a project
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Verify ownership
    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // Delete cascading items first due to foreign keys
    await db.script.deleteMany({ where: { projectId: id } });
    await db.audio.deleteMany({ where: { projectId: id } });
    await db.scene.deleteMany({ where: { projectId: id } });
    await db.videoMetadata.deleteMany({ where: { projectId: id } });
    
    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
