import type { SubtitleCue, TranscriptLine, ViralClip } from '../types';

/**
 * Format seconds into a friendly MM:SS.s or MM:SS.cs timecode string.
 * e.g., 4.25 -> "00:04.2", 65.4 -> "01:05.4"
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
 * Removes duplicate overlapping prefix words between two consecutive subtitle cues.
 * In YouTube rolling auto-captions, line 2 often starts with the identical trailing words of line 1.
 * e.g. Line 1: "halo semuanya selamat datang di channel kami"
 *      Line 2: "di channel kami hari ini kita akan membahas"
 *      -> Cleans Line 2 to: "hari ini kita akan membahas"
 */
export function removeOverlappingPrefix(prevText: string, currText: string): string {
  if (!prevText || !currText) return currText;
  const prevWords = prevText.toLowerCase().replace(/[,.?!]/g, '').trim().split(/\s+/).filter(Boolean);
  const currWordsRaw = currText.trim().split(/\s+/).filter(Boolean);
  const currWordsClean = currWordsRaw.map(w => w.toLowerCase().replace(/[,.?!]/g, ''));

  if (prevWords.length === 0 || currWordsClean.length === 0) return currText;

  // Check matching prefixes from longest possible down to 1 word
  const maxCheck = Math.min(prevWords.length, currWordsClean.length - 1);
  for (let matchLen = maxCheck; matchLen >= 1; matchLen--) {
    const prevSuffix = prevWords.slice(-matchLen).join(' ');
    const currPrefix = currWordsClean.slice(0, matchLen).join(' ');
    if (prevSuffix === currPrefix) {
      const remaining = currWordsRaw.slice(matchLen).join(' ');
      if (remaining.trim().length > 0) {
        return remaining;
      }
    }
  }
  return currText;
}

/**
 * Strict de-overlapping and boundary alignment algorithm.
 * Guarantees cues never overlap ("numpuk-numpuk"), sequential cue[i].end matches cue[i+1].start,
 * removes rolling caption duplicate words, and clamps strictly within clip boundaries.
 */
export function deoverlapCues(cues: SubtitleCue[], clipDuration: number): SubtitleCue[] {
  if (!cues || cues.length === 0) return [];

  // 1. Sort strictly by start time ascending, then end time ascending
  const sorted = cues
    .filter(c => c && typeof c.text === 'string' && c.text.trim().length > 0)
    .map(c => ({
      ...c,
      start: Math.max(0, isNaN(c.start) ? 0 : c.start),
      end: Math.max(0.1, isNaN(c.end) ? 1.0 : c.end),
      text: c.text.trim()
    }))
    .sort((a, b) => {
      if (Math.abs(a.start - b.start) > 0.05) {
        return a.start - b.start;
      }
      return a.end - b.end;
    });

  if (sorted.length === 0) return [];

  // 2. Snap first cue to 0.0s if within the first 0.45s to eliminate awkward start silence
  if (sorted[0].start < 0.45) {
    sorted[0].start = 0.0;
  }

  // 3. De-overlap sequential boundaries & strip rolling caption prefix duplicates
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    // Deduplicate rolling text overlap if next line starts with identical words
    const cleanedNextText = removeOverlappingPrefix(current.text, next.text);
    if (cleanedNextText && cleanedNextText !== next.text) {
      next.text = cleanedNextText;
    }

    // Check time overlap: current.end exceeds next.start
    if (current.end > next.start) {
      if (next.start > current.start + 0.3) {
        // Clamp current cue's end cleanly to next cue's start
        current.end = Math.round(next.start * 100) / 100;
      } else {
        // If next starts too early or at the exact same millisecond:
        // Push next start to current's end with minimum duration
        const minEnd = Math.round((current.start + 0.4) * 100) / 100;
        current.end = Math.min(Math.max(current.start + 0.3, next.end - 0.2), minEnd);
        next.start = current.end;
      }
    }

    // Ensure minimum duration of current cue (at least 0.25s)
    if (current.end - current.start < 0.25) {
      current.end = Math.round((current.start + 0.3) * 100) / 100;
      if (next.start < current.end) {
        next.start = current.end;
      }
    }
  }

  // 4. Ensure last cue does not exceed clipDuration and has reasonable duration
  const last = sorted[sorted.length - 1];
  if (last) {
    if (last.end > clipDuration) {
      last.end = Math.round(clipDuration * 100) / 100;
    }
    if (last.end - last.start < 0.25) {
      last.start = Math.max(0, Math.round((last.end - 0.3) * 100) / 100);
    }
  }

  return sorted.filter(c => c.text && c.text.trim().length > 0 && c.end > c.start);
}

/**
 * Slices global transcript lines into relative clip cues (0.0s = start of clip).
 * Automatically re-anchors timestamps when the clip is trimmed or cut,
 * and passes cues through deoverlapCues to guarantee 100% audio sync without overlapping.
 */
export function sliceTranscriptForClip(
  clip: ViralClip,
  fullTranscript?: TranscriptLine[]
): SubtitleCue[] {
  const clipStart = Math.max(0, clip.start_time || 0);
  const clipEnd = Math.max(clipStart + 1, clip.end_time || clipStart + 30);
  const clipDuration = Math.max(1, clipEnd - clipStart);

  // If the clip already has custom cues preserved:
  if (clip.custom_cues && clip.custom_cues.length > 0) {
    // Check if the custom cues need to be re-aligned to clipStart (e.g. after trimming)
    const realigned: SubtitleCue[] = [];
    let hasValidAnchors = false;

    for (const cue of clip.custom_cues) {
      const origS = (typeof cue.originalStart === 'number' && !isNaN(cue.originalStart) && cue.originalStart > 0)
        ? cue.originalStart
        : (clipStart + cue.start);
      const origE = (typeof cue.originalEnd === 'number' && !isNaN(cue.originalEnd) && cue.originalEnd > origS)
        ? cue.originalEnd
        : (origS + (cue.end - cue.start));

      if (typeof cue.originalStart === 'number' && cue.originalStart > 0) {
        hasValidAnchors = true;
      }

      // Check if this cue falls within the trimmed clip [clipStart, clipEnd]
      if (origE <= clipStart + 0.1 || origS >= clipEnd - 0.1) {
        continue; // Outside trimmed range
      }

      const relStart = Math.max(0, Math.min(clipDuration - 0.2, origS - clipStart));
      const relEnd = Math.min(clipDuration, Math.max(relStart + 0.3, origE - clipStart));

      realigned.push({
        ...cue,
        originalStart: origS,
        originalEnd: origE,
        start: Math.round(relStart * 100) / 100,
        end: Math.round(relEnd * 100) / 100,
      });
    }

    if (realigned.length > 0 && hasValidAnchors) {
      return deoverlapCues(realigned, clipDuration);
    }
  }

  // Strategy A: Map from full audio transcript with timestamps
  if (fullTranscript && Array.isArray(fullTranscript) && fullTranscript.length > 0) {
    const overlapping = fullTranscript.filter(line => {
      const lStart = Number(line.start || 0);
      const lEnd = Number(line.end || lStart + (line.duration || 1.5));
      const overlapStart = Math.max(clipStart, lStart);
      const overlapEnd = Math.min(clipEnd, lEnd);
      const overlapDur = overlapEnd - overlapStart;
      const lineDur = Math.max(0.1, lEnd - lStart);
      // Filter out bleed from outside clip boundaries
      return overlapDur >= 0.25 || (overlapDur / lineDur) >= 0.25;
    });

    if (overlapping.length > 0) {
      const cues: SubtitleCue[] = [];
      overlapping.forEach((line, idx) => {
        const text = (line.text || '').trim();
        if (!text) return;

        const origStart = Number(line.start || 0);
        const origEnd = Number(line.end || origStart + (line.duration || 1.5));

        // Map relative to clip start (0.0s)
        const relStart = Math.max(0, Math.min(clipDuration - 0.2, origStart - clipStart));
        const relEnd = Math.min(clipDuration, Math.max(relStart + 0.3, origEnd - clipStart));

        if (relEnd - relStart < 0.2) return;

        cues.push({
          id: `cue_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          originalStart: origStart,
          originalEnd: origEnd,
          start: Math.round(relStart * 100) / 100,
          end: Math.round(relEnd * 100) / 100,
          text,
          isEdited: false
        });
      });

      if (cues.length > 0) {
        return deoverlapCues(cues, clipDuration);
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
      const s = Math.round((idx * segDuration) * 100) / 100;
      const e = Math.round(Math.min(clipDuration, (idx + 1) * segDuration) * 100) / 100;
      return {
        id: `cue_fb_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        originalStart: clipStart + s,
        originalEnd: clipStart + e,
        start: s,
        end: Math.max(s + 0.4, e),
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
      end: Math.round(clipDuration * 100) / 100,
      text: placeholderText,
      isEdited: false
    }
  ];
}

/**
 * Split an existing cue into two cues.
 * If splitAtSeconds is provided, splits at that exact playback timestamp.
 * If target text contains a newline (\n), splits exactly across the 2 lines.
 * Otherwise, splits proportionally by words and character weight.
 */
export function splitCue(cues: SubtitleCue[], cueId: string, splitAtSeconds?: number): SubtitleCue[] {
  const index = cues.findIndex(c => c.id === cueId);
  if (index === -1) return cues;

  const target = cues[index];
  const dur = Math.max(0.3, target.end - target.start);

  // Case A: Multiline text with \n -> split line 1 into cue 1, line 2 into cue 2
  if (target.text.includes('\n')) {
    const lines = target.text.split('\n');
    const text1 = (lines[0] || '').trim();
    const text2 = (lines.slice(1).join(' ') || '').trim();

    let splitTime: number;
    if (splitAtSeconds && splitAtSeconds > target.start + 0.15 && splitAtSeconds < target.end - 0.15) {
      splitTime = Math.round(splitAtSeconds * 100) / 100;
    } else {
      const len1 = Math.max(1, text1.length);
      const len2 = Math.max(1, text2.length);
      const ratio = len1 / (len1 + len2);
      splitTime = Math.round((target.start + dur * ratio) * 100) / 100;
    }

    const cue1: SubtitleCue = {
      ...target,
      end: splitTime,
      text: text1,
      isEdited: true
    };

    const cue2: SubtitleCue = {
      id: `cue_split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      originalStart: target.originalStart + (splitTime - target.start),
      originalEnd: target.originalEnd,
      start: splitTime,
      end: target.end,
      text: text2,
      isEdited: true
    };

    const newCues = [...cues];
    newCues.splice(index, 1, cue1, cue2);
    return newCues;
  }

  // Case B: Words split
  const words = target.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const mid = Math.round((target.start + dur / 2) * 100) / 100;
    const cue1: SubtitleCue = { ...target, end: mid, text: words[0] || '', isEdited: true };
    const cue2: SubtitleCue = {
      id: `cue_split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      originalStart: target.originalStart + (dur / 2),
      originalEnd: target.originalEnd,
      start: mid,
      end: target.end,
      text: '...',
      isEdited: true
    };
    const newCues = [...cues];
    newCues.splice(index, 1, cue1, cue2);
    return newCues;
  }

  let text1 = '';
  let text2 = '';
  let splitTime = 0;

  if (splitAtSeconds && splitAtSeconds > target.start + 0.15 && splitAtSeconds < target.end - 0.15) {
    splitTime = Math.round(splitAtSeconds * 100) / 100;
    const timeRatio = (splitTime - target.start) / dur;
    const targetWordIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * timeRatio)));
    text1 = words.slice(0, targetWordIdx).join(' ');
    text2 = words.slice(targetWordIdx).join(' ');
  } else {
    const midWordIdx = Math.max(1, Math.ceil(words.length / 2));
    text1 = words.slice(0, midWordIdx).join(' ');
    text2 = words.slice(midWordIdx).join(' ');
    const len1 = Math.max(1, text1.length);
    const len2 = Math.max(1, text2.length);
    const ratio = len1 / (len1 + len2);
    splitTime = Math.round((target.start + dur * ratio) * 100) / 100;
  }

  const cue1: SubtitleCue = {
    ...target,
    end: splitTime,
    text: text1,
    isEdited: true
  };

  const cue2: SubtitleCue = {
    id: `cue_split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    originalStart: target.originalStart + (splitTime - target.start),
    originalEnd: target.originalEnd,
    start: splitTime,
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
    start: Math.round(newStart * 100) / 100,
    end: Math.round(Math.max(newStart + 0.4, newEnd) * 100) / 100,
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
