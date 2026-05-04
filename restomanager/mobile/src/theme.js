// Bảng màu Material giống web (palette restomanager)
export const colors = {
  primary:           '#0d5c63',
  primaryDark:       '#094951',
  primaryContainer:  '#abeef6',
  onPrimary:         '#ffffff',
  secondary:         '#006a66',
  secondaryContainer:'#84f2ec',
  surface:           '#f9f9fc',
  surfaceLow:        '#f3f3f6',
  surfaceContainer:  '#eeeef0',
  surfaceHigh:       '#e8e8ea',
  border:            '#bfc8c9',
  borderSoft:        '#e2e2e5',
  onSurface:         '#1a1c1e',
  onSurfaceVariant:  '#3f484a',
  muted:             '#6f797a',
  white:             '#ffffff',
  error:             '#ba1a1a',
  errorContainer:    '#ffdad6',
  success:           '#15803d',
  warning:           '#b45309',
  badgeBusy:         '#fef3c7',
  badgeBusyText:     '#92400e',
  badgePay:          '#fee2e2',
  badgePayText:      '#991b1b',
  badgeFree:         '#dcfce7',
  badgeFreeText:     '#166534',
};

export const spacing = (n) => n * 4;

export const fmt = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';

export const PAY_METHODS = [
  { key:'cash',     label:'Tiền mặt',     icon:'cash-outline' },
  { key:'transfer', label:'Chuyển khoản', icon:'qr-code-outline' },
  { key:'card',     label:'Quẹt thẻ',     icon:'card-outline' },
  { key:'vnpay',    label:'VietQR Pro',   icon:'scan-outline' },
  { key:'banking',  label:'Banking',      icon:'business-outline' },
  { key:'momo',     label:'MoMo',         icon:'phone-portrait-outline' },
];

export const PAY_LABELS = {
  cash:'Tiền mặt', card:'Thẻ', transfer:'Chuyển khoản',
  online:'Bán online', grab:'Grab', vnpay:'VietQR Pro', banking:'Banking',
  momo:'MoMo', zalopay:'ZaloPay'
};
