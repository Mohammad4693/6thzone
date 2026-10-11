/**
 * Server-side rule test (proposal v3, item 3):
 *   NO AI draft reaches the member unless the mentor has APPROVED it.
 *
 * Run inside the backend container while the server is up:
 *   docker compose -f docker-compose.base44.yml exec -T backend \
 *     node tests/draft-rule.test.mjs
 *
 * Exits 0 on pass, 1 on failure. Requires the seeded users (npm run prisma:seed).
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+989000000001';
const MENTOR_PHONE = process.env.MENTOR_PHONE || '+989000000002';
const MEMBER_PHONE = process.env.MEMBER_PHONE || '+989000000003';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

async function api(method, path, token, body, isForm) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body && !isForm ? JSON.stringify(body) : body,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

/** Login via OTP. Dev mode (no SMS key) returns devCode in the response. */
async function login(phone) {
  const send = await api('POST', '/api/auth/send-code', null, { phone });
  if (!send.data?.devCode) {
    throw new Error(`no devCode for ${phone} — SMS configured? (status ${send.status})`);
  }
  const verify = await api('POST', '/api/auth/verify', null, { phone, code: send.data.devCode });
  if (!verify.data?.token) throw new Error(`verify failed for ${phone}: ${JSON.stringify(verify.data)}`);
  return verify.data.token;
}

async function main() {
  console.log(' draft-rule test — no unapproved AI draft reaches the member');

  const [admin, mentorUser, memberUser] = await Promise.all([
    prisma.user.findUnique({ where: { phone: ADMIN_PHONE } }),
    prisma.user.findUnique({ where: { phone: MENTOR_PHONE } }),
    prisma.user.findUnique({ where: { phone: MEMBER_PHONE } }),
  ]);
  if (!admin || !mentorUser || !memberUser) throw new Error('seed users missing — run prisma:seed');
  const [adminToken, mentorToken, memberToken] = await Promise.all([
    login(ADMIN_PHONE), login(MENTOR_PHONE), login(MEMBER_PHONE),
  ]);

  // 1. Member registers a need
  const created = await api('POST', '/api/requests', memberToken, {
    description: 'آزمون قانون پیش‌نویس — عضو به تعیین تکلیف سند ملکی خود نیاز دارد.',
    title: 'آزمون قانون پیش‌نویس',
    consentAccepted: 'true',
    consentVersion: '1.0',
  });
  check('member can create a request', created.status === 200, created.data);
  const requestId = created.data.id;

  // 2. Admin approves and assigns the mentor
  const approved = await api('POST', `/api/admin/requests/${requestId}/approve`, adminToken);
  check('admin approves request', approved.status === 200, approved.data);
  const assigned = await api('POST', `/api/admin/requests/${requestId}/assign`, adminToken, { mentorId: mentorUser.id });
  check('admin assigns mentor (24h target + 72h expiry recorded)', assigned.status === 200 && assigned.data.targetAt && assigned.data.expiresAt, assigned.data);

  // 3. An UNAPPROVED draft exists (as if AI generated it)
  const MARKER = 'محتوای پنهانِ پیش‌نویسِ تأییدنشده';
  const draft = await prisma.aIDraft.create({
    data: { requestId, content: MARKER, status: 'PENDING_REVIEW' },
  });

  // 4. Member must NOT be able to list drafts at all
  const draftsList = await api('GET', `/api/ai/${requestId}/drafts`, memberToken);
  check('member gets 403 on AI drafts endpoint', draftsList.status === 403, draftsList);

  // 5. Member request detail must not leak the draft
  const detail = await api('GET', `/api/requests/${requestId}`, memberToken);
  const detailStr = JSON.stringify(detail.data);
  check('member request detail hides drafts', detail.status === 200 && (detail.data.aiDrafts?.length ?? 1) === 0, detail.data?.aiDrafts);
  check('member request detail has no draft content', !detailStr.includes(MARKER));

  // 6. Member messages must not contain the draft before approval
  const before = await api('GET', `/api/messages/${requestId}`, memberToken);
  const beforeStr = JSON.stringify(before.data);
  check('member sees no draft content in chat before approval', before.status === 200 && !beforeStr.includes(MARKER), before.data?.length);

  // 7. Mentor approves the draft → it becomes a chat message
  const approve = await api('POST', `/api/ai/${requestId}/draft/${draft.id}/approve`, mentorToken, {});
  check('mentor can approve the draft', approve.status === 200, approve.data);
  const after = await api('GET', `/api/messages/${requestId}`, memberToken);
  const afterStr = JSON.stringify(after.data);
  check('member sees the draft only after mentor approval', after.status === 200 && afterStr.includes(MARKER));

  // Cleanup
  await prisma.request.delete({ where: { id: requestId } }).catch(() => {});

  if (failures > 0) {
    console.error(`\n FAILED: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n PASSED: unapproved AI drafts never reach the member');
}

main()
  .catch(e => { console.error('Test error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
