"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { getCurrentEmployee } from "@/lib/auth";
import { isWorkingDay, getShiftForDate, type ScheduleChange } from "@/lib/schedule";

type Employee = {
  id: string;
  full_name: string;
  schedule_type: number;
  initial_shift: "early" | "day" | "night";
  cycle_start_date: string;
  team_leader: boolean;
  active: boolean;
  schedule_changes: ScheduleChange[];
};

type VacationRequest = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
  conflict_override: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Holiday = {
  holiday_date: string;
  name: string;
};

type DayOff = {
  day_off_date: string;
  shift_type: "early" | "day" | "night";
};

type FilterStatus =
  | "all"
  | "pending"
  | "approved"
  | "rejected";

function formatDate(dateString: string) {
  const [year, month, day] =
    dateString.split("-");

  return `${day}.${month}.${year}`;
}

function formatDateTime(
  dateString: string,
  language: "uk" | "cs"
) {
  return new Date(
    dateString
  ).toLocaleString(language === "uk" ? "uk-UA" : "cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  return (
    firstStart <= secondEnd &&
    secondStart <= firstEnd
  );
}

function calculateWorkingDays(
  employee: Employee,
  startDate: string,
  endDate: string,
  holidays: Holiday[],
  daysOff: DayOff[]
) {
  const holidaySet = new Set(
    holidays.map((holiday) => holiday.holiday_date)
  );

  const startParts = startDate.split("-").map(Number);
  const endParts = endDate.split("-").map(Number);

  const current = new Date(
    startParts[0],
    startParts[1] - 1,
    startParts[2]
  );

  const end = new Date(
    endParts[0],
    endParts[1] - 1,
    endParts[2]
  );

  let count = 0;

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    const shift = getShiftForDate(employee, dateString);
    const dayOfWeek = current.getDay();

    // Нічна зміна: неділя–четвер = 5 робочих днів.
    // Рання та обідня: понеділок–п'ятниця = 5 робочих днів.
    const worksThisDay =
      shift === "night"
        ? dayOfWeek >= 0 && dayOfWeek <= 4
        : dayOfWeek >= 1 && dayOfWeek <= 5;

    const isDayOff = daysOff.some(
      (dayOff) =>
        dayOff.day_off_date === dateString &&
        dayOff.shift_type === shift
    );

    if (
      worksThisDay &&
      !holidaySet.has(dateString) &&
      !isDayOff
    ) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

export default function AdminVacationsPage() {
  const { language } = useLanguage();

  const tr = (uk: string, cs: string) =>
    language === "uk" ? uk : cs;

  const [currentEmployee, setCurrentEmployee] =
    useState<any>(null);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [requests, setRequests] =
    useState<VacationRequest[]>([]);

  const [holidays, setHolidays] =
    useState<Holiday[]>([]);

  const [daysOff, setDaysOff] =
    useState<DayOff[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [filter, setFilter] =
    useState<FilterStatus>(
      "pending"
    );

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const employee =
        await getCurrentEmployee();

      if (!employee) {
        window.location.href =
          "/login";
        return;
      }

      if (
        employee.role !==
        "admin"
      ) {
        setError(
          tr("Доступ дозволено тільки адміністраторам.", "Přístup je povolen pouze administrátorům.")
        );

        setLoading(false);
        return;
      }

      setCurrentEmployee(
        employee
      );

      const [
        employeesResult,
        requestsResult,
        holidaysResult,
        scheduleChangesResult,
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
              team_leader,
              active
            `
          )
          .order(
            "full_name"
          ),

        supabase
          .from(
            "vacation_requests"
          )
          .select(
            `
              id,
              employee_id,
              start_date,
              end_date,
              status,
              conflict_override,
              reviewed_by,
              reviewed_at,
              created_at
            `
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          ),

        supabase
          .from("holidays")
          .select(
            "holiday_date, name"
          )
          .order(
            "holiday_date"
          ),

        supabase
          .from("employee_schedule_changes")
          .select(
            "id, employee_id, effective_date, initial_shift, created_at"
          )
          .order(
            "effective_date",
            { ascending: true }
          ),

        supabase
          .from("days_off")
          .select(
            "day_off_date, shift_type"
          )
          .order(
            "day_off_date",
            { ascending: true }
          ),
      ]);

      if (
        employeesResult.error
      ) {
        throw employeesResult.error;
      }

      if (
        requestsResult.error
      ) {
        throw requestsResult.error;
      }

      if (
        holidaysResult.error
      ) {
        throw holidaysResult.error;
      }

      if (
        scheduleChangesResult.error
      ) {
        throw scheduleChangesResult.error;
      }

      if (
        daysOffResult.error
      ) {
        throw daysOffResult.error;
      }

      const scheduleChangesByEmployee =
        new Map<string, ScheduleChange[]>();

      for (
        const change of
          scheduleChangesResult.data ?? []
      ) {
        const existing =
          scheduleChangesByEmployee.get(
            change.employee_id
          ) ?? [];

        existing.push(change);
        scheduleChangesByEmployee.set(
          change.employee_id,
          existing
        );
      }

      const employeesWithSchedules =
        (employeesResult.data ?? []).map(
          (employee) => ({
            ...employee,
            schedule_changes:
              scheduleChangesByEmployee.get(
                employee.id
              ) ?? [],
          })
        );

      setEmployees(
        employeesWithSchedules
      );

      setRequests(
        requestsResult.data ??
          []
      );

      setHolidays(
        holidaysResult.data ??
          []
      );

      setDaysOff(
        daysOffResult.data ??
          []
      );
    } catch (err) {
      console.error(
        "ADMIN VACATIONS LOAD ERROR:",
        err
      );

      setError(
        tr("Не вдалося завантажити заявки на відпустку.", "Nepodařilo se načíst žádosti o dovolenou.")
      );
    } finally {
      setLoading(false);
    }
  }

  const employeeMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          Employee
        >();

      for (
        const employee of employees
      ) {
        map.set(
          employee.id,
          employee
        );
      }

      return map;
    }, [employees]);

  /*
    ВАЖЛИВО:

    Для конфлікту враховуємо
    тільки pending та approved.

    REJECTED повністю ігнорується.

    Тому якщо:

    А = approved
    Б = rejected

    конфлікту більше НЕМАЄ.
  */

  function getConflictsForRequest(
    request: VacationRequest
  ) {
    const employee =
      employeeMap.get(
        request.employee_id
      );

    if (!employee) {
      return [];
    }

    return requests.filter(
      (otherRequest) => {
        if (
          otherRequest.id ===
          request.id
        ) {
          return false;
        }

        /*
          Відхилені заявки
          взагалі не беруть
          участі у конфліктах.
        */

        if (
          otherRequest.status ===
          "rejected"
        ) {
          return false;
        }

        /*
          Заявка має бути
          pending або approved.
        */

        if (
          otherRequest.status !==
            "pending" &&
          otherRequest.status !==
            "approved"
        ) {
          return false;
        }

        const otherEmployee =
          employeeMap.get(
            otherRequest.employee_id
          );

        if (!otherEmployee) {
          return false;
        }

        /*
          Team Leader конфліктує
          тільки з Team Leader.

          Звичайний працівник —
          тільки зі звичайним.
        */

        if (
          employee.team_leader !==
          otherEmployee.team_leader
        ) {
          return false;
        }

        return rangesOverlap(
          request.start_date,
          request.end_date,
          otherRequest.start_date,
          otherRequest.end_date
        );
      }
    );
  }

  /*
    Окремо визначаємо,
    чи є конфлікт ПРЯМО ЗАРАЗ.

    Це важливо:

    conflict_override === true
    сам по собі НЕ означає,
    що конфлікт ще існує.

    Якщо другу заявку
    відхилили — конфлікту немає.
  */

  function hasActiveConflict(
    request: VacationRequest
  ) {
    return (
      getConflictsForRequest(
        request
      ).length > 0
    );
  }

  const filteredRequests =
    useMemo(() => {
      if (
        filter === "all"
      ) {
        return requests;
      }

      return requests.filter(
        (request) =>
          request.status ===
          filter
      );
    }, [
      requests,
      filter,
    ]);

  const pendingCount =
    requests.filter(
      (request) =>
        request.status ===
        "pending"
    ).length;

  const approvedCount =
    requests.filter(
      (request) =>
        request.status ===
        "approved"
    ).length;

  const rejectedCount =
    requests.filter(
      (request) =>
        request.status ===
        "rejected"
    ).length;

  const oldestPending =
    requests
      .filter(
        (request) =>
          request.status ===
          "pending"
      )
      .sort((a, b) =>
        a.created_at.localeCompare(
          b.created_at
        )
      )[0];

  async function updateRequestStatus(
    request: VacationRequest,
    newStatus:
      | "approved"
      | "rejected"
  ) {
    setError("");
    setSuccess("");

    const employee =
      employeeMap.get(
        request.employee_id
      );

    if (!employee) {
      setError(
        tr("Працівника для цієї заявки не знайдено.", "Zaměstnance pro tuto žádost se nepodařilo najít.")
      );
      return;
    }

    const conflicts =
      getConflictsForRequest(
        request
      );

    const hasConflict =
      conflicts.length > 0;

    /*
      Якщо підтверджуємо заявку
      при реальному конфлікті —
      обов'язково попереджаємо.
    */

    if (
      newStatus ===
        "approved" &&
      hasConflict
    ) {
      const conflictNames =
        conflicts
          .map((conflict) => {
            const conflictEmployee =
              employeeMap.get(
                conflict.employee_id
              );

            return (
              conflictEmployee
                ?.full_name ??
              tr("Невідомий працівник", "Neznámý zaměstnanec")
            );
          })
          .join(", ");

      const confirmed =
        window.confirm(
          `⚠️ ${tr("Увага!", "Pozor!")}\n\n` +
            `${tr("У працівника", "Zaměstnanec")} "${employee.full_name}" ${tr("є конфлікт відпустки.", "má konflikt dovolené.")}\n\n` +
            `${tr("Конфлікт із:", "Konflikt s:")} ${conflictNames}\n\n` +
            `${tr("Ви все одно хочете підтвердити цю відпустку?", "Přesto chcete tuto dovolenou schválit?")}`
        );

      if (!confirmed) {
        return;
      }
    }

    const confirmedAction =
      window.confirm(
        newStatus ===
          "approved"
          ? `${tr("Підтвердити відпустку працівника", "Schválit dovolenou zaměstnance")} "${employee.full_name}"?`
          : `${tr("Відхилити відпустку працівника", "Zamítnout dovolenou zaměstnance")} "${employee.full_name}"?`
      );

    if (!confirmedAction) {
      return;
    }

    setProcessingId(
      request.id
    );

    try {
      /*
        КЛЮЧОВА ЗМІНА:

        Якщо заявку відхиляємо,
        conflict_override = false.

        Таким чином стара
        інформація "підтверджено
        попри конфлікт" не
        залишається в базі.
      */

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          tr("Сесія завершилася.", "Relace vypršela.")
        );
      }

      const updateData =
        newStatus ===
        "rejected"
          ? {
              status:
                "rejected",
              conflict_override:
                false,
              reviewed_by:
                user.id,
              reviewed_at:
                new Date().toISOString(),
            }
          : {
              status:
                "approved",
              conflict_override:
                hasConflict,
              reviewed_by:
                user.id,
              reviewed_at:
                new Date().toISOString(),
            };

      const {
        error: updateError,
      } = await supabase
        .from(
          "vacation_requests"
        )
        .update(
          updateData
        )
        .eq(
          "id",
          request.id
        );

      if (updateError) {
        throw updateError;
      }

      /*
        Після зміни статусу
        повністю перезавантажуємо
        заявки.

        Це гарантує, що після
        відхилення конфліктної
        заявки у іншої заявки
        одразу перераховується
        актуальний конфлікт.
      */

      await loadData();

      setSuccess(
        newStatus ===
          "approved"
          ? `${tr("Відпустку працівника", "Dovolená zaměstnance")} "${employee.full_name}" ${tr("підтверджено.", "byla schválena.")}`
          : `${tr("Відпустку працівника", "Dovolená zaměstnance")} "${employee.full_name}" ${tr("відхилено.", "byla zamítnuta.")}`
      );
    } catch (err) {
      console.error(
        "UPDATE VACATION ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : tr("Не вдалося змінити статус відпустки.", "Nepodařilo se změnit stav dovolené.")
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-gray-500">
            {tr("Завантаження заявок...", "Načítání žádostí...")}
          </p>
        </div>
      </main>
    );
  }

  if (
    currentEmployee &&
    currentEmployee.role !==
      "admin"
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-600">
            {tr("Доступ заборонено", "Přístup zamítnut")}
          </h1>

          <p className="mt-3 text-gray-600">
            {tr(
              "Ця сторінка доступна тільки адміністраторам.",
              "Tato stránka je dostupná pouze administrátorům."
            )}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
          >
            {tr("На головну", "Na hlavní stránku")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tr("🏖️ Відпустки", "🏖️ Dovolené")}
              </h1>

              <p className="mt-2 text-gray-600">
                {tr(
                  "Перевірка та підтвердження заявок працівників",
                  "Kontrola a schvalování žádostí zaměstnanců"
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />

              <Link
              href="/admin"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center font-semibold text-gray-700 hover:bg-gray-100"
            >
              {tr("← Адмін панель", "← Administrace")}
            </Link>
            </div>
          </div>

          {/* STATISTICS */}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <button
              onClick={() =>
                setFilter("all")
              }
              className={`rounded-xl p-5 text-left ${
                filter === "all"
                  ? "ring-2 ring-blue-500"
                  : ""
              } bg-blue-50`}
            >
              <p className="text-sm text-blue-600">
{tr("Усього заявок", "Celkem žádostí")}
              </p>

              <p className="mt-1 text-3xl font-bold text-blue-800">
                {requests.length}
              </p>
            </button>

            <button
              onClick={() =>
                setFilter("pending")
              }
              className={`rounded-xl p-5 text-left ${
                filter ===
                "pending"
                  ? "ring-2 ring-yellow-500"
                  : ""
              } bg-yellow-50`}
            >
              <p className="text-sm text-yellow-700">
{tr("Очікують", "Čekají")}
              </p>

              <p className="mt-1 text-3xl font-bold text-yellow-800">
                {pendingCount}
              </p>
            </button>

            <button
              onClick={() =>
                setFilter("approved")
              }
              className={`rounded-xl p-5 text-left ${
                filter ===
                "approved"
                  ? "ring-2 ring-green-500"
                  : ""
              } bg-green-50`}
            >
              <p className="text-sm text-green-700">
{tr("Підтверджені", "Schválené")}
              </p>

              <p className="mt-1 text-3xl font-bold text-green-800">
                {approvedCount}
              </p>
            </button>

            <button
              onClick={() =>
                setFilter("rejected")
              }
              className={`rounded-xl p-5 text-left ${
                filter ===
                "rejected"
                  ? "ring-2 ring-red-500"
                  : ""
              } bg-red-50`}
            >
              <p className="text-sm text-red-700">
{tr("Відхилені", "Zamítnuté")}
              </p>

              <p className="mt-1 text-3xl font-bold text-red-800">
                {rejectedCount}
              </p>
            </button>
          </div>

          {/* MESSAGES */}

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
              {success}
            </div>
          )}

          {/* PRIORITY */}

          {oldestPending && (
            <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="font-bold text-yellow-800">
                {tr("🥇 Найстаріша заявка", "🥇 Nejstarší žádost")}
              </div>

              <p className="mt-1 text-sm text-yellow-700">
                {tr("Byla podána", "Byla podána")}{" "}
                {formatDateTime(
                  oldestPending.created_at,
                  language
                )}
              </p>
            </div>
          )}

          {/* FILTERS */}

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                [
                  "all",
                  tr("Усі", "Vše"),
                ],
                [
                  "pending",
                  tr("Очікують", "Čekají"),
                ],
                [
                  "approved",
                  tr("Підтверджені", "Schválené"),
                ],
                [
                  "rejected",
                  tr("Відхилені", "Zamítnuté"),
                ],
              ] as [
                FilterStatus,
                string
              ][]
            ).map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={value}
                  onClick={() =>
                    setFilter(
                      value
                    )
                  }
                  className={`rounded-xl px-4 py-2 font-semibold ${
                    filter ===
                    value
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {/* REQUESTS */}

        <div className="mt-6 space-y-4">
          {filteredRequests.length ===
          0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
              {tr(
                "Немає заявок у цій категорії.",
                "V této kategorii nejsou žádné žádosti."
              )}
            </div>
          ) : (
            filteredRequests.map(
              (
                request,
                index
              ) => {
                const employee =
                  employeeMap.get(
                    request.employee_id
                  );

                if (
                  !employee
                ) {
                  return null;
                }

                const conflicts =
                  getConflictsForRequest(
                    request
                  );

                const hasConflict =
                  conflicts.length >
                  0;

                /*
                  conflict_override
                  показуємо ТІЛЬКИ,
                  якщо конфлікт реально
                  існує зараз.

                  Якщо друга заявка
                  стала rejected —
                  hasConflict = false,
                  тому напис зникає.
                */

                const approvedDespiteConflict =
                  request.status ===
                    "approved" &&
                  request.conflict_override &&
                  hasConflict;

                const workingDays =
                  calculateWorkingDays(
                    employee,
                    request.start_date,
                    request.end_date,
                    holidays,
                    daysOff
                  );

                return (
                  <div
                    key={
                      request.id
                    }
                    className={`rounded-2xl border bg-white p-6 shadow-sm ${
                      hasConflict
                        ? "border-red-300"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      {/* INFO */}

                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-bold text-gray-900">
                            {
                              employee.full_name
                            }
                          </h2>

                          {employee.team_leader && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                              👑 TEAM
                              LEADER
                            </span>
                          )}

                          {request.status ===
                            "pending" && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                              {tr("Очікує", "Čeká")}
                            </span>
                          )}

                          {request.status ===
                            "approved" && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                              {tr("Підтверджено", "Schváleno")}
                            </span>
                          )}

                          {request.status ===
                            "rejected" && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                              {tr("Відхилено", "Zamítnuto")}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-gray-50 p-4">
                            <p className="text-xs text-gray-500">
                              {tr("Початок", "Začátek")}
                            </p>

                            <p className="mt-1 font-bold text-gray-900">
                              {formatDate(
                                request.start_date
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-gray-50 p-4">
                            <p className="text-xs text-gray-500">
                              {tr("Кінець", "Konec")}
                            </p>

                            <p className="mt-1 font-bold text-gray-900">
                              {formatDate(
                                request.end_date
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-gray-50 p-4">
                            <p className="text-xs text-gray-500">
                              {tr("Робочих", "Pracovních")}
                              {" "}
                              {tr("днів", "dnů")}
                            </p>

                            <p className="mt-1 font-bold text-gray-900">
                              {
                                workingDays
                              }
                            </p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm text-gray-500">
                          {tr("Заявку подано:", "Žádost podána:")} {" "}
                          <strong>
                            {formatDateTime(
                                request.created_at,
                                language
                              )}
                          </strong>
                        </p>

                        {request.reviewed_at && (
                          <p className="mt-1 text-sm text-gray-500">
                            {tr("Розглянуто:", "Posouzeno:")} {" "}
                            <strong>
                              {formatDateTime(
                                request.reviewed_at,
                                language
                              )}
                            </strong>
                          </p>
                        )}

                        {/* CONFLICT */}

                        {hasConflict && (
                          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="font-bold text-red-800">
                              {tr("⚠️ Є конфлікт", "⚠️ Existuje konflikt")}
                            </div>

                            <div className="mt-2 space-y-1 text-sm text-red-700">
                              {conflicts.map(
                                (
                                  conflict
                                ) => {
                                  const conflictEmployee =
                                    employeeMap.get(
                                      conflict.employee_id
                                    );

                                  if (
                                    !conflictEmployee
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={
                                        conflict.id
                                      }
                                    >
                                      •{" "}
                                      {
                                        conflictEmployee.full_name
                                      }{" "}
                                      —{" "}
                                      {formatDate(
                                        conflict.start_date
                                      )}{" "}
                                      –{" "}
                                      {formatDate(
                                        conflict.end_date
                                      )}{" "}
                                      (
                                      {
                                        conflict.status ===
                                        "approved"
                                          ? tr("підтверджена", "schválena")
                                          : tr("очікує", "čeká")
                                      }
                                      )
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        {/* APPROVED DESPITE CONFLICT */}

                        {approvedDespiteConflict && (
                          <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
                            <div className="font-bold text-orange-800">
                              {tr("⚠️ Підтверджено попри конфлікт", "⚠️ Schváleno navzdory konfliktu")}
                            </div>

                            <p className="mt-1 text-sm text-orange-700">
                              {tr(
                                "Адміністратор свідомо підтвердив цю відпустку, незважаючи на конфлікт.",
                                "Administrátor tuto dovolenou vědomě schválil navzdory konfliktu."
                              )}
                            </p>
                          </div>
                        )}

                        {/* IMPORTANT */}

                        {request.status ===
                          "approved" &&
                          request.conflict_override &&
                          !hasConflict && (
                            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                              <div className="font-semibold text-green-800">
                                {tr("✓ Конфлікту більше немає", "✓ Konflikt již není")}
                              </div>

                              <p className="mt-1 text-sm text-green-700">
                                {tr(
                                  "Інша конфліктна заявка була відхилена, тому ця відпустка зараз не має конфлікту.",
                                  "Jiná konfliktní žádost byla zamítnuta, takže tato dovolená nyní nemá konflikt."
                                )}
                              </p>
                            </div>
                          )}
                      </div>

                      {/* ACTIONS */}

                      <div className="flex shrink-0 flex-col gap-2 lg:w-48">
                        {request.status ===
                          "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={
                                processingId ===
                                request.id
                              }
                              onClick={() =>
                                updateRequestStatus(
                                  request,
                                  "approved"
                                )
                              }
                              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {processingId ===
                              request.id
                                ? tr("Обробка...", "Zpracování...")
                                : tr("✓ Підтвердити", "✓ Schválit")}
                            </button>

                            <button
                              type="button"
                              disabled={
                                processingId ===
                                request.id
                              }
                              onClick={() =>
                                updateRequestStatus(
                                  request,
                                  "rejected"
                                )
                              }
                              className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {processingId ===
                              request.id
                                ? tr("Обробка...", "Zpracování...")
                                : tr("✕ Відхилити", "✕ Zamítnout")}
                            </button>
                          </>
                        )}

                        {request.status ===
                          "approved" && (
                          <div className="rounded-xl bg-green-50 p-4 text-center">
                            <div className="font-bold text-green-800">
                              {tr("✓ Підтверджено", "✓ Schváleno")}
                            </div>

                            {approvedDespiteConflict && (
                              <div className="mt-1 text-xs text-orange-700">
                                {tr("Navzdory konfliktu", "Navzdory konfliktu")}
                              </div>
                            )}
                          </div>
                        )}

                        {request.status ===
                          "rejected" && (
                          <div className="rounded-xl bg-red-50 p-4 text-center">
                            <div className="font-bold text-red-800">
                              {tr("✕ Відхилено", "✕ Zamítnuto")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* RULE */}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-900">
            {tr("Правило конфліктів", "Pravidlo konfliktů")}
          </h3>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="font-semibold">
                👑 Team Leader
              </div>

              <p className="mt-1 text-sm text-gray-600">
                {tr(
                  "Конфліктує тільки з іншим Team Leader.",
                  "Konfliktuje pouze s jiným Team Leaderem."
                )}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="font-semibold">
                {tr("👤 Звичайний працівник", "👤 Běžný zaměstnanec")}
              </div>

              <p className="mt-1 text-sm text-gray-600">
                {tr(
                  "Конфліктує тільки з іншим звичайним працівником.",
                  "Konfliktuje pouze s jiným běžným zaměstnancem."
                )}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="font-semibold">
                {tr("🚫 Відхилена заявка", "🚫 Zamítnutá žádost")}
              </div>

              <p className="mt-1 text-sm text-gray-600">
                {tr(
                  "Взагалі не враховується при визначенні конфліктів.",
                  "Vůbec se nezohledňuje při určování konfliktů."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}