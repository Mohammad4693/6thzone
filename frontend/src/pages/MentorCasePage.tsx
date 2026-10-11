import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AudioPlayer from '../components/AudioPlayer';
import AudioRecorder from '../components/AudioRecorder';
import client from '../api/client';

const CLARITY_AXES = [
  'نیاز واقعی', 'نتیجه مطلوب', 'ضرورت و فوریت', 'گزینه‌های نیازمند بررسی',
  'هزینه‌های کامل', 'بودجه و محدودیت مالی', 'پیش‌نیازها', 'منبع‌یابی',
  'معیار اعتبارسنجی منابع', 'معیار مقایسه منابع', 'ریسک‌های قابل بررسی',
  'تبعات برآورده‌نشدن', 'امکان بازگشت', 'اطلاعات ناقص',
  'موضوعات لازم برای پیگیری و ارزیابی',
];

// شاخص شفافیت: دقیقاً ۵ بخش (پروپوزال v3)
const PROGRESS_SECTIONS = [
  'مسئله', 'نتیجه', 'قیود و هزینه', 'منابع و اطلاعات', 'قدم بعدی',
];

export default function MentorCasePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'clarity' | 'ai' | 'brief'>('chat');
  const [clarity, setClarity] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [brief, setBrief] = useState<any>(null);
  const [editingDraft, setEditingDraft] = useState('');

  useEffect(() => {
    loadData();
    loadClarity();
    loadDrafts();
    loadBrief();
  }, [requestId]);

  const loadData = async () => {
    try {
      const res = await client.get(`/mentor/requests/${requestId}`);
      setData(res.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا');
      setLoading(false);
    }
  };

  const loadClarity = async () => {
    try {
      const res = await client.get(`/clarity/${requestId}`);
      setClarity(res.data.claritySections || []);
      setProgress(res.data.progressSections || []);
    } catch {}
  };

  const loadDrafts = async () => {
    try {
      const res = await client.get(`/ai/${requestId}/drafts`);
      setDrafts(res.data);
    } catch {}
  };

  const loadBrief = async () => {
    try {
      const res = await client.get(`/briefs/${requestId}`);
      setBrief(res.data);
    } catch {}
  };

  const sendMessage = async (content?: string, blob?: Blob) => {
    setSending(true);
    try {
      if (blob) {
        const formData = new FormData();
        formData.append('voice', blob, 'voice.webm');
        await client.post(`/messages/${requestId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else if (content) {
        await client.post(`/messages/${requestId}`, { content });
      }
      setText('');
      setVoiceBlob(null);
      setShowRecorder(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    } finally {
      setSending(false);
    }
  };

  const toggleClarityAxis = async (axisNumber: number, field: 'enabled' | 'confirmed', value: boolean) => {
    const axis = clarity.find(c => c.axisNumber === axisNumber);
    try {
      await client.put(`/clarity/${requestId}/axis/${axisNumber}`, {
        enabled: field === 'enabled' ? value : axis?.enabled,
        confirmed: field === 'confirmed' ? value : axis?.confirmed,
        notes: axis?.notes,
      });
      loadClarity();
    } catch {}
  };

  const toggleProgress = async (section: number, confirmed: boolean) => {
    try {
      await client.put(`/clarity/${requestId}/progress/${section}`, { confirmed });
      loadClarity();
    } catch {}
  };

  const generateDraft = async () => {
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await client.post(`/ai/${requestId}/generate`);
      setEditingDraft(res.data.content);
      loadDrafts();
    } catch (err: any) {
      setAiError(err.response?.data?.error || 'خطا');
      if (err.response?.data?.message) setAiError(err.response.data.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const approveDraft = async (draftId: string, edited: boolean) => {
    try {
      const content = edited ? editingDraft : undefined;
      await client.post(`/ai/${requestId}/draft/${draftId}/approve`, { editedContent: content });
      loadDrafts();
      loadData();
      setEditingDraft('');
      alert('پیام به عضو ارسال شد');
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  const rejectDraft = async (draftId: string) => {
    try {
      await client.post(`/ai/${requestId}/draft/${draftId}/reject`);
      loadDrafts();
    } catch {}
  };

  const saveBrief = async () => {
    try {
      await client.post(`/briefs/${requestId}`, brief || {});
      alert('برگه ذخیره شد');
      loadBrief();
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  const approveBrief = async () => {
    try {
      await client.post(`/briefs/${requestId}/approve`);
      alert('برگه تأیید شد');
      loadBrief();
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطا');
    }
  };

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;
  if (error) return <Layout><div className="p-4 text-red-400">{error}</div></Layout>;

  const request = data?.request;
  const messages = request?.messages || [];
  const isExpired = data?.expiresAt ? new Date(data.expiresAt) < new Date() : false;

  const confirmedProgress = progress.filter(p => p.confirmed).length;
  const progressPercent = Math.round((confirmedProgress / 5) * 100);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-seraj-card rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold">{request?.user?.firstName} {request?.user?.lastName}</p>
              <p className="text-xs text-seraj-muted">{request?.title || request?.description?.slice(0, 60)}</p>
            </div>
            <div className="text-left">
              {isExpired ? (
                <p className="text-red-400 text-sm">پایان یافته</p>
              ) : (
                <p className="text-seraj-orange text-sm">
                  {Math.max(0, new Date(data.expiresAt).getTime() - Date.now()) > 0
                    ? `${Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 3600000)}س ${Math.floor(((new Date(data.expiresAt).getTime() - Date.now()) % 3600000) / 60000)}د`
                    : 'پایان'}
                </p>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-seraj-muted">میزان تکمیل شفاف‌سازی نیاز</span>
              <span className="text-seraj-orange">{progressPercent}٪</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-seraj-orange rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-seraj-muted mt-1">این نشانگر، میزان تکمیل بررسی است؛ نه احتمال موفقیت یا حل مسئله.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {[
            { key: 'chat', label: 'گفت‌وگو' },
            { key: 'clarity', label: 'شفاف‌سازی' },
            { key: 'ai', label: 'دستیار AI' },
            { key: 'brief', label: 'برگه نهایی' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition ${activeTab === tab.key ? 'bg-seraj-orange text-seraj-bg' : 'bg-seraj-card text-seraj-muted'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <div className="space-y-3">
            <div className="bg-seraj-card rounded-2xl p-4 max-h-[400px] overflow-y-auto space-y-2">
              {messages.length === 0 && <p className="text-seraj-muted text-center">پیامی نیست</p>}
              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.sender === 'MENTOR' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl p-3 ${msg.sender === 'MENTOR' ? 'bg-seraj-orange/20' : 'bg-white/5'}`}>
                    {msg.type === 'VOICE' && msg.attachment ? (
                      <AudioPlayer src={`/uploads/${msg.attachment.filename}`} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <span className="text-xs text-seraj-muted block mt-1">
                      {new Date(msg.createdAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!isExpired && (
              <div className="bg-seraj-card rounded-2xl p-3">
                {showRecorder ? (
                  <div>
                    <AudioRecorder onRecorded={(blob) => setVoiceBlob(blob)} />
                    {voiceBlob && (
                      <div className="flex gap-2 mt-2 justify-center">
                        <button onClick={() => sendMessage(undefined, voiceBlob)} disabled={sending} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold">
                          ارسال
                        </button>
                        <button onClick={() => { setShowRecorder(false); setVoiceBlob(null); }} className="text-seraj-muted px-4 py-2 text-sm">انصراف</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowRecorder(true)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center touch-target">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F69A46" strokeWidth="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') sendMessage(text); }}
                      className="flex-1 bg-seraj-bg border border-white/10 rounded-xl px-4 py-2.5 text-seraj-text focus:border-seraj-orange focus:outline-none"
                      placeholder="پیام..."
                    />
                    <button onClick={() => sendMessage(text)} disabled={!text.trim() || sending} className="w-10 h-10 rounded-full bg-seraj-orange flex items-center justify-center disabled:opacity-50 touch-target">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#090A0B" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Clarity tab */}
        {activeTab === 'clarity' && (
          <div className="space-y-4">
            {/* Progress sections */}
            <div className="bg-seraj-card rounded-2xl p-4">
              <h3 className="font-bold mb-3">بخش‌های پیشرفت (هر بخش ۲۰٪)</h3>
              <div className="space-y-2">
                {PROGRESS_SECTIONS.map((label, i) => {
                  const sec = progress.find(p => p.section === i + 1);
                  return (
                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sec?.confirmed || false}
                        onChange={e => toggleProgress(i + 1, e.target.checked)}
                        className="w-5 h-5 accent-seraj-orange"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Clarity axes */}
            <div className="bg-seraj-card rounded-2xl p-4">
              <h3 className="font-bold mb-3">محورهای شفاف‌سازی (۱۵ محور)</h3>
              <p className="text-xs text-seraj-muted mb-3">محورهای مرتبط را فعال و وضعیت هرکدام را تأیید کنید.</p>
              <div className="space-y-2">
                {CLARITY_AXES.map((label, i) => {
                  const axis = clarity.find(c => c.axisNumber === i + 1);
                  return (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={axis?.enabled || false}
                          onChange={e => toggleClarityAxis(i + 1, 'enabled', e.target.checked)}
                          className="w-4 h-4 accent-seraj-orange"
                        />
                        <span className={`text-sm ${axis?.enabled ? 'text-seraj-text' : 'text-seraj-muted'}`}>{label}</span>
                      </label>
                      {axis?.enabled && (
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={axis?.confirmed || false}
                            onChange={e => toggleClarityAxis(i + 1, 'confirmed', e.target.checked)}
                            className="w-4 h-4 accent-green-500"
                          />
                          <span className="text-xs text-green-400">تأیید</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* AI tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-seraj-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">دستیار هوش مصنوعی</h3>
                <button
                  onClick={generateDraft}
                  disabled={aiGenerating}
                  className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {aiGenerating ? 'در حال تولید...' : 'تولید پیش‌نویس'}
                </button>
              </div>
              <p className="text-xs text-seraj-muted mb-2">
                پیش‌نویس‌های AI فقط برای شما قابل مشاهده است. قبل از ارسال، باید آن را تأیید یا ویرایش کنید.
              </p>
              {aiError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3">
                  <p className="text-red-400 text-sm">{aiError}</p>
                </div>
              )}
            </div>

            {drafts.length > 0 && (
              <div className="space-y-3">
                {drafts.map((draft: any) => (
                  <div key={draft.id} className="bg-seraj-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        draft.status === 'PENDING_REVIEW' ? 'bg-yellow-500/20 text-yellow-400' :
                        draft.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                        draft.status === 'EDITED' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {draft.status === 'PENDING_REVIEW' ? 'در انتظار بررسی' :
                         draft.status === 'APPROVED' ? 'تأییدشده' :
                         draft.status === 'EDITED' ? 'ویرایش‌شده' : 'ردشده'}
                      </span>
                      <span className="text-xs text-seraj-muted">{new Date(draft.createdAt).toLocaleString('fa-IR')}</span>
                    </div>
                    {draft.status === 'PENDING_REVIEW' ? (
                      <>
                        <textarea
                          value={editingDraft || draft.content}
                          onChange={e => setEditingDraft(e.target.value)}
                          className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[120px] mt-2"
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => approveDraft(draft.id, editingDraft !== draft.content)} className="bg-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm">
                            تأیید و ارسال به عضو
                          </button>
                          <button onClick={() => rejectDraft(draft.id)} className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm">
                            رد
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-seraj-muted whitespace-pre-wrap">{draft.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brief tab */}
        {activeTab === 'brief' && (
          <div className="space-y-4">
            <div className="bg-seraj-card rounded-2xl p-4">
              <h3 className="font-bold mb-3">برگه روشن نیاز</h3>
              <div className="space-y-3">
                {[
                  { key: 'title', label: 'عنوان نیاز' },
                  { key: 'initialDesc', label: 'شرح اولیه' },
                  { key: 'clarifiedProblem', label: 'صورت روشن‌شده مسئله' },
                  { key: 'desiredOutcome', label: 'نتیجه مطلوب' },
                  { key: 'priority', label: 'ضرورت و اولویت' },
                  { key: 'constraints', label: 'محدودیت‌ها و هزینه‌ها' },
                  { key: 'prerequisites', label: 'پیش‌نیازها' },
                  { key: 'incompleteInfo', label: 'اطلاعات ناقص' },
                  { key: 'criteria', label: 'معیارهای انتخاب منابع' },
                  { key: 'nextStep', label: 'قدم بعدی' },
                  { key: 'openTopics', label: 'موضوعات باز' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sm text-seraj-muted mb-1 block">{field.label}</label>
                    <textarea
                      value={brief?.[field.key] || ''}
                      onChange={e => setBrief({ ...brief, [field.key]: e.target.value })}
                      className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[60px]"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveBrief} className="bg-seraj-orange text-seraj-bg px-4 py-2 rounded-xl text-sm font-bold">
                  ذخیره
                </button>
                <button onClick={approveBrief} className="bg-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm">
                  تأیید برگه
                </button>
              </div>
              {brief?.mentorApproved && (
                <p className="text-green-400 text-sm mt-2">✓ برگه توسط منتور تأیید شده</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
