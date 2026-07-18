/**
 * segmentUtils.ts
 * Processes raw Whisper chunks into scene-length transcript lines for storyboarding.
 *
 * MERGING STRATEGY:
 *   Whisper produces word/sub-phrase level chunks (0.5–2s each).
 *   We merge them into scene blocks targeting 5–8 seconds so that:
 *     - Each scene has a complete, readable narration
 *     - Images can stay on screen long enough to be appreciated
 *     - The number of scenes is realistic (15–20 for a 2–3 min voiceover)
 *
 *   A block is flushed (scene boundary) when:
 *     1. A natural pause (gap > 1.5s) occurs AND the block is ≥ MIN_SCENE_SECS, OR
 *     2. The last word ends with sentence punctuation (. ! ?) AND block is ≥ MIN_SCENE_SECS, OR
 *     3. The hard cap MAX_SCENE_SECS is reached.
 */

const PAUSE_THRESHOLD_SECONDS = 1.5;
const MIN_SCENE_SECS = 3;   // minimum block duration before we allow a split
const MAX_SCENE_SECS = 12;  // hard cap — always flush here regardless

export interface WhisperChunk {
  text: string;
  timestamp: [number | null, number | null];
}

export interface TranscriptLine {
  startTime: number;
  endTime: number;
  text: string;
  hasPauseBefore: boolean;
}

/**
 * Formats seconds -> M:SS or H:MM:SS
 */
export function formatTimestamp(seconds: number): string {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Converts raw Whisper chunks into scene-length transcript lines.
 * Merges short chunks into meaningful blocks before returning.
 */
export function processChunks(chunks: WhisperChunk[]): TranscriptLine[] {
  if (!chunks || chunks.length === 0) return [];

  // ── Step 1: Normalize all chunks into a flat list with resolved timestamps ──
  interface NormalizedChunk {
    text: string;
    start: number;
    end: number;
    hasPauseBefore: boolean;
  }

  const normalized: NormalizedChunk[] = [];
  let prevEnd = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const text = (chunk.text ?? '').trim();
    if (!text) continue;

    const [chunkStart, chunkEnd] = chunk.timestamp ?? [null, null];
    const start = chunkStart ?? prevEnd;
    const end = chunkEnd ?? start + 0.5;

    const gap = start - prevEnd;
    const hasPauseBefore = i > 0 && gap > PAUSE_THRESHOLD_SECONDS;

    normalized.push({ text, start, end, hasPauseBefore });
    prevEnd = end;
  }

  if (normalized.length === 0) return [];

  // ── Step 2: Merge chunks into scene-length blocks ─────────────────────────
  const lines: TranscriptLine[] = [];

  let blockWords: string[] = [normalized[0].text];
  let blockStart  = normalized[0].start;
  let blockEnd    = normalized[0].end;
  let blockPause  = normalized[0].hasPauseBefore;

  const flushBlock = () => {
    if (blockWords.length === 0) return;
    lines.push({
      startTime:     blockStart,
      endTime:       blockEnd,
      text:          blockWords.join(' ').replace(/\s{2,}/g, ' ').trim(),
      hasPauseBefore: blockPause,
    });
  };

  for (let i = 1; i < normalized.length; i++) {
    const chunk = normalized[i];
    const blockDuration = blockEnd - blockStart;

    const endsWithSentence = /[.!?]["']?\s*$/.test(blockWords[blockWords.length - 1]);
    const hitHardCap      = blockDuration >= MAX_SCENE_SECS;
    const naturalBreak    = blockDuration >= MIN_SCENE_SECS && (chunk.hasPauseBefore || endsWithSentence);

    if (hitHardCap || naturalBreak) {
      // Flush current block as a scene
      flushBlock();
      // Start a new block with this chunk
      blockWords = [chunk.text];
      blockStart = chunk.start;
      blockEnd   = chunk.end;
      blockPause = chunk.hasPauseBefore;
    } else {
      // Extend current block
      blockWords.push(chunk.text);
      blockEnd = chunk.end;
    }
  }

  // Flush the final block
  flushBlock();

  return lines;
}
