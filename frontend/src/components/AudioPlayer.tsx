import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
}

export default function AudioPlayer({ src, duration }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setTotalDuration(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-seraj-orange/20 flex items-center justify-center flex-shrink-0 touch-target"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#F69A46"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#F69A46"><polygon points="5,3 19,12 5,21"/></svg>
        )}
      </button>
      <div className="flex-1">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-seraj-orange rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-seraj-muted mt-1">{formatTime(currentTime)} / {formatTime(totalDuration)}</div>
      </div>
    </div>
  );
}
