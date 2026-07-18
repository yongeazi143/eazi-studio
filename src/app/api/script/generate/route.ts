import { NextResponse, type NextRequest } from 'next/server';
import { fetchWithRetry, getGitHubToken } from '@/utils/ai';
import { db } from '@/utils/db';
import { createClient } from '@/utils/supabase/server';

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference/chat/completions';

const FRAMEWORK_PROMPTS: Record<string, string> = {
  stoic_explainer: `Structure the body as exactly four milestones in this fixed order — WHAT, WHY, HOW, STORY. Do not reorder or merge them.
Rules:
1. WHAT must include exactly one analogy using the 3-step technique (name the abstract idea → map to a concrete image → return with new clarity).
2. HOW must contain at most 2 discrete action steps. Focus on simplicity; do not present a checklist longer than 2 items.
3. STORY must be told in scene (specific moment, sensory detail) — not summarized as a dry lesson. Do not append an explicit "the moral of this is..." line.
4. Connect every milestone to the next using "but" or "therefore" — never "and then".`,

  narrative_documentary: `Structure the body as a 3-act macro-structure: ACT 1 (setup), ACT 2 (2-3 escalating complications + one midpoint re-hook), ACT 3 (climax + resolution).
Rules:
1. Open with a Cold Open beat — a moment from later in the story, or a striking factual claim — before any orienting context. Do not begin with standard scene-setting.
2. Each Act 2 milestone's stakes must be strictly greater than the previous one. Raise the stakes explicitly in each block.
3. Insert one re-hook breadcrumb at the Act 2 midpoint (~45-55% through the body): state a new unresolved question.
4. Every beat needs a richly specific scene narrative matching the outline.`,

  viral_listicle: `Structure the body as N repeated item blocks in countdown or build order.
Rules:
1. The Hook must plant a specific, nameless tease pointing at the #1 item ("and #3 might be the one you didn't expect"). Do not resolve this tease early.
2. Each item block is Reveal → Detail → Payoff. Cap each item at 120–180 words to keep pacing brisk.
3. Every item's Detail must include at least one concrete specific (a number, named example, or named source).
4. Order items so the single most surprising or counter-intuitive entry lands at #1.
5. Do not add a CTA after every item — only after the final one.`,

  case_study_breakdown: `Structure the body as a strict 3-part macro-shape: WHAT HAPPENED, WHY IT WORKED/FAILED, WHAT YOU CAN APPLY.
Rules:
1. Include at least 3 concrete specifics (numbers, named entities, dates) drawn only from the brief's source material.
2. WHAT YOU CAN APPLY must translate the mechanism into an action the average viewer could realistically take — not a scaled-down version of what only a massive brand/subject could do.
3. Name the underlying mechanism explicitly in one sentence before moving into WHAT YOU CAN APPLY ("what actually happened here wasn't X, it was Y").`,

  shortform_hook_loop: `Structure the body as exactly ONE Setup-Tension-Payoff loop. Do not generate multiple milestones.
Rules:
1. Hard cap: 120-150 words total across the entire script (hook + loop + loop-back combined).
2. No greeting, no channel reference, no "in this video" framing of any kind.
3. The closing line must structurally echo the opening line (repeat a key phrase or image) so the video loops seamlessly on replay.
4. Do not include a spoken subscribe/follow CTA.`,

  first_person_narrative: `Structure the body as 3-4 milestones in first-person voice throughout — no third-person narration.
Rules:
1. Each milestone must include at least one specific sensory or emotional detail (a place, physical sensation, exact phrase spoken) — never generic feeling statements.
2. Do not moralize or lecture. Reflect on what the narrator learned.
3. Build a visible internal change across the milestones: the narrator's understanding at the final milestone must be different from the hook.
4. CTA must invite reflection or comment ("have you felt this too?") rather than pitch a hard subscribe.`,

  mythology_fable: `Structure the body strictly as the 5-Line Core: SITUATION, DESIRE, CONFLICT (may split into 2 Trial beats), CHANGE (Turning Point), RESULT — followed by a separate MORAL beat before the CTA.
Rules:
1. Preserve factual/narrative fidelity to the source story — do not invent plot events or outcomes.
2. The MORAL beat must explicitly connect the story's resolution to a specific modern situation the viewer might face.
3. Narrator voice: slightly elevated and storytelling in register, but never academic or sermon-like (Guide, Not Guru).`,

  contrarian_debunking: `Structure the body as 3-4 Evidence Loops: RESTATE sub-claim → EVIDENCE against it → REFRAME (the corrected understanding).
Rules:
1. Every debunking claim must be grounded in the brief's source material. Never invent a rebuttal or a "fact".
2. State the popular belief fully and fairly in the Hook before challenging it.
3. Every Evidence Loop's REFRAME must offer a constructive corrected understanding — never end a loop on pure negation.`,

  interactive_quiz: `Structure the body as N Question Rounds, each following the fixed 4-beat shape: QUESTION, PAUSE, REVEAL, EXPLANATION.
Rules:
1. The PAUSE beat is mandatory and must prompt an on-screen timer/countdown.
2. Order rounds by ascending difficulty — easiest question first, hardest last.
3. Cap each EXPLANATION beat at 40-60 words to keep pacing snappy.
4. Do not write "trick" questions.`,

  comparative_showdown: `Structure the body as N Rounds, each following the fixed shape: CRITERION, CONTENDER_A_CASE, CONTENDER_B_CASE, ROUND_WINNER.
Rules:
1. State all criteria in the Bridge before Round 1.
2. Apply criteria consistently across contenders.
3. Include at least one round where the expected favorite loses.
4. Cap each contender's case within a round at 60-90 words.
5. The Final Verdict must transparently total the round wins.`
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, regenerate = false, styleOverrides = {} } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { script: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized project access' }, { status: 403 });
    }

    if (project.script && !regenerate) {
      return NextResponse.json({ error: 'Script already exists. Pass regenerate: true to overwrite.' }, { status: 409 });
    }

    if (!project.brief) {
      return NextResponse.json({ error: 'Project brief is missing. Run ideation first.' }, { status: 422 });
    }

    let briefData;
    try {
      briefData = JSON.parse(project.brief);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid project brief format in database.' }, { status: 422 });
    }

    const frameworkKey = briefData.framework || 'stoic_explainer';
    const frameworkRulePrompt = FRAMEWORK_PROMPTS[frameworkKey] || FRAMEWORK_PROMPTS.stoic_explainer;

    const tone = styleOverrides.tone || briefData.toneNotes || 'warm, direct, conversational (Guide, Not Guru)';

    // Parse duration from the saved brief (e.g. "8-10 mins", "5 mins", "10-15 mins")
    // Take the upper bound of a range, or the single value, defaulting to 10
    const parseDurationToMinutes = (durationStr: string): number => {
      if (!durationStr) return 10;
      const matches = durationStr.match(/(\d+)/g);
      if (!matches) return 10;
      const nums = matches.map(Number);
      // Take the higher value of a range (or the only value)
      return Math.max(...nums);
    };

    const briefDuration = briefData.duration || '';
    const targetLength = styleOverrides.targetLengthMinutes || parseDurationToMinutes(briefDuration);

    // Scale max_tokens: ~150 words/min spoken, ~1.3 tokens/word = ~195 tokens/min. Add 20% headroom.
    const tokensForLength = Math.round(targetLength * 195 * 1.2);
    const maxTokens = Math.min(Math.max(tokensForLength, 3000), 8000);

    // Compile the outline beats text representation
    const outlineText = briefData.outline?.map((beat: any, idx: number) => {
      return `Beat ${idx + 1}:
- Section: ${beat.section}
- Beat Type: ${beat.beatType || 'N/A'}
- Title: ${beat.title}
- Summary: ${beat.summary}
- Metaphor/Analogy: ${beat.keyAnalogy || 'None'}
- Visual Direction: ${beat.visualCue || 'None'}
- Est. Duration: ${beat.estimatedSeconds}s`;
    }).join('\n\n') || 'No outline beats provided.';

    let keyPointsText = "";
    if (briefData.sourceSummaries && Array.isArray(briefData.sourceSummaries) && briefData.sourceSummaries.length > 0) {
      keyPointsText = `SOURCE MATERIAL KEY TAKEAWAYS & TEACHINGS:
${briefData.sourceSummaries.map((s: any, idx: number) => {
  const teachingsTitle = s.keyTeachingsTitle || "Key Teachings";
  const teachings = s.keyTeachings && Array.isArray(s.keyTeachings) && s.keyTeachings.length > 0
    ? s.keyTeachings.map((t: any, tIdx: number) => 
        `${tIdx + 1}. ${t.topic || 'N/A'}:\n   - Core Concept: ${t.description || 'N/A'}\n   - Actionable Advice: ${t.actionableAdvice || 'N/A'}`
      ).join('\n')
    : "- No key teachings listed.";
  const conclusion = s.conclusion ? `Conclusion/Warning: ${s.conclusion}` : "";
  
  return `Video ${idx + 1} ("${s.title}"):
Summary: ${s.summary || 'N/A'}
${teachingsTitle}:
${teachings}
${conclusion}`;
}).join('\n\n')}\n\n`;
    }

    const systemPrompt = `You are the lead YouTube scriptwriter for Eazi Studio.
Your task is to write a complete, high-retention video script based on a provided outline brief AND the key teachings extracted from the reference source videos.

CRITICAL RULE — SOURCE INTEGRATION:
The source material key takeaways and teachings listed in the user prompt are REAL content extracted from top-performing YouTube videos on this exact topic.
You MUST explicitly incorporate the specific points, concepts, actionable advice, and examples from these source teachings into the body of the script — not just as background context but as spoken narration.
Each body milestone should weave in at least one specific point, example, or actionable insight drawn directly from the source material. Do NOT write generic knowledge — use what the sources actually teach.
If a source has an analogy or concrete example, adapt it (don't copy it verbatim — create an original delivery of the same concept).

CRITICAL RULE — NO SOURCE CITATIONS OR SPEAKER REFERENCES:
- NEVER mention or write source names, speaker names, channel names, or video numbers in the script (e.g. do NOT say "Video 1 says", "Pastor Y explains", "According to Channel Z", "as Zoutuber A said").
- Do NOT use any attribution tags.
- Present all ideas, teachings, stories, and warnings organically as if they are the NARRATOR's own direct words, thoughts, and research lessons. Talk directly to the viewer. Integrate the research concepts seamlessly into the script's flow without referencing that they came from external videos.

GLOBAL RETENTION RULES:
1. No "And Then" Connections: Connect all narrative milestones using "but" (introducing conflict) or "therefore" (showing consequence) to create dynamic pacing.
2. Staccato Openings: Use short, punchy sentences in the first 30 seconds to increase the density of value per word.
3. Guide, Not Guru Tone: Relational, authentic tone that shows credibility through vulnerability and avoids a dry academic style.
4. Mid-video Re-hooks / Attention Resets: At roughly the 50% mark, make sure to insert a rehook phrase that introduces a new roadblock.
5. No Standard CTAs: Always use Hook-Curiosity-Action (HCA) to point directly to a specific "watch next" video suggestion, strictly avoiding boring "please subscribe" pitches.
6. Write for the Ear: Keep sentences conversational, easy to read aloud, and direct.

FRAMEWORK SPECIFIC RULES (Key: ${frameworkKey}):
${frameworkRulePrompt}

OUTPUT FORMAT:
Provide the full script text. Separate major sections using capital headers in brackets: [HOOK], [BRIDGE], [BODY], and [CTA] or [MILESTONES]. Do NOT output any markdown comments, formatting notes, or metadata. Output ONLY the spoken narration text.`;

    const userPrompt = `Project Title: ${project.title}
Niche: ${project.niche || 'General'}
Tone Override: ${tone}
Target Length: ${targetLength} minutes (IMPORTANT: write enough content to fill ${targetLength} full minutes of spoken narration — approximately ${Math.round(targetLength * 150)} words minimum)

${keyPointsText}OUTLINE BRIEF:
${outlineText}

CTA PLAN:
Primary Ask: ${briefData.ctaPlan?.primaryAsk || 'watch_next'}
Script Line Reference: ${briefData.ctaPlan?.scriptLine || 'Watch the next video.'}

FINAL INSTRUCTION: Write the complete spoken script now. Every body milestone MUST explicitly draw from the SOURCE MATERIAL KEY TAKEAWAYS listed above. However, you must NEVER reference the source titles, speaker names, channel names, or video numbers (do not say "Video 1", "Pastor X", "according to Y"). Present all teachings organically as your own direct voiceover narration.`;

    const GITHUB_TOKEN = getGitHubToken();
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GitHub Models token is missing on the server.' }, { status: 500 });
    }

    const aiResponse = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      cache: 'no-store'
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('GitHub API error during script generation:', errorText);
      return NextResponse.json({ error: `AI generator failed with status: ${aiResponse.status}` }, { status: 502 });
    }

    const responseData = await aiResponse.json();
    const scriptContent = responseData.choices?.[0]?.message?.content;

    if (!scriptContent) {
      return NextResponse.json({ error: 'Empty script returned by the AI model.' }, { status: 500 });
    }

    // Upsert the Script row
    const script = await db.script.upsert({
      where: { projectId },
      update: {
        content: scriptContent,
        version: { increment: 1 }
      },
      create: {
        projectId,
        content: scriptContent,
        version: 1
      }
    });

    // Advance project status to SCRIPT
    await db.project.update({
      where: { id: projectId },
      data: { status: 'SCRIPT' }
    });

    return NextResponse.json({ success: true, script });

  } catch (error: any) {
    console.error('Generate script error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
