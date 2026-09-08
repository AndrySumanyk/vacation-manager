export type Shift = "early" | "day" | "night";

export type ScheduleChange = {
  id?: string;
  employee_id?: string;
  effective_date: string;
  initial_shift: Shift;
  created_at?: string;
};

type ScheduleEmployee = {
  schedule_type: number;
  initial_shift: Shift;
  cycle_start_date: string;
  schedule_changes?: ScheduleChange[];
};

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDaysDifference(firstDate: Date, secondDate: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round(
    (firstDate.getTime() - secondDate.getTime()) /
      millisecondsPerDay
  );
}

function getEffectiveSchedule(
  employee: ScheduleEmployee,
  dateString: string
) {
  let effectiveDate = employee.cycle_start_date;
  let initialShift = employee.initial_shift;

  for (const change of employee.schedule_changes ?? []) {
    if (change.effective_date <= dateString && change.effective_date >= effectiveDate) {
      effectiveDate = change.effective_date;
      initialShift = change.initial_shift;
    }
  }

  return {
    effectiveDate,
    initialShift,
  };
}

export function getShiftForDate(
  employee: ScheduleEmployee,
  dateString: string
): Shift {
  const date = parseDate(dateString);
  const { effectiveDate, initialShift } = getEffectiveSchedule(
    employee,
    dateString
  );
  const cycleStart = parseDate(effectiveDate);
  const daysDifference = getDaysDifference(date, cycleStart);
  const dayOfWeek = date.getDay();

  const adjustedDaysDifference =
    dayOfWeek === 0 ? daysDifference + 1 : daysDifference;

  const weeksPassed = Math.floor(
    adjustedDaysDifference / 7
  );

  const shifts: Shift[] =
    employee.schedule_type === 3
      ? ["early", "day", "night"]
      : ["early", "day"];

  const initialIndex = shifts.indexOf(initialShift);

  const safeInitialIndex =
    initialIndex === -1 ? 0 : initialIndex;

  const shiftIndex =
    ((safeInitialIndex + weeksPassed) % shifts.length +
      shifts.length) %
    shifts.length;

  return shifts[shiftIndex];
}

export function isWorkingDay(
  employee: ScheduleEmployee,
  dateString: string
) {
  const date = parseDate(dateString);
  const dayOfWeek = date.getDay();
  const shift = getShiftForDate(employee, dateString);

  if (shift === "night") {
    return (
      dayOfWeek === 0 ||
      dayOfWeek === 1 ||
      dayOfWeek === 2 ||
      dayOfWeek === 3 ||
      dayOfWeek === 4
    );
  }

  return dayOfWeek >= 1 && dayOfWeek <= 5;
}
