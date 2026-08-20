// Formats a Date/timestamp/ISO string as 12-hour time, e.g. "2:30 PM".
export function formatTime12h(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Formats a raw "HH:MM" (24hr) string from a <input type="time"> value as 12-hour time.
export function formatTimeString12h(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value;

  const hours24 = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

// Formats a Date/timestamp/ISO string as date + 12-hour time, e.g. "12 Aug, 2:30 PM".
export function formatDateTime12h(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
