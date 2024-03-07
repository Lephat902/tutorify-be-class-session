export function convertTimestringToDate(timeString: string) {
  const today = new Date();
  const [hours, minutes] = timeString.split(':').map((str) => Number(str));

  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    hours,
    minutes,
  );
}
