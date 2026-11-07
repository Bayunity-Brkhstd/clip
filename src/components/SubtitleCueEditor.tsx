import React, { useEffect, useRef, useState } from 'react';
import type { SubtitleCue } from '../types';
import { formatTimecode, parseTimecode, splitCue, deleteCue, addCue } from '../utils/subtitleUtils';

export interface SubtitleCueEditorProps {
  cues: SubtitleCue[];
  currentTime: number;       // Absolute global video player currentTime (seconds)
  clipStartTime: number;     // Absolute clip start time (seconds)
  clipEndTime: number;       // Absolute clip end time (seconds)
  onChangeCues: (updatedCues: SubtitleCue[]) => void;
  onSeekToTime: (absoluteSeconds: number) => void;
  onResetToOriginal: () => void;
  disabled?: boolean;
}

export const SubtitleCueEditor: React.FC<SubtitleCueEditorProps> = ({
  cues,
  currentTime,
  clipStartTime,
  clipEndTime,
  onChangeCues,
  onSeekToTime,
  onResetToOriginal,
  disabled = false,
}) => {
  const clipDuration = Math.max(1, clipEndTime - clipStartTime);
  const relTime = Math.max(0, Math.min(clipDuration, currentTime - clipStartTime));

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll list when the active cue changes during playback
  useEffect(() => {
    if (!autoScroll || !activeRowRef.current || !listContainerRef.current) return;
    activeRowRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }, [relTime, autoScroll]);

  // Update text for a specific cue
  const handleTextChange = (id: string, newText: string) => {
    const updated = cues.map(cue => {
      if (cue.id === id) {
        return { ...cue, text: newText, isEdited: true };
      }
      return cue;
    });
    onChangeCues(updated);
  };

  // Update start time
  const handleStartTimeChange = (id: string, rawVal: string) => {
    const parsed = parseTimecode(rawVal);
    const updated = cues.map(cue => {
      if (cue.id === id) {
        const safeStart = Math.max(0, Math.min(cue.end - 0.2, parsed));
        return { ...cue, start: Math.round(safeStart * 10) / 10, isEdited: true };
      }
      return cue;
    });
    onChangeCues(updated);
  };

  // Update end time
  const handleEndTimeChange = (id: string, rawVal: string) => {
    const parsed = parseTimecode(rawVal);
    const updated = cues.map(cue => {
      if (cue.id === id) {
        const safeEnd = Math.min(clipDuration, Math.max(cue.start + 0.2, parsed));
        return { ...cue, end: Math.round(safeEnd * 10) / 10, isEdited: true };
      }
      return cue;
    });
    onChangeCues(updated);
  };

  const handleSplit = (id: string) => {
    const updated = splitCue(cues, id);
    onChangeCues(updated);
  };

  const handleDelete = (id: string) => {
    const updated = deleteCue(cues, id);
    onChangeCues(updated);
  };

  const handleAddAfter = (afterId?: string) => {
    const updated = addCue(cues, clipDuration, afterId);
    onChangeCues(updated);
  };

  return (
    <div className={`subtitle-cue-editor-wrapper ${disabled ? 'subtitles-dimmed' : ''}`}>
      {/* Header bar */}
      <div className="cue-editor-header">
        <div className="cue-editor-title-group">
          <span className="cue-editor-title">Editor Subtitle Kontekstual</span>
          <span className="cue-count-badge">{cues.length} Baris Audio</span>
        </div>

        <div className="cue-header-actions">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              userSelect: 'none',
              marginRight: '0.4rem',
            }}
            title="Otomatis geser baris aktif saat video diputar"
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#00f0ff' }}
            />
            Auto-Scroll
          </label>

          <button
            type="button"
            className="cue-btn-action"
            onClick={onResetToOriginal}
            title="Kembalikan teks & timing ke hasil transkripsi asli AI"
          >
            ↺ Reset AI
          </button>

          <button
            type="button"
            className="cue-btn-action primary"
            onClick={() => handleAddAfter()}
            title="Tambah baris subtitle baru di akhir"
          >
            + Tambah Baris
          </button>
        </div>
      </div>

      {/* Tip helper */}
      <div className="cue-editor-tip">
        <span>⚡ Klik tombol <strong>▶</strong> untuk melompat & memutar audio di baris tersebut. Edit teks langsung tersinkron ke preview video.</span>
      </div>

      {/* Cues List */}
      <div className="cue-list-container" ref={listContainerRef}>
        {cues.length === 0 ? (
          <div className="cue-empty-state">
            <span className="cue-empty-text">Belum ada baris subtitle untuk klip ini.</span>
            <button
              type="button"
              className="cue-btn-action primary"
              onClick={() => handleAddAfter()}
            >
              + Tambah Baris Subtitle Pertama
            </button>
          </div>
        ) : (
          cues.map((cue, index) => {
            const isActive = relTime >= cue.start && relTime <= cue.end;
            const duration = Math.max(0, cue.end - cue.start);

            return (
              <div
                key={cue.id}
                ref={isActive ? activeRowRef : null}
                className={`cue-row ${isActive ? 'active' : ''}`}
              >
                {/* Play Button */}
                <button
                  type="button"
                  className="cue-play-btn"
                  onClick={() => onSeekToTime(clipStartTime + cue.start)}
                  title={`Putar baris ${index + 1} (${formatTimecode(cue.start)}s)`}
                >
                  ▶
                </button>

                {/* Timecode Box */}
                <div className="cue-timecode-box" title="Waktu Mulai - Waktu Selesai (MM:SS.s)">
                  <input
                    type="text"
                    className="cue-time-input"
                    defaultValue={formatTimecode(cue.start)}
                    key={`start-${cue.id}-${cue.start}`}
                    onBlur={e => handleStartTimeChange(cue.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    title="Edit waktu mulai (MM:SS.s atau detik)"
                  />
                  <span className="cue-time-sep">-</span>
                  <input
                    type="text"
                    className="cue-time-input"
                    defaultValue={formatTimecode(cue.end)}
                    key={`end-${cue.id}-${cue.end}`}
                    onBlur={e => handleEndTimeChange(cue.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    title="Edit waktu selesai (MM:SS.s atau detik)"
                  />
                </div>

                {/* Duration Tag */}
                <span className="cue-duration-tag">{duration.toFixed(1)}s</span>

                {/* Subtitle Text Input */}
                {cue.isEdited && <span className="cue-edited-dot" title="Telah diedit manual" />}
                <input
                  type="text"
                  className="cue-text-input"
                  value={cue.text}
                  onChange={e => handleTextChange(cue.id, e.target.value)}
                  placeholder="Ketik teks subtitle..."
                  title="Edit teks subtitle yang akan ditampilkan"
                />

                {/* Tool Buttons */}
                <div className="cue-tools-group">
                  <button
                    type="button"
                    className="cue-tool-btn split"
                    onClick={() => handleSplit(cue.id)}
                    title="Bagi baris ini menjadi dua (Split)"
                  >
                    ✂
                  </button>
                  <button
                    type="button"
                    className="cue-tool-btn add"
                    onClick={() => handleAddAfter(cue.id)}
                    title="Sisipkan baris baru setelah ini"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="cue-tool-btn delete"
                    onClick={() => handleDelete(cue.id)}
                    title="Hapus baris ini"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
