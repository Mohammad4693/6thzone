import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireRole } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// GET /api/settings (public for consent text, but auth required for all)
router.get('/', async (_req: AuthRequest, res) => {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  settings.forEach(s => { map[s.key] = s.value; });
  res.json({
    contributionAmount: parseInt(map.contribution_amount || '150000'),
    consentText: map.consent_text || '',
    consentVersion: map.consent_version || '1.0',
    brandImage: map.brand_image || '',
    domains: map.domains ? JSON.parse(map.domains) : ['legal'],
    trainingVideoUrl: map.training_video_url || '',
    dataRetentionDays: parseInt(map.data_retention_days || '365'),
  });
});

// PUT /api/settings (admin only)
router.put('/', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { contributionAmount, consentText, brandImage, domains, trainingVideoUrl, dataRetentionDays } = req.body;

  const updates: { key: string; value: string }[] = [];
  if (contributionAmount !== undefined) updates.push({ key: 'contribution_amount', value: String(contributionAmount) });
  if (consentText !== undefined) {
    updates.push({ key: 'consent_text', value: consentText });
    // Bump version when consent text changes
    const currentVersion = await prisma.setting.findUnique({ where: { key: 'consent_version' } });
    const newVersion = currentVersion ? bumpVersion(currentVersion.value) : '1.1';
    updates.push({ key: 'consent_version', value: newVersion });
  }
  if (brandImage !== undefined) updates.push({ key: 'brand_image', value: brandImage });
  if (domains !== undefined) updates.push({ key: 'domains', value: JSON.stringify(domains) });
  if (trainingVideoUrl !== undefined) updates.push({ key: 'training_video_url', value: trainingVideoUrl });
  if (dataRetentionDays !== undefined) updates.push({ key: 'data_retention_days', value: String(dataRetentionDays) });

  for (const u of updates) {
    await prisma.setting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value },
      update: { value: u.value },
    });
  }

  logAudit(req.userId, 'UPDATE_SETTINGS', 'Setting', null, { updatedKeys: updates.map(u => u.key) });
  res.json({ ok: true });
});

function bumpVersion(v: string): string {
  const parts = v.split('.').map(Number);
  if (parts.length < 2) return '1.1';
  parts[1] = (parts[1] || 0) + 1;
  return parts.join('.');
}

export default router;
