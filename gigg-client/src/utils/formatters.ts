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

/**
 * Robust calculation of task window opensAt and deadline instants
 * calculated relative to job date & reporting/end times.
 */
export function computeTaskClockWindow(
  task: { kind: string; anchorTime?: string; openMinutesBefore?: number; openMinutesAfter?: number; responseWindowMinutes?: number },
  job?: { date?: string; reportingTime?: string; endTime?: string } | null,
  completion?: { opensAt?: string; deadlineAt?: string; availableAt?: string; manually_reopened_at?: string } | null
): { opensAtMs: number | null; deadlineMs: number | null; isClockAnchored: boolean } {
  // If explicitly manually reopened
  if (completion?.manually_reopened_at) {
    const reopenedMs = new Date(completion.manually_reopened_at).getTime();
    const openAfter = task.openMinutesAfter !== undefined ? task.openMinutesAfter : 30;
    return {
      opensAtMs: reopenedMs,
      deadlineMs: reopenedMs + openAfter * 60_000,
      isClockAnchored: true,
    };
  }

  const rawTime =
    task.kind === 'opening'
      ? job?.reportingTime
      : task.kind === 'closing'
      ? (job?.endTime || job?.reportingTime)
      : task.anchorTime;

  if (job?.date && rawTime) {
    let cleanTime = rawTime.trim();
    // Handle 12-hour am/pm format if present
    const match12 = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = match12[2];
      const isPm = match12[4].toLowerCase() === 'pm';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      cleanTime = `${String(hours).padStart(2, '0')}:${minutes}:00`;
    } else {
      const parts = cleanTime.split(':');
      if (parts.length === 2) {
        cleanTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
      }
    }

    const anchorDate = new Date(`${job.date}T${cleanTime}`);
    if (!Number.isNaN(anchorDate.getTime())) {
      const openBefore = task.openMinutesBefore !== undefined ? task.openMinutesBefore : 15;
      const openAfter = task.openMinutesAfter !== undefined ? task.openMinutesAfter : 30;
      return {
        opensAtMs: anchorDate.getTime() - openBefore * 60_000,
        deadlineMs: anchorDate.getTime() + openAfter * 60_000,
        isClockAnchored: true,
      };
    }
  }

  // Fallback to backend completion values if job date/time isn't present
  if (completion?.opensAt && completion?.deadlineAt) {
    return {
      opensAtMs: new Date(completion.opensAt).getTime(),
      deadlineMs: new Date(completion.deadlineAt).getTime(),
      isClockAnchored: true,
    };
  }

  const availableMs = completion?.availableAt ? new Date(completion.availableAt).getTime() : null;
  const responseMinutes = task.responseWindowMinutes || 15;
  return {
    opensAtMs: availableMs,
    deadlineMs: availableMs ? availableMs + responseMinutes * 60_000 : null,
    isClockAnchored: false,
  };
}
