export function getNextday(currentDate: Date) {
  const nextday = new Date(currentDate);
  nextday.setUTCDate(currentDate.getUTCDate() + 1);
  return nextday;
}
