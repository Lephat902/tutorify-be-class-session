export function convertTimestringToDate(timeString: string) {
  const today = new Date();
  const [hours, minutes, seconds] = timeString
    .split(':')
    .map((str) => Number(str));

  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    hours,
    minutes,
    seconds,
  );
}
