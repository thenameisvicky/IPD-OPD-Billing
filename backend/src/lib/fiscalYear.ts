export function getFiscalYear(
  date: Date = new Date(),
  startMonth = 4,
): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= startMonth) {
    const next = String((year + 1) % 100).padStart(2, "0");
    return `${year}-${next}`;
  }
  const prev = year - 1;
  const curr = String(year % 100).padStart(2, "0");
  return `${prev}-${curr}`;
}
