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
