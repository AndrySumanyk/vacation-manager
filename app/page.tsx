"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { isWorkingDay, getShiftForDate, type Shift, type ScheduleChange } from "@/lib/schedule";

type Employee = {
  id: string;
  full_name: string;
  schedule_type: number;
  initial_shift: Shift;
  cycle_start_date: string;
  vacation_days_per_year: number;
  team_leader: boolean;
  schedule_changes?: ScheduleChange[];
};

type VacationRequest = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  conflict_override: boolean;
  created_at: string;
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
};

type ConflictRequest = {
  id: string;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  status: string;
};

function calculateDays(
  employee: Employee,
  startDate: string,
  endDate: string,
  holidays: Holiday[],
  daysOff: DayOff[]
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let workingDays = 0;

  const currentDate = new Date(start);

  while (currentDate <= end) {
    const year = currentDate.getFullYear();

    const month = String(
      currentDate.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      currentDate.getDate()
    ).padStart(2, "0");

    const dateString = `${year}-${month}-${day}`;

    const holiday = holidays.some(
      (item) => item.holiday_date === dateString
    );

    const shift = getShiftForDate(
      employee,
      dateString
    );

    const dayOff = daysOff.some(
      (item) =>
        item.day_off_date === dateString &&
        item.shift_type === shift
    );

    if (
      isWorkingDay(employee, dateString) &&
      !holiday &&
      !dayOff
    ) {
      workingDays++;
    }

    currentDate.setDate(
      currentDate.getDate() + 1
    );
  }

  return workingDays;
}

function datesOverlap(
  startDate: string,
  endDate: string,
  otherStartDate: string,
  otherEndDate: string
) {
  return (
    startDate <= otherEndDate &&
    endDate >= otherStartDate
  );
}

export default function Home() {
  const { language } = useLanguage();

  function tr(uk: string, cs: string) {
    return language === "cs" ? cs : uk;
  }

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [requests, setRequests] =
    useState<VacationRequest[]>([]);

  const [holidays, setHolidays] =
    useState<Holiday[]>([]);

  const [daysOff, setDaysOff] =
    useState<DayOff[]>([]);

  const [loadingEmployee, setLoadingEmployee] =
    useState(true);

  const [loadingRequests, setLoadingRequests] =
    useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [checkingConflict, setCheckingConflict] =
    useState(false);

  const [conflicts, setConflicts] =
    useState<ConflictRequest[]>([]);

  const [conflictChecked, setConflictChecked] =
    useState(false);

  useEffect(() => {
    loadCurrentEmployee();
  }, []);

  async function loadCurrentEmployee() {
    setLoadingEmployee(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .select(
        "id, full_name, schedule_type, initial_shift, cycle_start_date, vacation_days_per_year, team_leader"
      )
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .single();

    if (error) {
      console.error(error);

      alert(
        tr("Не вдалося знайти ваш профіль працівника.", "Nepodařilo se najít váš profil zaměstnance.")
      );

      setLoadingEmployee(false);
      return;
    }

    const [scheduleResult, holidaysResult, daysOffResult] =
      await Promise.all([
        supabase
          .from("employee_schedule_changes")
          .select(
            "id, employee_id, effective_date, initial_shift, created_at"
          )
          .eq("employee_id", data.id)
          .order("effective_date", {
            ascending: true,
          }),
        supabase
          .from("holidays")
          .select(
            "id, holiday_date, name, holiday_type"
          )
          .order("holiday_date", {
            ascending: true,
          }),
        supabase
          .from("days_off")
          .select(
            "id, day_off_date, shift_type"
          )
          .order("day_off_date", {
            ascending: true,
          }),
      ]);

    if (scheduleResult.error) {
      console.error(
        "GET SCHEDULE CHANGES ERROR:",
        scheduleResult.error
      );
    }

    if (holidaysResult.error) {
      console.error(
        "GET HOLIDAYS ERROR:",
        holidaysResult.error
      );
    }

    if (daysOffResult.error) {
      console.error(
        "GET DAYS OFF ERROR:",
        daysOffResult.error
      );
    }

    const employeeWithChanges: Employee = {
      ...data,
      schedule_changes:
        (scheduleResult.data ?? []) as ScheduleChange[],
    };

    setEmployee(employeeWithChanges);
    setHolidays(
      (holidaysResult.data ?? []) as Holiday[]
    );
    setDaysOff(
      (daysOffResult.data ?? []) as DayOff[]
    );
    setLoadingEmployee(false);

    await loadVacationRequests(data.id);
  }

  async function loadVacationRequests(
    employeeId: string
  ) {
    setLoadingRequests(true);

    const { data, error } = await supabase
      .from("vacation_requests")
      .select(
        "id, employee_id, start_date, end_date, status, conflict_override, created_at"
      )
      .eq("employee_id", employeeId)
      .order("start_date", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      setLoadingRequests(false);
      return;
    }

    setRequests(data ?? []);
    setLoadingRequests(false);
  }

  async function findConflicts(
    newStartDate: string,
    newEndDate: string
  ) {
    if (
      !employee ||
      !newStartDate ||
      !newEndDate ||
      newStartDate > newEndDate
    ) {
      setConflicts([]);
      setConflictChecked(false);
      return;
    }

    setCheckingConflict(true);
    setConflictChecked(false);

    /*
      Отримуємо заявки інших працівників.
      Враховуємо pending та approved.
      Rejected не створює конфлікту.
    */

    const {
      data: vacationData,
      error: vacationError,
    } = await supabase
      .from("vacation_requests")
      .select(
        "id, employee_id, start_date, end_date, status"
      )
      .neq("employee_id", employee.id)
      .in("status", ["pending", "approved"]);

    if (vacationError) {
      console.error(
        "CHECK VACATION CONFLICT ERROR:",
        vacationError
      );

      setConflicts([]);
      setConflictChecked(false);
      setCheckingConflict(false);

      return;
    }

    const overlappingRequests =
      (vacationData ?? []).filter((request) =>
        datesOverlap(
          newStartDate,
          newEndDate,
          request.start_date,
          request.end_date
        )
      );

    if (overlappingRequests.length === 0) {
      setConflicts([]);
      setConflictChecked(true);
      setCheckingConflict(false);

      return;
    }

    /*
      Отримуємо імена працівників,
      яким належать конфліктні заявки.
    */

    const employeeIds = [
      ...new Set(
        overlappingRequests.map(
          (request) => request.employee_id
        )
      ),
    ];

    const {
      data: employeeData,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select("id, full_name, team_leader")
      .in("id", employeeIds);

    if (employeeError) {
      console.error(
        "GET CONFLICT EMPLOYEES ERROR:",
        employeeError
      );

      setConflicts([]);
      setConflictChecked(false);
      setCheckingConflict(false);

      return;
    }

    const employeeMap = new Map(
      (employeeData ?? []).map((item) => [
        item.id,
        item,
      ])
    );

    const sameCategoryRequests =
      overlappingRequests.filter((request) => {
        const otherEmployee =
          employeeMap.get(request.employee_id);

        if (!otherEmployee) {
          return false;
        }

        return (
          otherEmployee.team_leader ===
          employee.team_leader
        );
      });

    const conflictsWithNames: ConflictRequest[] =
      sameCategoryRequests.map((request) => ({
        id: request.id,
        employee_id: request.employee_id,
        employee_name:
          employeeMap.get(request.employee_id)
            ?.full_name ??
          tr("Невідомий працівник", "Neznámý zaměstnanec"),
        start_date: request.start_date,
        end_date: request.end_date,
        status: request.status,
      }));

    setConflicts(conflictsWithNames);
    setConflictChecked(true);
    setCheckingConflict(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  function openVacationForm() {
    setStartDate("");
    setEndDate("");
    setConflicts([]);
    setConflictChecked(false);
    setShowForm(true);
  }

  async function handleStartDateChange(
    value: string
  ) {
    setStartDate(value);

    if (value && endDate) {
      await findConflicts(value, endDate);
    } else {
      setConflicts([]);
      setConflictChecked(false);
    }
  }

  async function handleEndDateChange(
    value: string
  ) {
    setEndDate(value);

    if (startDate && value) {
      await findConflicts(startDate, value);
    } else {
      setConflicts([]);
      setConflictChecked(false);
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!employee) {
      alert(tr("Працівника не знайдено.", "Zaměstnanec nebyl nalezen."));
      return;
    }

    if (!startDate || !endDate) {
      alert(
        tr("Оберіть дату початку та дату завершення.", "Vyberte datum začátku a datum konce.")
      );
      return;
    }

    if (startDate > endDate) {
      alert(
        tr("Дата початку не може бути пізніше дати завершення.", "Datum začátku nemůže být později než datum konce.")
      );
      return;
    }

    const requestedDays = calculateDays(
      employee,
      startDate,
      endDate,
    holidays,
    daysOff
    );

    setSaving(true);

    /*
      Повторно перевіряємо конфлікт перед збереженням.
      Це захищає від ситуації, коли інший працівник
      подав заявку після першої перевірки.
    */

    const {
      data: conflictData,
      error: conflictError,
    } = await supabase
      .from("vacation_requests")
      .select(
        "id, employee_id, start_date, end_date, status"
      )
      .neq("employee_id", employee.id)
      .in("status", ["pending", "approved"]);

    if (conflictError) {
      console.error(
        "CHECK CONFLICT BEFORE SAVE ERROR:",
        conflictError
      );

      setSaving(false);

      alert(
        tr("Не вдалося перевірити конфлікт дат.\n\nСпробуйте ще раз.", "Nepodařilo se ověřit konflikt termínů.\n\nZkuste to znovu.")
      );

      return;
    }

    const overlappingFinalConflicts =
      (conflictData ?? []).filter((request) =>
        datesOverlap(
          startDate,
          endDate,
          request.start_date,
          request.end_date
        )
      );

    const finalEmployeeIds = [
      ...new Set(
        overlappingFinalConflicts.map(
          (request) => request.employee_id
        )
      ),
    ];

    let finalConflicts =
      overlappingFinalConflicts;

    if (finalEmployeeIds.length > 0) {
      const {
        data: finalEmployeeData,
        error: finalEmployeeError,
      } = await supabase
        .from("employees")
        .select("id, team_leader")
        .in("id", finalEmployeeIds);

      if (finalEmployeeError) {
        console.error(
          "CHECK FINAL CONFLICT EMPLOYEES ERROR:",
          finalEmployeeError
        );

        setSaving(false);

        alert(
          tr("Не вдалося перевірити категорії працівників.\n\nСпробуйте ще раз.", "Nepodařilo se ověřit kategorie zaměstnanců.\n\nZkuste to znovu.")
        );

        return;
      }

      const finalEmployeeMap = new Map(
        (finalEmployeeData ?? []).map((item) => [
          item.id,
          item.team_leader,
        ])
      );

      finalConflicts =
        overlappingFinalConflicts.filter(
          (request) =>
            finalEmployeeMap.get(
              request.employee_id
            ) === employee.team_leader
        );
    }

    const hasConflict =
      finalConflicts.length > 0;

    const { error } = await supabase
      .from("vacation_requests")
      .insert({
        employee_id: employee.id,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        conflict_override: hasConflict,
      });

    setSaving(false);

    if (error) {
      console.error(error);

      alert(
        tr("Не вдалося зберегти заявку.\n\n", "Nepodařilo se uložit žádost.\n\n") +
          error.message
      );

      return;
    }

    if (hasConflict) {
      alert(
        language === "cs"
          ? `Žádost byla úspěšně odeslána!\n\n⚠️ V těchto termínech již existuje ${finalConflicts.length} žádost(i) jiných zaměstnanců.\n\nAdministrátor konflikt uvidí a samostatně rozhodne, zda žádost schválí.\n\nPočet pracovních dnů: ${requestedDays}`
          : `Заявку успішно подано!\n\n⚠️ У ці дати вже є ${finalConflicts.length} заявка(и) інших працівників.\n\nАдміністратор побачить конфлікт і окремо вирішить, чи підтверджувати її.\n\nКількість робочих днів: ${requestedDays}`
      );
    } else {
      alert(
        language === "cs"
          ? `Žádost byla úspěšně odeslána!\n\nNebyly nalezeny žádné konflikty s ostatními zaměstnanci.\n\nPočet pracovních dnů: ${requestedDays}`
          : `Заявку успішно подано!\n\nКонфліктів з іншими працівниками не знайдено.\n\nКількість робочих днів: ${requestedDays}`
      );
    }

    setStartDate("");
    setEndDate("");
    setConflicts([]);
    setConflictChecked(false);
    setShowForm(false);

    await loadVacationRequests(employee.id);
  }

  function getStatusText(status: string) {
    if (status === "pending") {
      return tr("Очікує підтвердження", "Čeká na schválení");
    }

    if (status === "approved") {
      return tr("Підтверджено", "Schváleno");
    }

    if (status === "rejected") {
      return tr("Відхилено", "Zamítnuto");
    }

    return status;
  }

  function getStatusClass(status: string) {
    if (status === "pending") {
      return "bg-orange-100 text-orange-700";
    }

    if (status === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  const usedDays = employee
    ? requests
        .filter(
          (request) =>
            request.status === "approved"
        )
        .reduce(
          (total, request) =>
            total +
            calculateDays(
              employee,
              request.start_date,
              request.end_date,
            holidays,
            daysOff
            ),
          0
        )
    : 0;

  const pendingDays = employee
    ? requests
        .filter(
          (request) =>
            request.status === "pending"
        )
        .reduce(
          (total, request) =>
            total +
            calculateDays(
              employee,
              request.start_date,
              request.end_date,
            holidays,
            daysOff
            ),
          0
        )
    : 0;

  const vacationLimit =
    employee?.vacation_days_per_year ?? 25;

  const availableDays = Math.max(
    vacationLimit - usedDays,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Vacation Manager
            </h1>

            <p className="mt-2 text-gray-600">
              {tr("Планування відпусток команди", "Plánování dovolených týmu")}
            </p>

            <div className="mt-3">
              {loadingEmployee ? (
                <p className="text-sm text-gray-500">
                  {tr("Завантаження профілю...", "Načítání profilu...")}
                </p>
              ) : employee ? (
                <p className="text-sm font-medium text-gray-700">
                  {tr("Ви увійшли як", "Jste přihlášeni jako")}{" "}
                  <span className="text-blue-600">
                    {employee.full_name}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            <LanguageSwitcher />

            <Link
              href="/calendar"
              className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-100"
            >
              📅 {tr("Календар", "Kalendář")}
            </Link>

            {employee?.team_leader && (
              <Link
                href="/admin"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                👑 {tr("Адмін панель", "Administrace")}
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
            >
              {tr("Вийти", "Odhlásit se")}
            </button>

            <button
              onClick={openVacationForm}
              disabled={!employee}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + {tr("Запланувати відпустку", "Naplánovat dovolenou")}
            </button>

          </div>
        </div>

        {/* КАРТКИ */}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-500">
              {tr("Доступно днів відпустки", "Dostupné dny dovolené")}
            </p>

            <p className="mt-2 text-4xl font-bold text-blue-600">
              {availableDays}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {tr("з", "z")} {vacationLimit} {tr("днів на рік", "dnů za rok")}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-500">
              {tr("Очікують підтвердження", "Čekají na schválení")}
            </p>

            <p className="mt-2 text-4xl font-bold text-orange-500">
              {pendingDays}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {tr("робочих днів у заявках", "pracovních dnů v žádostech")}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-500">
              {tr("Використано днів", "Využité dny")}
            </p>

            <p className="mt-2 text-4xl font-bold text-green-500">
              {usedDays}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {tr("робочих днів підтверджено", "schválených pracovních dnů")}
            </p>
          </div>

        </div>

        {/* МОЇ ЗАЯВКИ */}

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">

          <h2 className="text-2xl font-semibold text-gray-900">
            {tr("Мої заявки", "Moje žádosti")}
          </h2>

          {loadingRequests ? (
            <p className="mt-6 text-gray-500">
              {tr("Завантаження заявок...", "Načítání žádostí...")}
            </p>
          ) : requests.length === 0 ? (
            <p className="mt-6 text-gray-500">
              {tr("У вас поки немає заявок на відпустку.", "Zatím nemáte žádné žádosti o dovolenou.")}
            </p>
          ) : (
            <div className="mt-6 space-y-4">

              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-xl border border-gray-200 p-5 md:flex-row md:items-center md:justify-between"
                >

                  <div>
                    <p className="font-semibold text-gray-900">
                      {request.start_date} —{" "}
                      {request.end_date}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Робочих днів:{" "}
                      {employee
                        ? calculateDays(
                            employee,
                            request.start_date,
                            request.end_date,
                          holidays,
                          daysOff
                          )
                        : 0}
                    </p>

                    {request.conflict_override && (
                      <p className="mt-1 text-sm font-medium text-red-600">
                        ⚠️ {tr("Є конфлікт з іншою відпусткою", "Existuje konflikt s jinou dovolenou")}
                      </p>
                    )}
                  </div>

                  <span
                    className={`w-fit rounded-full px-4 py-2 text-sm font-medium ${getStatusClass(
                      request.status
                    )}`}
                  >
                    {getStatusText(
                      request.status
                    )}
                  </span>

                </div>
              ))}

            </div>
          )}

        </div>

        {/* КАЛЕНДАР */}

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                📅 {tr("Календар команди", "Kalendář týmu")}
              </h2>

              <p className="mt-2 max-w-2xl text-gray-500">
                {tr("Переглядайте графік змін усіх працівників,", "Prohlížejte rozpis směn všech zaměstnanců,")}
                {tr("відпустки, вихідні та святкові дні в одному календарі.", "dovolené, volné a sváteční dny v jednom kalendáři.")}
              </p>
            </div>

            <Link
              href="/calendar"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              {tr("Відкрити календар →", "Otevřít kalendář →")}
            </Link>

          </div>

          <div className="mt-8 border-t pt-6">

            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <span>🟩 {tr("Підтверджено", "Schváleno")}</span>
              <span>🟧 {tr("Очікує підтвердження", "Čeká na schválení")}</span>
              <span>⚠️ {tr("Конфлікт", "Konflikt")}</span>
              <span>🟥 {tr("Свято", "Svátek")}</span>
              <span>🟧 {tr("Вихідний", "Volno")}</span>
            </div>

          </div>

        </div>

      </div>

      {/* ФОРМА ВІДПУСТКИ */}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {tr("Запланувати відпустку", "Naplánovat dovolenou")}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Працівник:{" "}
                  {employee?.full_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setConflicts([]);
                  setConflictChecked(false);
                }}
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-5"
            >

              {/* ДАТА ПОЧАТКУ */}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {tr("Дата початку", "Datum začátku")}
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    handleStartDateChange(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  required
                />
              </div>

              {/* ДАТА ЗАВЕРШЕННЯ */}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {tr("Дата завершення", "Datum konce")}
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    handleEndDateChange(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  required
                />
              </div>

              {/* КІЛЬКІСТЬ РОБОЧИХ ДНІВ */}

              {employee &&
                startDate &&
                endDate &&
                startDate <= endDate && (
                  <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                    Кількість робочих днів:{" "}
                    <strong>
                      {calculateDays(
                        employee,
                        startDate,
                        endDate,
                      holidays,
                      daysOff
                      )}
                    </strong>
                  </div>
                )}

              {employee &&
                startDate &&
                endDate &&
                startDate <= endDate && (
                  <>
                    {holidays.filter(
                      (holiday) =>
                        holiday.holiday_date >= startDate &&
                        holiday.holiday_date <= endDate
                    ).length > 0 && (
                      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        <p className="font-semibold">
                          {tr("Святкові дні в періоді:", "Sváteční dny v období:")}
                        </p>

                        <div className="mt-2 space-y-1">
                          {holidays
                            .filter(
                              (holiday) =>
                                holiday.holiday_date >= startDate &&
                                holiday.holiday_date <= endDate
                            )
                            .map((holiday) => (
                              <div key={holiday.id}>
                                {holiday.holiday_date} —{" "}
                                {holiday.name}
                              </div>
                            ))}
                        </div>

                        <p className="mt-2">
                          {tr("Святкові дні не віднімаються з відпустки.", "Sváteční dny se do dovolené nezapočítávají.")}
                        </p>
                      </div>
                    )}

                    {daysOff.filter(
                      (dayOff) =>
                        dayOff.day_off_date >= startDate &&
                        dayOff.day_off_date <= endDate
                    ).length > 0 && (
                      <div className="rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
                        <p className="font-semibold">
                          {tr("Вихідні для зміни в періоді:", "Volné dny pro směnu v období:")}
                        </p>

                        <div className="mt-2 space-y-1">
                          {daysOff
                            .filter(
                              (dayOff) =>
                                dayOff.day_off_date >= startDate &&
                                dayOff.day_off_date <= endDate
                            )
                            .map((dayOff) => (
                              <div key={dayOff.id}>
                                {dayOff.day_off_date} —{" "}
                                {dayOff.shift_type === "early"
                                  ? `R — ${tr("Рання", "Ranní")}`
                                  : dayOff.shift_type === "day"
                                  ? `O — ${tr("Обідня", "Odpolední")}`
                                  : `N — ${tr("Нічна", "Noční")}`}
                              </div>
                            ))}
                        </div>

                        <p className="mt-2">
                          {tr("Вихідні для вашої зміни не рахуються як дні відпустки.", "Volné dny pro vaši směnu se nepočítají jako dny dovolené.")}
                        </p>
                      </div>
                    )}
                  </>
                )}

              {/* ПЕРЕВІРКА КОНФЛІКТУ */}

              {checkingConflict && (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  🔎 {tr("Перевіряємо конфлікт дат...", "Ověřujeme konflikt termínů...")}
                </div>
              )}

              {/* Є КОНФЛІКТ */}

              {!checkingConflict &&
                conflictChecked &&
                conflicts.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                    <p className="font-semibold text-red-700">
                      ⚠️ {tr("Увага: можливий конфлікт", "Pozor: možný konflikt")}
                    </p>

                    <p className="mt-2 text-sm text-red-600">
                      {tr("На вибрані дати вже запланована", "Na vybrané termíny je již naplánována")}
                      {tr("відпустka іншого працівника:", "dovolená jiného zaměstnance:")}
                    </p>

                    <div className="mt-3 space-y-2">

                      {conflicts.map((conflict) => (
                        <div
                          key={conflict.id}
                          className="rounded-lg bg-white p-3 text-sm"
                        >

                          <p className="font-semibold text-red-700">
                            {conflict.employee_name}
                          </p>

                          <p className="mt-1 text-red-600">
                            {conflict.start_date} —{" "}
                            {conflict.end_date}
                          </p>

                          <p className="mt-1 text-sm text-red-500">
                            {conflict.status ===
                            "approved"
                              ? tr("Підтверджено", "Schváleno")
                              : tr("Очікує підтвердження", "Čeká na schválení")}
                          </p>

                        </div>
                      ))}

                    </div>

                    <p className="mt-3 text-sm font-medium text-red-700">
                      {tr("Заявку все одно можна подати.", "Žádost lze přesto odeslat.")}
                      {" "}
                      {tr("Адміністратор вирішить, чи підтверджувати її.", "Administrátor rozhodne, zda ji schválí.")}
                    </p>

                  </div>
                )}

              {/* КОНФЛІКТІВ НЕМАЄ */}

              {!checkingConflict &&
                conflictChecked &&
                conflicts.length === 0 && (
                  <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                    {tr("✅ Конфліктів з іншими працівниками не знайдено.", "✅ Nebyly nalezeny konflikty s ostatními zaměstnanci.")}
                  </div>
                )}

              {/* КНОПКИ */}

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setConflicts([]);
                    setConflictChecked(false);
                  }}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold hover:bg-gray-100"
                >
                  {tr("Скасувати", "Zrušit")}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? tr("Збереження...", "Ukládání...")
                    : tr("Запланувати", "Naplánovat")}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </main>
  );
}