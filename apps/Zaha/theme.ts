export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primarySoft: '#eff6ff',
  primaryBorder: '#bfdbfe',
  primaryPale: '#f0f9ff',
  background: '#f9fafb',
  surface: '#ffffff',
  inputBg: '#f8fafc',
  chipBg: '#f3f4f6',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  textPrimary: '#111827',
  textStrong: '#374151',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInvert: '#ffffff',
  info: '#dbeafe',
  success: '#16a34a',
  successBg: '#dcfce7',
  successBorder: '#86efac',
  warning: '#d97706',
  warningBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  like: '#ef4444',
  likeSoft: '#fef2f2',
  rating: '#ca8a04',
  vip: '#b45309',
  vipBg: '#fef3c7',
  vipBorder: '#fcd34d',
  premium: '#1d4ed8',
  premiumBg: '#dbeafe',
  premiumBorder: '#93c5fd',
  sponsored: '#a21caf',
  sponsoredBg: '#fae8ff',
  sponsoredBorder: '#f0abfc',
  unavailable: '#c2410c',
  unavailableBg: '#ffedd5',
  proposed: '#6d28d9',
  proposedBg: '#ede9fe',
};

/** Couleurs du badge d'un lieu : VIP = ambre, Premium = bleu. */
export function placeBadgeColors(status?: string | null) {
  if (status === 'premium') {
    return {
      backgroundColor: colors.premiumBg,
      color: colors.premium,
      borderColor: colors.premiumBorder,
    };
  }
  return {
    backgroundColor: colors.vipBg,
    color: colors.vip,
    borderColor: colors.vipBorder,
  };
}

/** Couleur d'accent (icônes / libellés des boutons) selon le statut du lieu. */
export function placeAccentColor(status?: string | null): string {
  return status === 'premium' ? colors.premium : colors.vip;
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};