import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  src?: string;
  audioUrl?: string;
  duration?: number;
  isMe?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, audioUrl, duration, isMe = false }) => {
  const resolvedSrc = src || audioUrl || '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (duration && duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setHasError(false);
      audio.play().catch((err) => {
        console.warn('[AudioPlayer] Falha ao reproduzir áudio:', err);
        setHasError(true);
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (!totalDuration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setTotalDuration(audio.duration);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setTotalDuration(audio.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetTime = Number(e.target.value);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (hasError) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
        <span>Não foi possível reproduzir este áudio.</span>
      </div>
    );
  }

  return (
    <div
      className={`my-1.5 flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all ${
        isMe
          ? 'bg-emerald-700/50 border-emerald-400/30 text-white'
          : 'bg-slate-900/80 border-slate-700/60 text-slate-200'
      }`}
    >
      <audio
        ref={audioRef}
        src={resolvedSrc}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all shadow-md cursor-pointer ${
          isMe
            ? 'bg-white text-emerald-800 hover:bg-emerald-100'
            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold'
        }`}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Progress & Duration */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        {/* Seek track */}
        <div className="relative flex items-center h-4">
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-950/40 accent-emerald-400"
            aria-label="Progresso do áudio"
          />
        </div>

        {/* Time labels */}
        <div
          className={`flex items-center justify-between text-[11px] font-mono leading-none ${
            isMe ? 'text-emerald-100/90' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1 opacity-80">
            <Volume2 className="h-3 w-3" />
            {formatTime(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};
