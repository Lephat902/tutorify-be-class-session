export function setTimeToDate(date: Date, time: Date): Date {
  const datetime = new Date(date);
  datetime.setHours(time.getHours(), time.getMinutes());
  return datetime;
}
