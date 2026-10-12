export const REQUEST_STATUS_FA: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_REVIEW: 'نیازمند بررسی ادمین',
  APPROVED: 'در انتظار پاسخ عضو',
  ASSIGNED: 'در جریان',
  CLOSED_EXPIRED: 'بسته‌شده (انقضا)',
  CLOSED_COMPLETED: 'بسته‌شده (تکمیل)',
  CLOSED_INCOMPLETE: 'بسته‌شده (ناقص)',
  REJECTED: 'رد شده',
};

export const ROUND_STATUS_FA: Record<string, string> = {
  PENDING: 'در حال تحلیل',
  DONE: 'آماده',
  FAILED: 'ناموفق',
};

export const CLARITY_STATUS_FA: Record<string, string> = {
  empty: 'خالی',
  partial: 'نیمه‌کاره',
  complete: 'کامل',
};

export const CLARITY_KEYS_FA: Record<string, string> = {
  problem: 'مسئله',
  outcome: 'نتیجه مطلوب',
  constraints_cost: 'قیود و هزینه',
  resources_info: 'منابع و اطلاعات',
  next_step: 'قدم بعدی',
};
