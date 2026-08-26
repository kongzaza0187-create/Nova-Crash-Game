const MALTA_TIMEZONE = "Europe/Malta";

export function getMaltaDate(baseDate: Date = new Date()): Date {
  const maltaString = baseDate.toLocaleString("en-US", { timeZone: MALTA_TIMEZONE });
  return new Date(maltaString);
}

export function getMaltaIsoString(baseDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(baseDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const millis = String(baseDate.getUTCMilliseconds()).padStart(3, "0");
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.${millis}+01:00`;
}

export function formatMaltaTime(baseDate: Date = new Date(), options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: MALTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...options
  };
  return new Intl.DateTimeFormat("en-GB", defaultOptions).format(baseDate);
}

export function getMaltaTimestamp(): number {
  return Date.now();
}
