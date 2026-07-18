import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference/chat/completions';

interface TranscriptLineInput {
  startTime: number;
  endTime: number;
  text: string;
  hasPauseBefore: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, durationSecs, transcript } = await request.json();

    if (!projectId || !durationSecs || !transcript || !Array.isArray(transcript)) {
      return NextResponse.json({ error: "Invalid payload parameters" }, { status: 400 });
    }

    // Verify project owner
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { audio: true }
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // 1. Save or Update Audio record
    const audio = await db.audio.upsert({
      where: { projectId },
      update: {
        durationSecs,
        transcript: transcript as any,
      },
      create: {
        projectId,
        audioUrl: `indexeddb://${projectId}`,
        durationSecs,
        transcript: transcript as any,
      }
    });

    // Advance project status to TRANSCRIPT
    await db.project.update({
      where: { id: projectId },
      data: { status: "TRANSCRIPT" }
    });

    return NextResponse.json({ success: true, audio });

  } catch (error: any) {
    console.error("Audio API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
