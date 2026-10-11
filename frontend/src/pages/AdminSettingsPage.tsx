import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import client from '../api/client';

// تنظیمات ادمین — شامل ساعت هدف جمع‌بندی (۲۴) و سقف بستن پرونده (۷۲)
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/settings').then(res => {
      setSettings(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await client.put('/settings', {
        contributionAmount: settings.contributionAmount,
        consentText: settings.consentText,
        domains: settings.domains,
        dataRetentionDays: settings.dataRetentionDays,
        clarifyTargetHours: settings.clarifyTargetHours,
        caseExpiryHours: settings.caseExpiryHours,
      });
      setMsg('✓ تنظیمات ذخیره شد');
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="p-4 text-seraj-muted">در حال بارگذاری...</div></Layout>;
  if (!settings) return <Layout><div className="p-4 text-seraj-muted">تنظیمات یافت نشد</div></Layout>;

  const numField = (label: string, key: string, hint?: string) => (
    <div>
      <label className="text-sm text-seraj-muted mb-1 block">{label}</label>
      <input
        type="number"
        min="1"
        value={settings[key]}
        onChange={e => setSettings({ ...settings, [key]: parseInt(e.target.value) || 0 })}
        className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none"
      />
      {hint && <p className="text-xs text-seraj-muted mt-1">{hint}</p>}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">تنظیمات</h1>
        {msg && <p className="text-green-400 text-sm mb-4">{msg}</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="bg-seraj-card rounded-2xl p-4 mb-4 space-y-4">
          <h3 className="font-bold">زمان‌بندی پرونده</h3>
          {numField('هدف جمع‌بندی از تخصیص منتور (ساعت)', 'clarifyTargetHours', 'پیش‌فرض ۲۴ ساعت — تأخیرها نسبت به این هدف ثبت و برای ادمین قابل پیگیری است.')}
          {numField('سقف بستن پرونده در صورت عدم پاسخ فرد (ساعت)', 'caseExpiryHours', 'پیش‌فرض ۷۲ ساعت — پس از این مدت پرونده به‌صورت فقط‌خواندنی بسته می‌شود.')}
        </div>

        <div className="bg-seraj-card rounded-2xl p-4 mb-4 space-y-4">
          <h3 className="font-bold">مشارکت و رضایت</h3>
          {numField('سهم مشارکت (تومان)', 'contributionAmount', 'ثبت پرداخت به‌صورت دستی توسط ادمین انجام می‌شود؛ بدون درگاه پرداخت.')}
          {numField('مدت نگهداری داده‌ها (روز)', 'dataRetentionDays')}
          <div>
            <label className="text-sm text-seraj-muted mb-1 block">متن فرم رضایت آگاهانه</label>
            <textarea
              value={settings.consentText}
              onChange={e => setSettings({ ...settings, consentText: e.target.value })}
              className="w-full bg-seraj-bg border border-white/10 rounded-xl px-4 py-3 text-seraj-text focus:border-seraj-orange focus:outline-none min-h-[120px]"
            />
          </div>
        </div>

        <button onClick={save} disabled={saving} className="w-full bg-seraj-orange text-seraj-bg rounded-xl py-3 font-bold disabled:opacity-50 touch-target">
          {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </button>
      </div>
    </Layout>
  );
}
