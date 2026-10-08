import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'ETB'): string {
  return `${currency} ${amount.toLocaleString('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMM d, yyyy');
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm');
}

export function formatRelative(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'HH:mm');
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // Restaurant status
    pending: 'badge-orange',
    active: 'badge-green',
    suspended: 'badge-red',
    rejected: 'badge-red',
    cancelled: 'badge-gray',
    // Subscription status
    trial: 'badge-blue',
    grace: 'badge-orange',
    // Order status
    new: 'badge-blue',
    preparing: 'badge-orange',
    ready: 'badge-green',
    served: 'badge-gray',
    // Payment proof status
    approved: 'badge-green',
    // Table status
    available: 'badge-green',
    occupied: 'badge-red',
    reserved: 'badge-orange',
    cleaning: 'badge-gray',
  };
  return map[status] ?? 'badge-gray';
}

export function getOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'New',
    preparing: 'Preparing',
    ready: 'Ready',
    served: 'Served',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    cashier: 'Cashier',
    kitchen: 'Kitchen',
    waiter: 'Waiter',
  };
  return map[role] ?? role;
}

export function getRoleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    owner: 'badge-purple',
    manager: 'badge-blue',
    cashier: 'badge-green',
    kitchen: 'badge-orange',
    waiter: 'badge-gray',
  };
  return map[role] ?? 'badge-gray';
}

export function truncate(str: string, maxLength = 40): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function isDarkColor(colorStr?: string): boolean {
  if (!colorStr) return false;
  let hex = colorStr.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  // ITU-R BT.601 perceptual luminance formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 155;
}

export function applyTheme(themeColor?: string, backgroundColor?: string) {
  const brand = (themeColor && themeColor !== '#f97316') ? themeColor : '#2F7D32';
  const bg = (backgroundColor && backgroundColor !== '#f1f5f9') ? backgroundColor : '#F7F7F2';
  const root = document.documentElement;

  root.style.setProperty('--brand-500', brand);
  root.style.setProperty('--brand-600', brand);
  root.style.setProperty('--brand-glow', `color-mix(in srgb, ${brand} 35%, transparent)`);
  root.style.setProperty('--brand-glow-sm', `color-mix(in srgb, ${brand} 20%, transparent)`);
  root.style.setProperty('--background-color', bg);

  const isDark = isDarkColor(bg);
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.setProperty('--card-bg', 'rgba(23, 32, 51, 0.92)');
    root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--text-main', '#F7F7F2');
    root.style.setProperty('--text-muted', '#94a3b8');
    root.style.setProperty('--sidebar-bg', 'rgba(23, 32, 51, 0.96)');
    root.style.setProperty('--header-bg', 'rgba(23, 32, 51, 0.85)');
    root.style.setProperty('--input-bg', 'rgba(30, 41, 59, 0.8)');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.setProperty('--card-bg', '#FFFFFF');
    root.style.setProperty('--card-border', '#E2E8F0');
    root.style.setProperty('--text-main', '#172033');
    root.style.setProperty('--text-muted', '#64748B');
    root.style.setProperty('--sidebar-bg', 'rgba(255, 255, 255, 0.96)');
    root.style.setProperty('--header-bg', 'rgba(255, 255, 255, 0.85)');
    root.style.setProperty('--input-bg', '#FFFFFF');
  }
}

export function getLuminance(hexStr: string): number {
  let hex = hexStr.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return 0.5;
  const rgb = [0, 2, 4].map(idx => {
    const val = parseInt(hex.substring(idx, idx + 2), 16) / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

