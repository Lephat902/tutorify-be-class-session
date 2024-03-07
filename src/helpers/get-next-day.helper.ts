export function getNextday(currentDate: Date) {
  const nextday = new Date(currentDate);
  nextday.setDate(currentDate.getDate() + 1);
  return nextday;
}
