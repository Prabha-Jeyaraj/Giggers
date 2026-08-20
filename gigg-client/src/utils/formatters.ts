/**
 * Formats a 24-hour time string ("14:30", "14:30:00", "09:00") or Date
 * into clean 12-hour AM/PM format ("02:30 pm", "09:00 am").
 */
export function formatTime12Hour(timeStr?: string | Date | null): string {
  if (!timeStr) return '';

  if (timeStr instanceof Date) {
    return timeStr.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
  }

  const trimmed = String(timeStr).trim();
  if (/am|pm/i.test(trimmed)) return trimmed.toLowerCase();

  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (isNaN(hours)) return trimmed;
    const period = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    const formattedHours = String(hours).padStart(2, '0');
    return `${formattedHours}:${minutes} ${period}`;
  }

  return trimmed;
}
