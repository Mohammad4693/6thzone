import { useEffect, useState } from 'react';
import client from '../api/client';
import AudioPlayer from './AudioPlayer';

// AudioPlayer for authenticated audio. Two sources:
// - fileId: /api/files/:id (needs the Authorization header) — fetched once
// - blob: a locally recorded blob, played directly (no network)
export default function AuthAudio({ fileId, blob }: { fileId?: string; blob?: Blob }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (blob) {
      const localUrl = URL.createObjectURL(blob);
      setUrl(localUrl);
      return () => URL.revokeObjectURL(localUrl);
    }
    let objectUrl = '';
    let alive = true;
    client
      .get(`/files/${fileId}`, { responseType: 'blob' })
      .then((r) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(r.data);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, blob]);

  if (!url) return <span className="text-seraj-muted text-xs py-3">در حال بارگذاری صدا...</span>;
  return <AudioPlayer src={url} />;
}
