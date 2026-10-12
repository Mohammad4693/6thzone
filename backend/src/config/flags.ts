// Feature flags — v4 MVP. Legacy features stay in the codebase but are
// switched off by default. A flag is ON only when its env var is exactly
// '1' or 'true'; unset/empty/any other value keeps it OFF (v4 default).
function on(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return v === '1' || v === 'true';
}

export const FLAGS = {
  otp: on('FLAG_OTP', false),                       // OTP / SMS login
  payments: on('FLAG_PAYMENTS', false),             // contribution flow
  sessions: on('FLAG_SESSIONS', false),             // 15-min session booking
  mentorAssignment: on('FLAG_MENTOR_ASSIGNMENT', false), // mentor flow
  autoClose72h: on('FLAG_AUTO_CLOSE_72H', false),   // 72h auto-close sweep
  autoDeleteProfile: on('FLAG_AUTO_DELETE_PROFILE', false), // auto profile purge
};

// Safe to expose publicly (frontend uses it to hide disabled features)
export function flagResponse() {
  return {
    otp: FLAGS.otp,
    payments: FLAGS.payments,
    sessions: FLAGS.sessions,
    mentorAssignment: FLAGS.mentorAssignment,
  };
}
