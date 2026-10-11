import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AudioRecorder from '../components/AudioRecorder';
import AudioPlayer from '../components/AudioPlayer';
import client from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function ChatPage() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMember = user?.role === 'MEMBER';
  const isMentor = user?.role === 'MENTOR';

  useEffect(() => {
    loadData();
    const interval = setInterval(loadMessages, 10000); // poll for new messages
    return () => clearInterval(interval);
  }, [requestId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (request?.assignment?.expiresAt) {
      const update = () => {
        const diff = new Date(request.assignment.expiresAt).getTime() - Date.now();
        if (diff <= 0) {
          setTimeRemaining('پایان یافته');
          setIsExpired(true);
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          setTimeRemaining(`${h} ساعت و ${m} دقیقه`);
          setIsExpired(false);
        }
      };
      update();
      const interval = setInterval(update, 60000);
      return () => clearInterval(interval);
    }
  }, [request]);

  const loadData = async () => {
    try {
      const res = await client.get(`/requests/${requestId}`);
      setRequest(res.data);
      setMessages(res.data.messages || []);
      setLoading(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('دسترسی به این پرونده مجاز نیست');
      }
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await client.get(`/messages/${requestId}`);
      setMessages(res.data);
    } catch {}
  };

  const sendText = async () => {
    if (!text.trim() || isExpired) return;
    setSending(true);
    try {
      const res = await client.post(`/messages/${requestId}`, { content: text });
      setMessages([...messages, res.data]);
      setText('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ارسال');
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async () => {
    if (!voiceBlob || isExpired) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('voice', voiceBlob, 'voice.webm');
      const res = await client.post(`/messages/${requestId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages([...messages, res.data]);
      setVoiceBlob(null);
      setShowRecorder(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ارسال');
    } finally {
      setSending(false);
    }
  };

  const requestSession = async () => {
    try {
      await client.post(`/sessions/${requestId}/request`);
      alert('درخواست جلسه ثبت شد. ادمین زمان را هماهنگ می‌کند.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  const submitFeedback = async () => {
    if (feedbackRating < 1) return;
    try {
      await client.post(`/feedback/${requestId}`, { rating: feedbackRating, comment: feedbackComment });
      setShowFeedback(false);
      alert('نظرسنجی ثبت شد. سپاسگزاریم.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;
  if (error) return <Layout><div className="p-4 text-red-400">{error}</div></Layout>;

  const mentor = request?.assignment?.mentor;
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : 'منتور تخصیص نیافته';
  const mentorExpertise = mentor?.mentorProfile?.expertise?.join('، ') || '';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Header */}
        <div className="bg-seraj-card border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{mentorName}</p>
              {mentorExpertise && <p className="text-xs text-seraj-muted">{mentorExpertise}</p>}
            </div>
            <div className="text-left">
              {isExpired ? (
                <p className="text-red-400 text-sm">پرونده بسته شده</p>
              ) : (
                <p className="text-seraj-orange text-sm">{timeRemaining}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={requestSession} disabled={isExpired} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-seraj-muted disabled:opacity-50">
              درخواست جلسه ۱۵ دقیقه‌ای
            </button>
            <button onClick={() => navigate(`/brief/${requestId}`)} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-seraj-muted">
              برگه نهایی
            </button>
            {isMember && (request.status === 'CLOSED_COMPLETED' || request.status === 'CLOSED_EXPIRED') && (
              <button onClick={() => setShowFeedback(true)} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-seraj-orange">
                نظرسنجی
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-seraj-muted text-center mt-8">هنوز پیامی نیست. اولین پیام را ارسال کنید.</p>
          )}
          {messages.map((msg: any) => {
            const isMine = (isMember && msg.sender === 'MEMBER') || (isMentor && msg.sender === 'MENTOR');
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] rounded-2xl p-3 ${isMine ? 'bg-seraj-orange/20' : 'bg-seraj-card'}`}>
                  {msg.type === 'VOICE' && msg.attachment ? (
                    <AudioPlayer src={`/uploads/${msg.attachment.filename}`} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-seraj-muted">
                      {new Date(msg.createdAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.status === 'FAILED' && <span className="text-xs text-red-400">⚠ ارسال ناموفق</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {isExpired ? (
          <div className="bg-seraj-card border-t border-white/5 px-4 py-4 text-center">
            <p className="text-seraj-muted text-sm">زمان فعال پرونده به پایان رسیده. پیام‌ها و فایل‌ها قابل مشاهده و دریافت است.</p>
          </div>
        ) : showRecorder ? (
          <div className="bg-seraj-card border-t border-white/5 px-4 py-4">
            <AudioRecorder onRecorded={(blob) => setVoiceBlob(blob)} />
            {voiceBlob && (
              <div className="flex gap-2 mt-3 justify-center">
                <button onClick={sendVoice} disabled={sending} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
                  {sending ? 'در حال ارسال...' : 'ارسال وویس'}
                </button>
                <button onClick={() => { setShowRecorder(false); setVoiceBlob(null); }} className="text-seraj-muted px-4 py-2 text-sm">
                  انصراف
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-seraj-card border-t border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecorder(true)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 touch-target"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                className="flex-1 bg-seraj-bg border border-white/10 rounded-xl px-4 py-2.5 text-seraj-text focus:border-seraj-orange focus:outline-none"
                placeholder="پیام بنویسید..."
              />
              <button
                onClick={sendText}
                disabled={sending || !text.trim()}
                className="w-10 h-10 rounded-full bg-seraj-orange flex items-center justify-center flex-shrink-0 disabled:opacity-50 touch-target"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#090A0B" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}

        {/* Feedback modal */}
        {showFeedback && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-seraj-card rounded-2xl p-6 max-w-md w-full">
              <h3 className="font-bold mb-4">نظرسنجی رضایت</h3>
              <p className="text-seraj-muted text-sm mb-4">از ۱ تا ۵، میزان رضایت شما چقدر است؟</p>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setFeedbackRating(n)}
                    className={`w-12 h-12 rounded-xl font-bold touch-target ${feedbackRating === n ? 'bg-seraj-orange text-seraj-bg' : 'bg-white/5 text-seraj-muted'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <textarea
                value={feedbackComment}
                onChange={e => setFeedbackComment(e.target.value)}
                className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[80px] mb-4"
                placeholder="توضیح (اختیاری)"
              />
              <div className="flex gap-2">
                <button onClick={submitFeedback} disabled={feedbackRating < 1} className="flex-1 bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold disabled:opacity-50">
                  ثبت
                </button>
                <button onClick={() => setShowFeedback(false)} className="px-4 py-3 text-seraj-muted">انصراف</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
