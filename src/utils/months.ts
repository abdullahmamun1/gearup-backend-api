/** Month buckets in Bangladesh time, for charts. */

export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** "2026-10" for a timestamp, in Dhaka time. */
export const monthKey = (date: Date) =>
  new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 7);

/** Every month between two instants, so empty months still show as zero. */
export const monthsBetween = (from: Date, to: Date) => {
  const months: string[] = [];
  const cursor = new Date(from.getTime() + DHAKA_OFFSET_MS);
  cursor.setUTCDate(1);
  const end = monthKey(new Date(to.getTime() - 1));
  while (months.length < 60) {
    const key = cursor.toISOString().slice(0, 7);
    months.push(key);
    if (key >= end) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
};

/** The start of the month `count - 1` months ago (Dhaka), as an instant. */
export const monthsAgoStart = (count: number, now = new Date()) => {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (count - 1), 1);
  return new Date(start - DHAKA_OFFSET_MS);
};
