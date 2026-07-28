import { NextResponse, type NextRequest } from "next/server";
import { fetchWithRetry, getGitHubToken } from "@/utils/ai";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, customInstructions, nichePresetId } = await request.json();
    if (!projectId) return NextResponse.json({ error: "Invalid payload parameters" }, { status: 400 });

    // ── Fetch project + preset ────────────────────────────────────────────────
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { audio: true, nichePreset: true },
    });

    if (!project || project.userId !== user.id)
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });

    if (!project.audio?.transcript)
      return NextResponse.json({ error: "No transcript found for this project." }, { status: 400 });

    const transcript: any[] = project.audio.transcript as any[];

    // ── Resolve brief / style ─────────────────────────────────────────────────
    let briefData: any = {};
    if (project.brief) {
      try { briefData = JSON.parse(project.brief); } catch { /* ignore */ }
    }

    const videoStyle: string = briefData.videoStyle || "doodle";

    const styleDescriptions: Record<string, string> = {
      doodle: "minimalist 2D hand-drawn stick figure doodles (black outline, watercolor paper background)",
      "2d-cartoon": "vibrant, clean 2D cartoon animation style with bold outlines and flat colors",
      "2d-cinematic": "cinematic 2D illustration in beautiful anime/Studio Ghibli style with soft lighting and detailed scenery",
      "3d-pixar": "charming 3D stylized character render in Pixar/Disney style, with warm lighting and soft clay-like textures",
      "3d-realistic": "ultra-realistic 3D cinematic CGI render with dramatic lighting and detailed textures",
      "live-action": "photorealistic live action cinematic B-roll scene with realistic depth of field and natural lighting",
      historical: "oil painting or ancient historical art style matching the specific historical era",
      fantasy: "epic sci-fi or fantasy concept art style with glowing lighting effects and cosmic details",
      retro: "detailed pixel art style with vibrant colors and retro 16-bit gaming aesthetic",
      abstract: "artistic abstract illustration with soft shapes, glowing gradients, and metaphorical designs",
    };

    const styleDesc = styleDescriptions[videoStyle] || styleDescriptions.doodle;

    // ── Resolve preset: body param takes priority over stored project preset ──
    const overrides = (project.presetOverrides as Record<string, any>) ?? {};
    let resolvedPreset = project.nichePreset ? { ...project.nichePreset, ...overrides } : null;

    // If the request body specifies a different (or new) preset, fetch it
    const requestedPresetId: string | null = nichePresetId ?? null;
    if (requestedPresetId && requestedPresetId !== project.nichePresetId) {
      const fetchedPreset = await db.nichePreset.findUnique({ where: { id: requestedPresetId } });
      if (fetchedPreset && fetchedPreset.userId === user.id) {
        resolvedPreset = { ...fetchedPreset, ...overrides };
        // Persist the chosen preset on the project for next time
        await db.project.update({ where: { id: projectId }, data: { nichePresetId: requestedPresetId } });
      }
    } else if (!requestedPresetId && project.nichePresetId) {
      // Explicit "None" selected — detach preset
      resolvedPreset = null;
      await db.project.update({ where: { id: projectId }, data: { nichePresetId: null } });
    }

    const preset = resolvedPreset;

    // ── Build Video Overview Context ──────────────────────────────────────────
    const outlineSummary = Array.isArray(briefData.outline)
      ? briefData.outline
          .map((o: any, idx: number) => `Section ${idx + 1}: ${o.title || "Section"} - ${o.summary || ""}`)
          .join("\n")
      : "No detailed outline available.";

    const videoOverview = `=== VIDEO OVERVIEW (STUDY THIS TO ALIGN SCENE TONE & FLOW) ===
Title: "${project.title || "Untitled Video"}"
Niche: "${project.niche || briefData.niche || "General"}"
Framework: "${briefData.framework || "Standard"}"
Core Thesis/Topic: "${briefData.coreThesis || "General topic"}"

Narrative Outline:
${outlineSummary}

INSTRUCTION: Use the above overview to guide the visual tone, character emotions, and background choice for each scene. Early scenes should match the setup/hook, middle scenes should build engagement and explain concepts, and the last scenes should feel like the climax/resolution. Maintain narrative coherence across all scenes.
=============================================================`;

    // ── Build AI system prompt ────────────────────────────────────────────────
    const systemPrompt = `${videoOverview}

You are a visual scene storyboard generator for Eazi Studio — a professional video creation app.

YOUR TASK:
For EVERY timestamped line in the transcript, generate exactly one scene description. Total scenes MUST equal total lines. Do NOT skip or combine timestamps.

VISUAL STYLE:
Apply this style: "${styleDesc}".
${videoStyle === "doodle"
  ? "For scenes with a human character, describe them as a simple clean stick figure with a round white head and a stick body. Do NOT add accessories or clothing unless instructed."
  : "Describe scenes with detailed character designs matching the style."}

${customInstructions ? `CUSTOM INSTRUCTIONS — apply to EVERY scene:\n${customInstructions}\n` : ""}

BACKGROUND CHOICE (pick whichever fits the emotional tone):
- yellow (calm, insight, neutral)
- black (fear, tension, darkness, mystery)
- white (clarity, peace, revelation)
- red (urgency, danger, climax, warning)
- navy (isolation, loneliness, waiting)
- orange (hope, breakthrough, shift, transformation)

SCENE DESCRIPTION RULES:
1. Translate abstract concepts into clear visual metaphors.
2. Describe the character's pose and facial expression to match the emotion.
3. Be specific and visual — write what an illustrator would literally draw.
4. Do NOT reference any text overlays or typography inside your "scene" field.

OUTPUT FORMAT (JSON only, no markdown):
{
  "prompts": [
    {
      "timestamp": "M:SS",
      "background": "<one of the color words above>",
      "caption": "<short punchy poster-style phrase, max 6 words, emotional core of the line — e.g. 'LUST IS LIKE A SHADOW.' — always generate this regardless of use>",
      "scene": "<literal visual scene description>"
    }
  ]
}`;

    const formattedTranscriptLines = transcript.map((line: any) => {
      const mins = Math.floor(line.startTime / 60);
      const secs = Math.floor(line.startTime % 60);
      return `[${mins}:${String(secs).padStart(2, "0")}] ${line.text}`;
    }).join("\n");

    const userMessage = `Generate exactly ${transcript.length} prompts for the timestamps below. Do NOT skip any:\n${formattedTranscriptLines}`;

    // ── Call GitHub Models (GPT-4o) ───────────────────────────────────────
    const GITHUB_TOKEN = getGitHubToken();
    if (!GITHUB_TOKEN)
      return NextResponse.json({ error: "GitHub Models API token missing." }, { status: 500 });

    const aiResponse = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 16000,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("GitHub API error:", errorText);
      return NextResponse.json({ error: `AI prompt generation failed: ${aiResponse.status}` }, { status: 502 });
    }

    const aiData = await aiResponse.json();
    const responseText: string | undefined = aiData.choices?.[0]?.message?.content;
    if (!responseText) return NextResponse.json({ error: "AI returned an empty response." }, { status: 500 });

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const clean = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        parsed = JSON.parse(clean);
      } catch (err: any) {
        console.error("Failed to parse AI JSON:", clean.slice(0, 500));
        return NextResponse.json({ error: `AI returned invalid JSON. ${err.message}` }, { status: 502 });
      }
    }

    const promptList: any[] = parsed.prompts || [];

    // ── Dynamic background resolver (Eazi Transcribe style) ─────────────────────
    const resolveBackgroundDescription = (bgString: string, presetModifier?: string | null): string => {
      const bgLower = (bgString || "").toLowerCase();
      const presetLower = (presetModifier || "").toLowerCase();
      const baseVignette = "with a subtle vignette and gentle studio lighting";
      const isPaper = presetLower.includes("paper");

      if (bgLower.includes("black") || bgLower.includes("dark")) {
        return isPaper
          ? "soft very light charcoal-gray paper textured background, close to off-white, " + baseVignette
          : "clean flat deep charcoal-black background";
      }
      if (bgLower.includes("white")) {
        return isPaper
          ? "soft very light warm cream paper textured background, almost white, with a gentle central golden glow, " + baseVignette
          : "clean flat soft white background with a gentle warm glow";
      }
      if (bgLower.includes("red")) {
        return isPaper
          ? "soft very light pastel rose-red paper textured background, almost white, " + baseVignette
          : "clean flat deep crimson-red background";
      }
      if (bgLower.includes("blue") || bgLower.includes("navy")) {
        return isPaper
          ? "soft very light pastel slate-blue paper textured background, close to off-white, " + baseVignette
          : "clean flat dark navy-blue background";
      }
      if (bgLower.includes("orange")) {
        return isPaper
          ? "soft very light pastel peach-orange paper textured background, almost white, " + baseVignette
          : "clean flat warm amber-orange background";
      }

      // Default / Yellow
      if (presetModifier && !presetLower.includes("dynamic") && !presetLower.includes("matching scene tone")) {
        return presetModifier;
      }

      return isPaper
        ? "soft very light warm yellow-cream paper textured background, almost white, " + baseVignette
        : "clean flat light warm-yellow background";
    };

    // ── Assemble final prompts ────────────────────────────────────────────────
    await db.scene.deleteMany({ where: { projectId } });

    const sceneData = transcript.map((line: any, idx: number) => {
      const mins = Math.floor(line.startTime / 60);
      const secs = Math.floor(line.startTime % 60);
      const timestampStr = `${mins}:${String(secs).padStart(2, "0")}`;

      let match = promptList.find((p: any) => p.timestamp === timestampStr);
      if (!match && promptList[idx]) match = promptList[idx];

      const sceneText: string = match?.scene ?? "A visual scene matching the narration.";
      const bgKey: string = (match?.background ?? "yellow").toLowerCase().trim();
      const caption: string = match?.caption ?? "";

      const cleanScene = sceneText
        .replace(/^\[\d{1,2}:\d{2}\][:\-\s*\u2022\u2013\u2014]*/, "")
        .replace(/^[:\-\s*\u2022\u2013\u2014]+/, "")
        .trim();

      // Resolve background string — dynamic per scene line (Eazi Transcribe style)
      const bgDesc: string = resolveBackgroundDescription(bgKey, preset?.backgroundModifier);

      // Resolve character clause — preset wins over per-style default
      const characterClause: string = preset?.characterModifier
        ?? (videoStyle === "doodle"
          ? "simple clean stick figure, round white head, dot eyes, single line stick body,"
          : "");

      // Resolve text overlay clause — only when preset enables it AND a caption exists
      const overlayClause: string =
        preset?.textOverlayEnabled && caption
          ? `with the text "${caption.toUpperCase()}" written in clean neat hand-drawn uppercase typography at the top of the image, `
          : "";

      // Resolve extra modifiers
      const extras: string = preset?.extraModifiers?.length
        ? preset.extraModifiers.join(", ")
        : "";

      // Style suffix — "no text overlays" only when not using overlay
      const noOverlayClause = (!preset?.textOverlayEnabled) ? "no text overlays, " : "";

      let stylePrefix: string;
      if (videoStyle === "doodle") {
        stylePrefix = `Minimalist 2D hand-drawn vector art illustration, ${characterClause} ${bgDesc}, ${overlayClause}`;
      } else {
        stylePrefix = `${styleDesc}, ${bgDesc}, ${overlayClause}`;
      }

      const styleSuffix = videoStyle === "doodle"
        ? `, clean lineart, hand-drawn vector sketch style, soft watercolor accents, ${noOverlayClause}no shadows, no 3D elements, no photorealism, 16:9 aspect ratio.`
        : `, highly detailed, ${noOverlayClause}16:9 aspect ratio.`;

      const finalPrompt = `${stylePrefix}${cleanScene}${extras ? `, ${extras}` : ""}${styleSuffix}`;

      return {
        projectId,
        index: idx,
        startTime: line.startTime,
        endTime: line.endTime,
        narration: line.text,
        imagePrompt: finalPrompt,
      };
    });

    await db.scene.createMany({ data: sceneData });
    await db.project.update({ where: { id: projectId }, data: { status: "PROMPTS" } });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Image prompt API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
