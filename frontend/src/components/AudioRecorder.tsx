import { useState, useRef, useEffect } from 'react';

interface AudioRecorderProps {
  onRecorded: (blob: Blob, duration: number) => void;
}

const MAX_DURATION_SECONDS = 180; // 3 minutes

export default function AudioRecorder({ onRecorded }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded(blob, duration);
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= MAX_DURATION_SECONDS) {
            // hard 3-minute cap
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setRecording(false);
            }
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_DURATION_SECONDS;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      setError('دسترسی به میکروفون ممکن نشد. لطفاً اجازه میکروفون را بدهید.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`w-28 h-28 rounded-full flex items-center justify-center transition-all touch-target ${
          recording
            ? 'bg-red-500/20 border-2 border-red-500'
            : 'bg-seraj-card border-2 border-seraj-orange hover:bg-seraj-orange/10'
        }`}
        aria-label={recording ? 'توقف ضبط' : 'شروع ضبط'}
      >
        {recording ? (
          <div className="w-9 h-9 bg-red-500 rounded" />
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {recording && (
        <div className="text-seraj-muted text-sm">
          در حال ضبط... {formatTime(duration)} <span className="text-xs">(حداکثر ۳ دقیقه)</span>
        </div>
      )}

      {!recording && !hasPermission && (
        <div className="text-seraj-muted text-sm text-center">
          برای شروع ضبط، لمس کن
        </div>
      )}

      {error && <div className="text-red-400 text-sm text-center px-4">{error}</div>}
    </div>
  );
}
