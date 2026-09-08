"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { getCurrentEmployee } from "@/lib/auth";
import {
  getShiftForDate,
  isWorkingDay,
  type ScheduleChange,
  type Shift,
} from "@/lib/schedule";

type Employee = {
  id: string;
  full_name: string;
  schedule_type: number;
  initial_shift: Shift;
  cycle_start_date: string;
  active: boolean;
  role: string;
  team_leader: boolean;
  schedule_changes: ScheduleChange[];
};

type VacationRequest = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved";
};

type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  holiday_type: string;
};

type DayOff = {
  id: string;
  day_off_date: string;
  shift_type: Shift;
  created_by: string;
  created_at: string;
};

function parseDate(dateString: string) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(
  dateString: string
) {
  const [year, month, day] =
    dateString.split("-");

  return `${day}.${month}.${year}`;
}

function getMonthDays(
  year: number,
  month: number
) {
  const days: string[] = [];

  const date = new Date(
    year,
    month,
    1
  );

  while (
    date.getMonth() === month
  ) {
    days.push(
      formatDate(date)
    );

    date.setDate(
      date.getDate() + 1
    );
  }

  return days;
}

function getWeekdayName(
  dateString: string,
  language: "uk" | "cs"
) {
  const date = parseDate(
    dateString
  );

  const names =
    language === "cs"
      ? ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"]
      : ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  return names[
    date.getDay()
  ];
}

function getShiftCode(
  shift: Shift
) {
  if (shift === "early") {
    return "R";
  }

  if (shift === "day") {
    return "O";
  }

  return "N";
}

function getShiftName(
  shift: Shift,
  language: "uk" | "cs"
) {
  if (shift === "early") {
    return language === "cs" ? "Ranní" : "Рання";
  }

  if (shift === "day") {
    return language === "cs" ? "Odpolední" : "Обідня";
  }

  return language === "cs" ? "Noční" : "Нічна";
}

function getEmployeeGroup(
  employee: Employee
) {
  if (
    employee.schedule_type === 2 &&
    employee.initial_shift === "early"
  ) {
    return 1;
  }

  if (
    employee.schedule_type === 2 &&
    employee.initial_shift === "day"
  ) {
    return 2;
  }

  if (
    employee.schedule_type === 3 &&
    employee.initial_shift === "early"
  ) {
    return 3;
  }

  if (
    employee.schedule_type === 3 &&
    employee.initial_shift === "day"
  ) {
    return 4;
  }

  return 5;
}

function getGroupColor(
  group: number
) {
  if (group === 1) {
    return "#eff6ff";
  }

  if (group === 2) {
    return "#f0fdf4";
  }

  if (group === 3) {
    return "#fefce8";
  }

  if (group === 4) {
    return "#faf5ff";
  }

  return "#fff1f2";
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return (
    startA <= endB &&
    endA >= startB
  );
}

export default function CalendarPage() {
  const { language } = useLanguage();
  const tr = (uk: string, cs: string) =>
    language === "cs" ? cs : uk;

  const today = new Date();

  const [currentYear, setCurrentYear] =
    useState(2027);

  const [currentMonth, setCurrentMonth] =
    useState(0);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [currentEmployee, setCurrentEmployee] =
    useState<{ role: string } | null>(null);

  const [vacationRequests, setVacationRequests] =
    useState<VacationRequest[]>([]);

  const [holidays, setHolidays] =
    useState<Holiday[]>([]);

  const [daysOff, setDaysOff] =
    useState<DayOff[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const loggedInEmployee = await getCurrentEmployee();
      setCurrentEmployee(loggedInEmployee);

      const [
        employeesResult,
        scheduleChangesResult,
        vacationsResult,
        holidaysResult,
        daysOffResult,
      ] = await Promise.all([
        supabase
          .from("employees")
          .select(
            `
              id,
              full_name,
              schedule_type,
              initial_shift,
              cycle_start_date,
              active,
              role,
              team_leader
            `
          )
          .eq("active", true),

        supabase
          .from("employee_schedule_changes")
          .select(
            `
              id,
              employee_id,
              effective_date,
              initial_shift,
              created_at
            `
          )
          .order("effective_date", { ascending: true }),

        supabase
          .from("vacation_requests")
          .select(
            `
              id,
              employee_id,
              start_date,
              end_date,
              status
            `
          )
          .in("status", [
            "pending",
            "approved",
          ]),

        supabase
          .from("holidays")
          .select(
            `
              id,
              holiday_date,
              name,
              holiday_type
            `
          ),

        supabase
          .from("days_off")
          .select(
            `
              id,
              day_off_date,
              shift_type,
              created_by,
              created_at
            `
          )
          .order(
            "day_off_date",
            {
              ascending: true,
            }
          ),
      ]);

      if (employeesResult.error) {
        throw employeesResult.error;
      }

      if (scheduleChangesResult.error) {
        throw scheduleChangesResult.error;
      }

      if (vacationsResult.error) {
        throw vacationsResult.error;
      }

      if (holidaysResult.error) {
        throw holidaysResult.error;
      }

      if (daysOffResult.error) {
        throw daysOffResult.error;
      }

      const loadedEmployees =
        (employeesResult.data ?? []) as Employee[];

      const loadedScheduleChanges =
        (scheduleChangesResult.data ?? []) as ScheduleChange[];

      const scheduleChangesByEmployee =
        new Map<string, ScheduleChange[]>();

      loadedScheduleChanges.forEach((change) => {
        if (!change.employee_id) return;

        if (!scheduleChangesByEmployee.has(change.employee_id)) {
          scheduleChangesByEmployee.set(change.employee_id, []);
        }

        scheduleChangesByEmployee
          .get(change.employee_id)!
          .push(change);
      });

      setEmployees(
        loadedEmployees.map((employee) => ({
          ...employee,
          schedule_changes:
            scheduleChangesByEmployee.get(employee.id) ?? [],
        }))
      );

      setVacationRequests(
        (vacationsResult.data ??
          []) as VacationRequest[]
      );

      setHolidays(
        (holidaysResult.data ??
          []) as Holiday[]
      );

      setDaysOff(
        (daysOffResult.data ??
          []) as DayOff[]
      );
    } catch (error) {
      console.error(
        "CALENDAR LOAD ERROR:",
        error
      );

      setError(
        tr("Не вдалося завантажити календар.", "Nepodařilo se načíst kalendář.")
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const monthDays = useMemo(
    () =>
      getMonthDays(
        currentYear,
        currentMonth
      ),
    [
      currentYear,
      currentMonth,
    ]
  );

  const sortedEmployees =
    useMemo(() => {
      return [
        ...employees,
      ].sort((a, b) => {
        if (
          a.team_leader !==
          b.team_leader
        ) {
          return a.team_leader
            ? -1
            : 1;
        }

        const groupA =
          getEmployeeGroup(a);

        const groupB =
          getEmployeeGroup(b);

        if (groupA !== groupB) {
          return (
            groupA - groupB
          );
        }

        return a.full_name.localeCompare(
          b.full_name,
          "uk"
        );
      });
    }, [employees]);

  const holidayMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          Holiday
        >();

      holidays.forEach(
        (holiday) => {
          map.set(
            holiday.holiday_date,
            holiday
          );
        }
      );

      return map;
    }, [holidays]);

  /*
   * Вихідні зберігаються як:
   *
   * дата + зміна
   *
   * Наприклад:
   *
   * 09.01.2027 + early
   * 09.01.2027 + day
   *
   * Тому один запис автоматично
   * застосовується до всіх працівників
   * цієї зміни.
   */
  const dayOffMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          Set<Shift>
        >();

      daysOff.forEach(
        (dayOff) => {
          if (!map.has(
            dayOff.day_off_date
          )) {
            map.set(
              dayOff.day_off_date,
              new Set<Shift>()
            );
          }

          map
            .get(
              dayOff.day_off_date
            )!
            .add(
              dayOff.shift_type
            );
        }
      );

      return map;
    }, [daysOff]);

  /*
   * Визначаємо конфлікти
   * тільки між працівниками
   * однієї категорії:
   *
   * Team Leader ↔ Team Leader
   * звичайний ↔ звичайний
   *
   * Team Leader ↔ звичайний
   * НЕ є конфліктом.
   */
  const conflictEmployeesByDate =
    useMemo(() => {
      const result =
        new Map<
          string,
          Set<string>
        >();

      monthDays.forEach(
        (dateString) => {
          const requestsForDate =
            vacationRequests.filter(
              (request) =>
                rangesOverlap(
                  request.start_date,
                  request.end_date,
                  dateString,
                  dateString
                )
            );

          const teamLeaderIds =
            new Set<string>();

          const ordinaryIds =
            new Set<string>();

          requestsForDate.forEach(
            (request) => {
              const employee =
                employees.find(
                  (item) =>
                    item.id ===
                    request.employee_id
                );

              if (!employee) {
                return;
              }

              if (
                employee.team_leader
              ) {
                teamLeaderIds.add(
                  employee.id
                );
              } else {
                ordinaryIds.add(
                  employee.id
                );
              }
            }
          );

          const conflictIds =
            new Set<string>();

          if (
            teamLeaderIds.size > 1
          ) {
            teamLeaderIds.forEach(
              (id) =>
                conflictIds.add(id)
            );
          }

          if (
            ordinaryIds.size > 1
          ) {
            ordinaryIds.forEach(
              (id) =>
                conflictIds.add(id)
            );
          }

          if (
            conflictIds.size > 0
          ) {
            result.set(
              dateString,
              conflictIds
            );
          }
        }
      );

      return result;
    }, [
      monthDays,
      vacationRequests,
      employees,
    ]);

  function hasVacationOnDate(
    employeeId: string,
    dateString: string
  ) {
    return vacationRequests.find(
      (request) =>
        request.employee_id ===
          employeeId &&
        rangesOverlap(
          request.start_date,
          request.end_date,
          dateString,
          dateString
        )
    );
  }

  function hasConflictForEmployeeDate(
    employeeId: string,
    dateString: string
  ) {
    return (
      conflictEmployeesByDate
        .get(dateString)
        ?.has(employeeId) ??
      false
    );
  }

  function isDayOffForEmployee(
    employee: Employee,
    dateString: string
  ) {
    const shift =
      getShiftForDate(
        employee,
        dateString
      );

    return (
      dayOffMap
        .get(dateString)
        ?.has(shift) ??
      false
    );
  }

  function goToPreviousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(
        currentYear - 1
      );
    } else {
      setCurrentMonth(
        currentMonth - 1
      );
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(
        currentYear + 1
      );
    } else {
      setCurrentMonth(
        currentMonth + 1
      );
    }
  }

  function goToJanuary2027() {
    setCurrentYear(2027);
    setCurrentMonth(0);
  }

  const monthName =
    new Date(
      currentYear,
      currentMonth,
      1
    ).toLocaleDateString(
      language === "cs" ? "cs-CZ" : "uk-UA",
      {
        month: "long",
        year: "numeric",
      }
    );

  const approvedCount =
    vacationRequests.filter(
      (request) =>
        request.status ===
        "approved"
    ).length;

  const pendingCount =
    vacationRequests.filter(
      (request) =>
        request.status ===
        "pending"
    ).length;

  if (loading) {
    return (
      <main className="h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-[1800px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            {tr("Завантаження календаря...", "Načítání kalendáře...")}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-gray-50 p-3">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col">

        {/* HEADER */}

        <div className="mb-3 shrink-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="flex items-center gap-3">

                <Link
                  href={currentEmployee?.role === "admin" ? "/admin" : "/"}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  {currentEmployee?.role === "admin"
                    ? tr("← Адмін", "← Administrace")
                    : tr("← Мої відпустки", "← Moje dovolené")}
                </Link>

                <h1 className="text-xl font-bold text-gray-900">
                  {tr("🗓️ Календар", "🗓️ Kalendář")}
                </h1>

              </div>

              <div className="mt-1 text-sm capitalize text-gray-500">
                {monthName}
              </div>
            </div>


            <div className="flex flex-wrap items-center gap-2">

              <LanguageSwitcher />

              <button
                type="button"
                onClick={
                  goToPreviousMonth
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:bg-gray-100"
              >
                ←
              </button>

              <button
                type="button"
                onClick={
                  goToJanuary2027
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                {tr("Січень 2027", "Leden 2027")}
              </button>

              <button
                type="button"
                onClick={
                  goToNextMonth
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 hover:bg-gray-100"
              >
                →
              </button>

            </div>

          </div>

        </div>


        {error && (
          <div className="mb-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}


        {/* LEGEND */}

        <div className="mb-3 shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700">

            <span>
              <strong>R</strong> — {tr("рання", "ranní")}
            </span>

            <span>
              <strong>O</strong> — {tr("обідня", "odpolední")}
            </span>

            <span>
              <strong>N</strong> — {tr("нічна", "noční")}
            </span>

            <span>
              <span className="inline-flex rounded bg-yellow-100 px-2 py-0.5 font-semibold">
                D
              </span>{" "}
              {tr("очікує", "čeká")}
            </span>

            <span>
              <span className="inline-flex rounded bg-green-500 px-2 py-0.5 font-semibold">
                D
              </span>{" "}
              {tr("погоджено", "schváleno")}
            </span>

            <span>
              <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 font-semibold">
                {tr("ВИХ", "VOLNO")}
              </span>{" "}
              {tr("вихідний", "volno")}
            </span>

            <span>
              <span className="inline-flex rounded bg-red-100 px-2 py-0.5 font-semibold">
                ★
              </span>{" "}
              {tr("свято", "svátek")}
            </span>

            <span>
              <span className="inline-flex rounded bg-orange-100 px-2 py-0.5 font-semibold">
                {tr("ВХ", "VÍKEND")}
              </span>{" "}
              {tr("вихідний день", "volný den")}
            </span>

            <span>
              <span className="inline-flex rounded border-2 border-red-500 px-1 py-0.5 font-semibold">
                !
              </span>{" "}
              {tr("конфлікт", "konflikt")}
            </span>

            <span className="rounded bg-blue-500 px-2 py-0.5 font-semibold text-blue-950">
              👑 Team Leader
            </span>

          </div>

        </div>


        {/* CALENDAR */}

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          <div className="h-full overflow-auto">

            <table className="border-collapse">

              <thead>
                <tr>

                  <th className="sticky left-0 top-0 z-30 min-w-[210px] border-b border-r border-gray-300 bg-white px-3 py-2 text-left text-sm font-bold text-gray-700">
                    {tr("Працівник", "Zaměstnanec")}
                  </th>

                  {monthDays.map(
                    (dateString) => {
                      const date =
                        parseDate(
                          dateString
                        );

                      const day =
                        date.getDate();

                      const weekday =
                        getWeekdayName(
                          dateString,
                          language
                        );

                      const holiday =
                        holidayMap.get(
                          dateString
                        );

                      const isWeekend =
                        date.getDay() ===
                          0 ||
                        date.getDay() ===
                          6;

                      return (
                        <th
                          key={
                            dateString
                          }
                          title={
                            holiday?.name ??
                            ""
                          }
                          className={`sticky top-0 z-20 min-w-[58px] border-b border-r border-gray-300 px-1 py-2 text-center ${
                            holiday
                              ? "bg-red-100 text-red-800"
                              : isWeekend
                              ? "bg-orange-100 text-orange-800"
                              : "bg-white text-gray-700"
                          }`}
                        >

                          <div className="text-xs font-semibold">
                            {weekday}
                          </div>

                          <div className="text-sm font-bold">
                            {day}
                          </div>

                          {holiday && (
                            <div className="text-xs">
                              ★
                            </div>
                          )}

                        </th>
                      );
                    }
                  )}

                </tr>
              </thead>


              <tbody>

                {sortedEmployees.map(
                  (
                    employee,
                    employeeIndex
                  ) => {

                    const group =
                      getEmployeeGroup(
                        employee
                      );

                    const rowColor =
                      employee.team_leader
                        ? "#bfdbfe"
                        : getGroupColor(
                            group
                          );

                    return (
                      <tr
                        key={
                          employee.id
                        }
                        className="h-[54px]"
                      >

                        {/* EMPLOYEE NAME */}

                        <td
                          className="sticky left-0 z-10 border-b border-r border-gray-300 px-3 py-2"
                          style={{
                            backgroundColor:
                              rowColor,
                          }}
                        >

                          <div className="flex items-center gap-2">

                            {employee.team_leader && (
                              <span
                                className="text-lg"
                                title="Team Leader"
                              >
                                👑
                              </span>
                            )}

                            <div className="min-w-0">

                              <div className="truncate text-sm font-semibold text-gray-900">
                                {
                                  employee.full_name
                                }
                              </div>

                              {employee.team_leader && (
                                <div className="text-[10px] font-bold text-blue-800">
                                  TEAM LEADER
                                </div>
                              )}

                            </div>

                          </div>

                        </td>


                        {/* DAYS */}

                        {monthDays.map(
                          (
                            dateString
                          ) => {

                            const date =
                              parseDate(
                                dateString
                              );

                            const holiday =
                              holidayMap.get(
                                dateString
                              );

                            const isWeekend =
                              date.getDay() ===
                                0 ||
                              date.getDay() ===
                                6;

                            const shift =
                              getShiftForDate(
                                employee,
                                dateString
                              );

                            const workingDay =
                              isWorkingDay(
                                employee,
                                dateString
                              );

                            const dayOff =
                              isDayOffForEmployee(
                                employee,
                                dateString
                              );

                            const vacation =
                              hasVacationOnDate(
                                employee.id,
                                dateString
                              );

                            const conflict =
                              hasConflictForEmployeeDate(
                                employee.id,
                                dateString
                              );

                            const cellHasVacation =
                              !!vacation;

                            let background =
                              rowColor;

                            if (
                              isWeekend
                            ) {
                              background =
                                "#fff7ed";
                            }

                            if (
                              holiday
                            ) {
                              background =
                                "#fee2e2";
                            }

                            if (
                              dayOff &&
                              !cellHasVacation
                            ) {
                              background =
                                "#e5e7eb";
                            }

                            if (
                              vacation
                            ) {
                              if (
                                vacation.status ===
                                "approved"
                              ) {
                                background =
                                  "#22c55e";
                              } else {
                                background =
                                  "#fef3c7";
                              }
                            }

                            return (
                              <td
                                key={
                                  `${employee.id}-${dateString}`
                                }
                                title={
                                  holiday
                                    ? holiday.name
                                    : dayOff
                                    ? `${getShiftName(
                                        shift,
                                        language
                                      )}: ${tr("вихідний", "volno")}`
                                    : vacation
                                    ? vacation.status ===
                                      "approved"
                                      ? tr("Погоджена відпустка", "Schválená dovolená")
                                      : tr("Очікує погодження", "Čeká na schválení")
                                    : ""
                                }
                                className={`border-b border-r border-gray-300 p-1 text-center align-middle ${
                                  conflict &&
                                  vacation
                                    ? "relative"
                                    : ""
                                }`}
                                style={{
                                  backgroundColor:
                                    background,
                                }}
                              >

                                <div
                                  className={`flex h-10 min-w-[50px] items-center justify-center rounded-md ${
                                    conflict &&
                                    vacation
                                      ? "ring-2 ring-inset ring-red-500"
                                      : ""
                                  }`}
                                >

                                  {holiday ? (
                                    <div className="flex flex-col items-center">

                                      <span className="text-sm font-bold text-red-700">
                                        ★
                                      </span>

                                      {vacation && (
                                        <span className="text-[9px] font-bold text-red-700">
                                          D
                                        </span>
                                      )}

                                    </div>
                                  ) : dayOff ? (
                                    <div className="flex flex-col items-center">

                                      <span className="text-[11px] font-bold text-gray-700">
                                        {tr("ВИХ", "VOLNO")}
                                      </span>

                                      {vacation && (
                                        <span
                                          className={`text-[9px] font-bold ${
                                            vacation.status ===
                                            "approved"
                                              ? "text-green-800"
                                              : "text-yellow-700"
                                          }`}
                                        >
                                          D
                                        </span>
                                      )}

                                    </div>
                                  ) : vacation ? (
                                    <div className="flex flex-col items-center">

                                      <span
                                        className={`text-xs font-bold ${
                                          vacation.status ===
                                          "approved"
                                            ? "text-green-800"
                                            : "text-yellow-700"
                                        }`}
                                      >
                                        D
                                      </span>

                                      <span className="text-[9px] font-semibold text-gray-500">
                                        {
                                          getShiftCode(
                                            shift
                                          )
                                        }
                                      </span>

                                    </div>
                                  ) : workingDay ? (
                                    <span className="text-xs font-bold text-gray-700">
                                      {
                                        getShiftCode(
                                          shift
                                        )
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-300">
                                      —
                                    </span>
                                  )}

                                </div>

                              </td>
                            );
                          }
                        )}

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>


        {/* BOTTOM SUMMARY */}

        <div className="mt-3 shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">

            <span>
              {tr("Працівників:", "Zaměstnanci:")}{" "}
              <strong className="text-gray-900">
                {employees.length}
              </strong>
            </span>

            <span>
              {tr("Очікують:", "Čekají:")}{" "}
              <strong className="text-yellow-700">
                {pendingCount}
              </strong>
            </span>

            <span>
              {tr("Погоджено:", "Schváleno:")}{" "}
              <strong className="text-green-800">
                {approvedCount}
              </strong>
            </span>

            <span>
              {tr("Вихідних для змін:", "Volných dnů pro směny:")}{" "}
              <strong className="text-gray-900">
                {daysOff.length}
              </strong>
            </span>

            <span>
              {tr("Свят:", "Svátky:")}{" "}
              <strong className="text-red-700">
                {holidays.length}
              </strong>
            </span>

          </div>

        </div>

      </div>
    </main>
  );
}