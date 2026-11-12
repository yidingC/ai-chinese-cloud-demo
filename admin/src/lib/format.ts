import type { PlatformState } from "../domain/types";

export function formatDateTime(
  value: string,
  timeZone: string,
  language: string,
  options: Intl.DateTimeFormatOptions = {}
) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options
  }).format(new Date(value));
}

export function formatDate(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(value));
}

export function formatMonthDay(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(value));
}

export function formatTime(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatRange(startAt: string, endAt: string, timeZone: string, language: string) {
  return `${formatTime(startAt, timeZone, language)}–${formatTime(endAt, timeZone, language)}`;
}

export function inputDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function relativeTime(value: string, language: string) {
  const diff = new Date(value).getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diff) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (absMinutes < 60) return rtf.format(Math.round(diff / 60_000), "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function timeZoneLabel(timeZone: string) {
  if (timeZone === "Asia/Jakarta") return "GMT+7 雅加达";
  if (timeZone === "Asia/Shanghai") return "GMT+8 上海";
  if (timeZone === "Asia/Singapore") return "GMT+8 新加坡";
  return timeZone;
}

export function percent(value: number) {
  return `${Math.round(value)}%`;
}

export function stateLanguage(state: PlatformState) {
  return state.ui.language === "id-ID" ? "id-ID" : "zh-CN";
}
