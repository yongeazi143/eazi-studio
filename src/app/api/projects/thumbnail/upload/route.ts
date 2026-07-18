import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, base64Image, conceptId = "concept_1" } = await request.json();
    if (!projectId || !base64Image) {
      return NextResponse.json({ error: "Missing projectId or base64Image" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized access to project" }, { status: 403 });
    }

    // Construct base64 Data URL (e.g., data:image/png;base64,...)
    const imageUrl = base64Image.startsWith("data:")
      ? base64Image
      : `data:image/png;base64,${base64Image}`;

    // Optionally save locally (catch error silently on Vercel)
    try {
      const publicDir = path.join(process.cwd(), "public");
      const outputFolder = path.join(publicDir, "generated-images", projectId);
      const outputFilename = `thumbnail-${conceptId}.png`;
      const outputPath = path.join(outputFolder, outputFilename);
      fs.mkdirSync(outputFolder, { recursive: true });
      const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");
      fs.writeFileSync(outputPath, buffer);
    } catch (fsErr) {
      console.warn("Could not save thumbnail to local file system (expected on read-only environments like Vercel):", fsErr);
    }

    // Read existing brief JSON
    let briefData: any = {};
    if (project.brief) {
      try {
        briefData = JSON.parse(project.brief);
      } catch (e) {}
    }

    // Update the image URL inside the matching concept
    const thumbnailConcepts = briefData.thumbnailConcepts || [];
    const targetConcept = thumbnailConcepts.find((c: any) => c.id === conceptId);
    if (targetConcept) {
      targetConcept.imageUrl = imageUrl;
    }

    // Update brief JSON
    const updatedBrief = {
      ...briefData,
      thumbnailConcepts,
      selectedConceptId: conceptId
    };

    // Save updated brief in Project
    await db.project.update({
      where: { id: projectId },
      data: {
        brief: JSON.stringify(updatedBrief),
        status: "THUMBNAIL"
      }
    });

    // Update active thumbnailUrl in VideoMetadata table
    await db.videoMetadata.upsert({
      where: { projectId },
      update: {
        thumbnailUrl: imageUrl,
      },
      create: {
        projectId,
        title: project.title,
        description: "",
        tags: [],
        thumbnailUrl: imageUrl,
      }
    });

    return NextResponse.json({
      success: true,
      thumbnailUrl: imageUrl,
      thumbnailConcepts
    });

  } catch (err: any) {
    console.error("Thumbnail upload error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
