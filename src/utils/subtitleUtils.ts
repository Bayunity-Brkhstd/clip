import type { SubtitleCue, TranscriptLine, ViralClip } from '../types';

/**
 * Format seconds into a friendly MM:SS.s timecode string.
 * e.g., 4.2 -> "00:04.2", 65.4 -> "01:05.4"
 */
export function formatTimecode(seconds: number, includeTenths: boolean = true): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const mins = Math.floor(safeSec / 60);
  const secs = Math.floor(safeSec % 60);
  const tenths = Math.floor((safeSec % 1) * 10);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (includeTenths) {
    return `${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Parse MM:SS.s or MM:SS or raw seconds string into numeric seconds.
 */
export function parseTimecode(tc: string): number {
  if (!tc) return 0;
  const trimmed = tc.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const mins = parseFloat(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return Math.max(0, mins * 60 + secs);
    } else if (parts.length === 3) {
      const hrs = parseFloat(parts[0]) || 0;
      const mins = parseFloat(parts[1]) || 0;
      const secs = parseFloat(parts[2]) || 0;
      return Math.max(0, hrs * 3600 + mins * 60 + secs);
    }
  }
  const raw = parseFloat(trimmed);
  return isNaN(raw) ? 0 : Math.max(0, raw);
}

/**
 * Slices global transcript lines into relative clip cues (0.0s = start of clip).
 * Includes robust fallbacks when full transcript is unavailable.
 */
export function sliceTranscriptForClip(
  clip: ViralClip,
  fullTranscript?: TranscriptLine[]
): SubtitleCue[] {
  // If the clip already has custom cues preserved, return them
  if (clip.custom_cues && clip.custom_cues.length > 0) {
    return clip.custom_cues.map(c => ({ ...c }));
  }

  const clipStart = Math.max(0, clip.start_time || 0);
  const clipEnd = Math.max(clipStart + 1, clip.end_time || clipStart + 30);
  const clipDuration = Math.max(1, clipEnd - clipStart);

  // Strategy A: Map from full audio transcript with timestamps
  if (fullTranscript && Array.isArray(fullTranscript) && fullTranscript.length > 0) {
    const overlapping = fullTranscript.filter(line => {
      const lStart = Number(line.start || 0);
      const lEnd = Number(line.end || lStart + 2);
      return lEnd > (clipStart - 0.2) && lStart < (clipEnd + 0.2);
    });

    if (overlapping.length > 0) {
      const cues: SubtitleCue[] = [];
      overlapping.forEach((line, idx) => {
        const text = (line.text || '').trim();
        if (!text) return;

        const origStart = Number(line.start || 0);
        const origEnd = Number(line.end || origStart + 2);

        // Map relative to clip start (0.0s)
        const relStart = Math.max(0, Math.min(clipDuration - 0.2, origStart - clipStart));
        const relEnd = Math.min(clipDuration, Math.max(relStart + 0.3, origEnd - clipStart));

        cues.push({
          id: `cue_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          originalStart: origStart,
          originalEnd: origEnd,
          start: Math.round(relStart * 10) / 10,
          end: Math.round(relEnd * 10) / 10,
          text,
          isEdited: false
        });
      });

      if (cues.length > 0) {
        return cues;
      }
    }
  }

  // Strategy B: Fallback - parse clip.transcript text and distribute across duration
  const rawText = (clip.transcript || '').trim();
  if (rawText) {
    // Split into sentences or clauses (periods, commas, exclamation, questions, newlines)
    const rawSegments = rawText
      .split(/(?<=[.?!,\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const segments: string[] = [];
    // Group short fragments into reasonable lines (max 8 words each)
    let currentChunk: string[] = [];
    for (const seg of rawSegments) {
      const words = seg.split(/\s+/);
      if (words.length > 10) {
        // Subdivide long sentences
        for (let i = 0; i < words.length; i += 7) {
          segments.push(words.slice(i, i + 7).join(' '));
        }
      } else {
        currentChunk.push(seg);
        if (currentChunk.join(' ').split(/\s+/).length >= 6) {
          segments.push(currentChunk.join(' '));
          currentChunk = [];
        }
      }
    }
    if (currentChunk.length > 0) {
      segments.push(currentChunk.join(' '));
    }

    const finalSegments = segments.length > 0 ? segments : [rawText];
    const segDuration = clipDuration / finalSegments.length;

    return finalSegments.map((text, idx) => {
      const s = Math.round((idx * segDuration) * 10) / 10;
      const e = Math.round(Math.min(clipDuration, (idx + 1) * segDuration) * 10) / 10;
      return {
        id: `cue_fb_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        originalStart: clipStart + s,
        originalEnd: clipStart + e,
        start: s,
        end: Math.max(s + 0.5, e),
        text,
        isEdited: false
      };
    });
  }

  // Strategy C: Last resort placeholder
  const placeholderText = clip.title || 'Subtitle Klip';
  return [
    {
      id: `cue_ph_0_${Math.random().toString(36).substring(2, 7)}`,
      originalStart: clipStart,
      originalEnd: clipEnd,
      start: 0.0,
      end: Math.round(clipDuration * 10) / 10,
      text: placeholderText,
      isEdited: false
    }
  ];
}

/**
 * Split an existing cue into two cues at the midpoint.
 */
export function splitCue(cues: SubtitleCue[], cueId: string): SubtitleCue[] {
  const index = cues.findIndex(c => c.id === cueId);
  if (index === -1) return cues;

  const target = cues[index];
  const dur = target.end - target.start;
  const mid = Math.round((target.start + dur / 2) * 10) / 10;

  const words = target.text.trim().split(/\s+/);
  const midWordIdx = Math.max(1, Math.ceil(words.length / 2));
  const text1 = words.slice(0, midWordIdx).join(' ') || target.text;
  const text2 = words.slice(midWordIdx).join(' ') || '...';

  const cue1: SubtitleCue = {
    ...target,
    end: mid,
    text: text1,
    isEdited: true
  };

  const cue2: SubtitleCue = {
    id: `cue_split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    originalStart: target.originalStart + (dur / 2),
    originalEnd: target.originalEnd,
    start: mid,
    end: target.end,
    text: text2,
    isEdited: true
  };

  const newCues = [...cues];
  newCues.splice(index, 1, cue1, cue2);
  return newCues;
}

/**
 * Delete a cue from the cues list.
 */
export function deleteCue(cues: SubtitleCue[], cueId: string): SubtitleCue[] {
  return cues.filter(c => c.id !== cueId);
}

/**
 * Add a new cue at the end or immediately after a specific cue.
 */
export function addCue(cues: SubtitleCue[], clipDuration: number, afterCueId?: string): SubtitleCue[] {
  const newCues = [...cues];
  const afterIndex = afterCueId ? newCues.findIndex(c => c.id === afterCueId) : newCues.length - 1;

  let newStart = 0;
  let newEnd = Math.min(clipDuration, 3.0);

  if (afterIndex >= 0 && afterIndex < newCues.length) {
    const prev = newCues[afterIndex];
    newStart = Math.min(clipDuration - 0.5, prev.end);
    newEnd = Math.min(clipDuration, newStart + 2.5);
  } else if (newCues.length > 0) {
    const last = newCues[newCues.length - 1];
    newStart = Math.min(clipDuration - 0.5, last.end);
    newEnd = Math.min(clipDuration, newStart + 2.5);
  }

  const newCue: SubtitleCue = {
    id: `cue_add_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    originalStart: newStart,
    originalEnd: newEnd,
    start: Math.round(newStart * 10) / 10,
    end: Math.round(Math.max(newStart + 0.5, newEnd) * 10) / 10,
    text: 'Teks subtitle baru',
    isEdited: true
  };

  if (afterIndex >= 0 && afterIndex < newCues.length) {
    newCues.splice(afterIndex + 1, 0, newCue);
  } else {
    newCues.push(newCue);
  }

  return newCues;
}
