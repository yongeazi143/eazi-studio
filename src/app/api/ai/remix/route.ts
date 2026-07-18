import { NextResponse } from "next/server";
import { getGitHubToken } from "@/utils/ai";
export const dynamic = "force-dynamic";

function chunkTranscript(text: string, maxWordsPerChunk = 3000): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
  }
  
  return chunks;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delayMs = 1500
): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        attempt++;
        if (attempt >= maxRetries) {
          return res;
        }
        const backoff = delayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`429 Rate limited. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return res;
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const backoff = delayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`Fetch error. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Max retries reached");
}

async function runStageAChunk(
  chunkText: string,
  chunkIdx: number,
  totalChunks: number,
  sourceTitle: string,
  githubToken: string
) {
  const systemPrompt = `You are a script structure analyst and content summarizer.
Your goal is to extract the structure and core content of a raw YouTube transcript chunk.
You must return a strictly valid JSON object matching the schema below.
Do not wrap your output in markdown fences, and do not write any commentary or prose.

Output schema:
{
  "summary": "A 2-3 sentence summary of what was said in this specific chunk.",
  "keyTeachings": [
    {
      "topic": "The title of the concept or teaching topic covered in this chunk (e.g., 'Time Management')",
      "description": "Core explanation of the concept or teaching.",
      "actionableAdvice": "Concrete, practical action steps based on the teaching."
    }
  ],
  "hookType": "bold_claim" | "question" | "result_first" | "scenario" | "contrarian" | "other" | null,
  "hookSummary": "A paraphrase of the hook's mechanism (how the creator grabbed attention), not its exact wording. Only extract if chunkIdx is 0, else null.",
  "bestAnalogies": [
    { "concept": "The concept explained in this chunk", "analogyDomain": "The concrete domain used for the metaphor (e.g. concept: 'compound interest', analogyDomain: 'snowball rolling downhill')" }
  ],
  "ctaStyle": "The style of the call to action at the end. Only extract if chunkIdx is the last chunk, else null."
}

RULES:
- Under 'keyTeachings', aim to capture 1-3 teachings introduced in this chunk.
- If information for a field is absent or not relevant to this chunk, use null or an empty array.`;

  const userContent = `SOURCE_TITLE: "${sourceTitle}"
CHUNK ${chunkIdx + 1} OF ${totalChunks}:
"""
${chunkText}
"""`;

  const res = await fetchWithRetry("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chunk Stage A failed for chunk ${chunkIdx + 1}: ${res.status} ${text}`);
  }

  const data = await res.json();
  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error(`Empty response from Chunk Stage A for chunk ${chunkIdx + 1}`);
  }

  try {
    return JSON.parse(textContent);
  } catch (e) {
    const cleanText = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  }
}

async function runStageASynthesis(
  chunkDeconstructions: any[],
  sourceTitle: string,
  sourceUrl: string,
  githubToken: string
) {
  const systemPrompt = `You are a content synthesizer.
Your goal is to merge multiple segment deconstructions of a single YouTube video into a unified, coherent deconstruction JSON object.
You must return a strictly valid JSON object matching the schema below.
Do not wrap your output in markdown fences, and do not write any commentary or prose.

Output schema:
{
  "summary": "A 2-3 sentence overall summary of the entire video and its main theme.",
  "keyTeachingsTitle": "A descriptive title for the teachings (e.g. 'Key Currencies of Destiny' or 'Key Lessons from this Sermon')",
  "keyTeachings": [
    {
      "topic": "The title of the concept or teaching topic (e.g., 'Time Management')",
      "description": "Core explanation of the concept or teaching.",
      "actionableAdvice": "Concrete, practical action steps based on the teaching."
    }
  ],
  "conclusion": "A summary warning or takeaway representing the speaker's concluding message.",
  "hookType": "bold_claim" | "question" | "result_first" | "scenario" | "contrarian" | "other",
  "hookSummary": "A paraphrase of the hook's mechanism (how the creator grabbed attention), not its exact wording.",
  "structuralBeats": [
    { "beatSummary": "Summary of the beat's mechanism", "technique": "The structural/retention technique used", "approxTimestampSeconds": number }
  ],
  "bestAnalogies": [
    { "concept": "The concept explained", "analogyDomain": "The concrete domain used for the metaphor (e.g. concept: 'compound interest', analogyDomain: 'snowball rolling downhill')" }
  ],
  "pacingNotes": "Pacing description (sentence length, tone).",
  "ctaStyle": "The style of the call to action at the end."
}

RULES:
- Synthesize duplicate or highly similar key teachings across chunks into a single clean list of 3-5 key teachings.
- Combine the pacing notes, structural beats, and analogies into a single synthesized set.
- Ensure the overall summary and conclusion represent the entire video's message.
- If information is missing, use default values or null.`;

  const userContent = `SOURCE_TITLE: "${sourceTitle}"
SOURCE_URL: "${sourceUrl}"
SEGMENT_DECONSTRUCTIONS:
${JSON.stringify(chunkDeconstructions, null, 2)}`;

  const res = await fetchWithRetry("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stage A Synthesis failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error("Empty response from Stage A Synthesis");
  }

  try {
    return JSON.parse(textContent);
  } catch (e) {
    const cleanText = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  }
}

async function runStageA(
  source: { title: string; url: string; transcript: string },
  githubToken: string
) {
  const chunks = chunkTranscript(source.transcript, 3000);
  if (chunks.length === 0) {
    throw new Error(`No transcript available to process for "${source.title}"`);
  }

  const chunkDeconstructions = [];
  for (let i = 0; i < chunks.length; i++) {
    const decomp = await runStageAChunk(chunks[i], i, chunks.length, source.title, githubToken);
    chunkDeconstructions.push(decomp);
  }

  const synthesized = await runStageASynthesis(chunkDeconstructions, source.title, source.url, githubToken);
  return synthesized;
}

async function runStageB(
  opts: {
    topic: string;
    niche: string;
    duration: string;
    videoStyle: string;
    styleDescription: string;
    framework: string;
    deconstructions: any[];
    githubToken: string;
  }
) {
  const systemPrompt = `You are the lead scriptwriter for Eazi Studio, a faceless YouTube animation brand.
You will receive STRUCTURAL ANALYSES AND CONTENT SUMMARIES of 1-5 top-performing videos on the same topic.
Your job is to identify the highest-converting patterns across them and design a NEW, original outline brief — never a paraphrase or recombination of any single source's wording.

Hard rules:
1. You have not seen any source's actual sentences — only their structural patterns and key points. Do not attempt to reconstruct or imply specific phrasing from them.
2. Every analogy you produce must map the concept to a DIFFERENT concrete domain than any analogyDomain listed in the input.
3. Structure the outline using Eazi Studio's four-part template: hook, bridge, 4-6 milestones (setup/tension/payoff), integrated CTA.
4. Every beat needs a "visualCue" — a one-line description of the B-roll/scene matching the selected style: "${opts.styleDescription}". Do NOT output stickman descriptions unless the selected style is "doodle". Keep visual descriptions tailored strictly to this aesthetic.
5. You MUST weave the key teachings (topics, descriptions, and actionable advice) extracted from the source material into the outline milestones so that they are explicitly covered in our outline!
6. Respond with ONLY valid JSON matching the schema below. No prose, no markdown fences.

Output schema:
{
  "titleCandidates": [
    { "title": "CTR 98% Title Candidate", "score": 98 },
    { "title": "CTR 92% Title Candidate", "score": 92 },
    { "title": "CTR 85% Title Candidate", "score": 85 },
    { "title": "CTR 81% Title Candidate", "score": 81 },
    { "title": "CTR 76% Title Candidate", "score": 76 }
  ],
  "hookCandidates": [
    { "type": "bold_claim", "text": "Hook text option 1", "onScreenText": "CAPTION TEXT" },
    { "type": "scenario", "text": "Hook text option 2", "onScreenText": "CAPTION TEXT" },
    { "type": "contrarian", "text": "Hook text option 3", "onScreenText": "CAPTION TEXT" }
  ],
  "outline": [
    {
      "id": string,
      "section": "hook" | "bridge" | "milestone" | "cta",
      "beatType": string, // framework-specific beat type
      "title": "Beat Title",
      "summary": "Brief summary of what this beat teaches/explains, explicitly incorporating lessons from the source key teachings and actionable advice.",
      "keyAnalogy": "Concrete metaphor or analogy (optional, else null)",
      "visualCue": "Scene drawing direction matching the visual style",
      "estimatedSeconds": number
    }
  ],
  "ctaPlan": {
    "primaryAsk": "subscribe" | "watch_next" | "comment" | "like",
    "scriptLine": "Final spoken call-to-action line"
  }
}

Title Formatting Conventions (apply real YouTube title patterns, not generic sentence-case titles):
- Selective ALL CAPS: capitalize ONE (occasionally two) high-impact word(s) per title for emphasis — e.g. the surprising word, the number, or the payoff word. Never cap the whole title. Example: "I Tried This for 30 Days and It Was INSANE" not "i tried this for 30 days and it was insane" and not "I TRIED THIS FOR 30 DAYS."
- Numerals over spelled-out numbers: "5 Habits" not "Five Habits".
- Brackets/parentheses for context tags where natural: "(Not What You Think)", "[Real Talk]", "(Explained Simply)" — use sparingly, at most one per title.
- Curiosity gap phrasing: withhold the payoff ("The Real Reason...", "Nobody Tells You This About...", "Why This Actually Works") rather than stating the full answer in the title.
- Colon subtitle structure is allowed for clarity: "Stoicism: The One Habit That Changes Everything".
- Power/emotion words used naturally (not stacked): Secret, Truth, Mistake, Nobody, Actually, Real, Finally — pick one angle, don't cram three into one title.
- Emojis: at most one, only if it reads naturally for the niche/style (e.g. faith or educational content should generally skip emojis entirely; use judgment based on the niche field).
- Vary the 5 candidates across DIFFERENT conventions above — don't apply the same formatting trick to all 5. At least one candidate should be a clean, no-gimmick title as a control/baseline.
- Do not overdo punctuation (no "!!!", no more than one "?" per title).

We support 10 distinct script frameworks. You must generate the outline beats matching the chosen framework key ("${opts.framework}"):

1. "stoic_explainer" (Educational / Stoic Explainer):
   - hook: Promise-Solution-Proof.
   - bridge: "Guide, Not Guru" concept intro.
   - milestone (beatType: "concept_what"): Define the concept with 1 analogy (3-step analogy technique).
   - milestone (beatType: "concept_why"): Why the mind resists it (tension).
   - milestone (beatType: "concept_how"): Concrete 1-2 step practice.
   - milestone (beatType: "concept_story"): An illustrative anecdote.
   - cta: Hook-Curiosity-Action.

2. "narrative_documentary" (Narrative Documentary):
   - hook (beatType: "cold_open"): Factual cold open or climax preview.
   - bridge (beatType: "act_1_setup"): Context & stakes.
   - milestone (beatType: "act_2_complication"): 2-3 complications of escalating stakes.
   - milestone (beatType: "act_2_rehook"): Midpoint re-hook/attention reset.
   - milestone (beatType: "act_3_climax"): Climax/Turn.
   - milestone (beatType: "resolution"): New reality post-turn.
   - cta: lingering mystery CTA pointing to next video.

3. "viral_listicle" (Viral Listicle / Compilation):
   - hook: Context Lean -> Scroll Stop -> Contrarian Snapback.
   - bridge: criteria/stakes.
   - milestone (beatType: "list_item"): Countdown of items (Rehook breadcrumb at start of each item).
   - cta: next list CTA.

4. "case_study_breakdown" (Case Study / Analytical Breakdown):
   - hook: Question -> Preview.
   - bridge: 5-Line Core Setup (Situation & Desire).
   - milestone (beatType: "what_happened"): Factual timeline.
   - milestone (beatType: "why_mechanism"): Explaining the secret mechanism (Interactive Tension).
   - milestone (beatType: "what_to_apply"): Actionable viewer takeaway.
   - cta: Next case study CTA.

5. "shortform_hook_loop" (Short-Form Hook Loop under 60s):
   - hook (beatType: "instant_hook"): Shocking question hook.
   - milestone (beatType: "core_loop"): One main loop (Setup-Tension-Payoff).
   - cta (beatType: "loop_back"): closing line loops back to opening line.

6. "first_person_narrative" (First-Person Narrative / Personal Essay):
   - hook: Vulnerability to Authority hook.
   - bridge: Why sharing now / deeper emotional problem.
   - milestone (beatType: "vulnerable_beat"): trials & lowest point (Crisis).
   - milestone (identity_shift): identity shift payoff.
   - cta: reflective CTA.

7. "mythology_fable" (Mythology / Fable Narrative):
   - hook: Grand promise of the legend.
   - bridge: World-building.
   - milestone (beatType: "situation"): Situation of the myth.
   - milestone (beatType: "desire"): Desire of protagonist.
   - milestone (beatType: "conflict_trial"): The Trial (using but/therefore pacing).
   - milestone (beatType: "change"): Turning point.
   - milestone (beatType: "result"): Moral lesson.
   - cta: next fable CTA.

8. "contrarian_debunking" (Contrarian Debunking):
   - hook: Scroll Stop -> Contrarian Snapback.
   - bridge: Why the myth persists.
   - milestone (beatType: "myth_restate"): Sub-claim debunking (Evidence & Reframe).
   - cta: solution CTA.

9. "interactive_quiz" (Interactive Quiz / Q&A):
   - hook: Challenge viewer intelligence.
   - bridge: Rules & Stakes.
   - milestone (beatType: "question"): Pose question.
   - milestone (beatType: "pause"): Guess timer.
   - milestone (beatType: "reveal"): Reveal answer.
   - milestone (beatType: "explanation"): Snappy explanation.
   - cta: Level 2 quiz CTA.

10. "comparative_showdown" (Comparative Showdown / Versus):
    - hook: Contenders + stakes.
    - bridge: Selection criteria.
    - milestone (beatType: "criterion"): Round criterion.
    - milestone (beatType: "contender_a_case"): A's argument.
    - milestone (beatType: "contender_b_case"): B's argument.
    - milestone (beatType: "round_winner"): Round winner call.
    - milestone (beatType: "finalVerdict"): Final overall winner.
    - cta: next matchup CTA.`;

  const userContent = `TOPIC: "${opts.topic}"
NICHE: "${opts.niche}"
TARGET_DURATION: "${opts.duration}"
VISUAL_STYLE: "${opts.videoStyle}" (Description: "${opts.styleDescription}")
FRAMEWORK_KEY: "${opts.framework}"

SOURCE_ANALYSES (structural & content key points):
${JSON.stringify(opts.deconstructions, null, 2)}

Identify the most powerful teachings and points across the source key points and design an outline that covers these key teachings while maintaining Eazi Studio's framework beats and visual cue style.
`;

  let responseText = "";
  try {
    const res = await fetchWithRetry("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${opts.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`openai/gpt-4o returned ${res.status}. Falling back to openai/gpt-4o-mini.`);
      throw new Error(`Upstream status: ${res.status}`);
    }

    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || "";
  } catch (e) {
    const res = await fetchWithRetry("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${opts.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stage B failed on both gpt-4o and gpt-4o-mini: ${res.status} ${text}`);
    }

    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || "";
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    const cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  }
}

export async function POST(request: Request) {
  try {
    const {
      topic,
      niche,
      duration,
      videoStyle,
      framework = "stoic_explainer",
      sources,
    } = await request.json();

    const GITHUB_TOKEN = getGitHubToken();

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GitHub Models API token is missing in environment variables." },
        { status: 500 }
      );
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: "At least one source with a transcript is required." },
        { status: 400 }
      );
    }

    const styleDescriptions: Record<string, string> = {
      doodle:
        "minimalist 2D hand-drawn stick figure doodles (yellow fill, black outline, dot eyes, circular head, watercolor paper background)",
      "2d-cartoon":
        "vibrant, clean 2D cartoon animation style with bold outlines and flat colors",
      "2d-cinematic":
        "cinematic 2D illustration in beautiful anime/Studio Ghibli style with soft lighting and detailed scenery",
      "3d-pixar":
        "charming 3D stylized character render in Pixar/Disney style, with warm lighting and soft clay-like textures",
      "3d-realistic":
        "ultra-realistic 3D cinematic CGI render with dramatic lighting and detailed textures",
      "live-action":
        "photorealistic live action cinematic B-roll scene with realistic depth of field and natural lighting",
      historical:
        "oil painting or ancient historical art style matching the specific historical era",
      fantasy:
        "epic sci-fi or fantasy concept art style with glowing lighting effects and cosmic details",
      retro:
        "detailed pixel art style with vibrant colors and retro 16-bit gaming aesthetic",
      abstract:
        "artistic abstract illustration with soft shapes, glowing gradients, and metaphorical designs",
    };

    const chosenStyleDescription =
      styleDescriptions[videoStyle] || styleDescriptions.doodle;

    // Stage A: Deconstruct and summarize each video transcript sequentially (to avoid API rate limiting/concurrency limit)
    const deconstructions = [];
    for (const source of sources) {
      try {
        const decomp = await runStageA(source, GITHUB_TOKEN);
        deconstructions.push({
          title: source.title,
          url: source.url,
          ...decomp,
        });
      } catch (err: any) {
        console.error(`Deconstruction failed for ${source.title}:`, err);
        deconstructions.push({
          title: source.title,
          url: source.url,
          summary: `Could not parse summary due to error.`,
          keyTeachingsTitle: "Key Takeaways",
          keyTeachings: [],
          conclusion: "",
          hookType: null,
          hookSummary: null,
          structuralBeats: [],
          bestAnalogies: [],
          pacingNotes: "",
          ctaStyle: null,
        });
      }
    }

    // Stage B: Synthesize deconstructions into outline brief
    const synthesizedBrief = await runStageB({
      topic: topic || "Synthesized concept based on references",
      niche,
      duration,
      videoStyle,
      styleDescription: chosenStyleDescription,
      framework,
      deconstructions,
      githubToken: GITHUB_TOKEN,
    });

    // Populate source summaries directly from Stage A outputs
    const sourceSummaries = deconstructions.map((d) => ({
      title: d.title,
      url: d.url,
      summary: d.summary,
      keyTeachingsTitle: d.keyTeachingsTitle || "Key Takeaways",
      keyTeachings: d.keyTeachings || [],
      conclusion: d.conclusion || "",
    }));

    // Merge into response
    const result = {
      ...synthesizedBrief,
      sourceSummaries,
    };

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("AI Remix Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
