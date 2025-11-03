export function getIsoTimestr(): string {
  return new Date().toISOString();
}

export const getTimestamp = () => {
  let time = Date.parse(new Date().toUTCString());

  return time / 1000;
};

export const getMillisecond = () => {
  let time = new Date().getTime();

  return time;
};

export const getOneYearLaterTimestr = () => {
  const currentDate = new Date();
  const oneYearLater = new Date(currentDate);
  oneYearLater.setFullYear(currentDate.getFullYear() + 1);

  return oneYearLater.toISOString();
};

export const getDaysLaterTimestr = (days: number) => {
  const currentDate = new Date();
  const later = new Date(currentDate);
  later.setUTCDate(currentDate.getUTCDate() + days);
  return later.toISOString();
};
