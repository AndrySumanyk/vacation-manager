"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

type Shift = "early" | "day" | "night";

type ScheduleChange = {
  id: string;
  employee_id: string;
  effective_date: string;
  initial_shift: Shift;
  created_at: string;
};

type Employee = {
  id: string;
  full_name: string;
  schedule_type: number;
  initial_shift: "early" | "day" | "night";
  cycle_start_date: string;
  vacation_days_per_year: number;
  active: boolean;
  role: string;
  auth_user_id: string | null;
  team_leader: boolean;
};

export default function EmployeesPage() {
  const { language } = useLanguage();

  const tr = (uk: string, cs: string) =>
    language === "uk" ? uk : cs;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [scheduleType, setScheduleType] =
    useState("2");

  const [initialShift, setInitialShift] =
    useState<"early" | "day" | "night">("early");

  const [cycleStartDate, setCycleStartDate] =
    useState("2027-01-04");

  const [vacationDays, setVacationDays] =
    useState("25");

  const [teamLeader, setTeamLeader] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);

  const [editFullName, setEditFullName] =
    useState("");

  const [editScheduleType, setEditScheduleType] =
    useState("2");

  const [editInitialShift, setEditInitialShift] =
    useState<"early" | "day" | "night">("early");

  const [editCycleStartDate, setEditCycleStartDate] =
    useState("2027-01-04");

  const [editVacationDays, setEditVacationDays] =
    useState("25");

  const [editTeamLeader, setEditTeamLeader] =
    useState(false);

  const [scheduleChanges, setScheduleChanges] =
    useState<ScheduleChange[]>([]);

  const [newChangeDate, setNewChangeDate] =
    useState("");

  const [newChangeShift, setNewChangeShift] =
    useState<Shift>("early");

  const [scheduleChangesLoading, setScheduleChangesLoading] =
    useState(false);

  const [accessEmployee, setAccessEmployee] =
    useState<Employee | null>(null);

  const [accessLogin, setAccessLogin] =
    useState("");

  const [accessPassword, setAccessPassword] =
    useState("");

  const [accessSaving, setAccessSaving] =
    useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);
    setError("");

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const {
      data: currentEmployee,
      error: currentEmployeeError,
    } = await supabase
      .from("employees")
      .select(
        "id, full_name, role, active"
      )
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .single();

    if (
      currentEmployeeError ||
      !currentEmployee
    ) {
      setError(
        tr("Не вдалося перевірити ваш профіль.", "Nepodařilo se ověřit váš profil.")
      );
      setLoading(false);
      return;
    }

    if (currentEmployee.role !== "admin") {
      setError(
        tr("Доступ дозволено тільки адміністраторам.", "Přístup je povolen pouze administrátorům.")
      );
      setLoading(false);
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("employees")
      .select(
        "id, full_name, schedule_type, initial_shift, cycle_start_date, vacation_days_per_year, active, role, auth_user_id, team_leader"
      )
      .order("full_name");

    if (error) {
      console.error(error);

      setError(
        tr("Не вдалося завантажити працівників.", "Nepodařilo se načíst zaměstnance.")
      );

      setLoading(false);
      return;
    }

    setEmployees(data ?? []);
    setLoading(false);
  }

  function makeLogin(fullName: string) {
    return fullName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");
  }

  function openAccessForm(employee: Employee) {
    setAccessEmployee(employee);
    setAccessLogin(makeLogin(employee.full_name));
    setAccessPassword("");
    setError("");
    setSuccess("");
  }

  function closeAccessForm() {
    setAccessEmployee(null);
    setAccessLogin("");
    setAccessPassword("");
  }

  async function handleCreateAccess() {
    if (!accessEmployee) return;

    setError("");
    setSuccess("");

    const cleanLogin = accessLogin.trim().toLowerCase();

    if (!cleanLogin) {
      setError("Введіть логін.");
      return;
    }

    if (!accessPassword) {
      setError("Введіть пароль.");
      return;
    }

    if (accessPassword.length < 6) {
      setError("Пароль має містити щонайменше 6 символів.");
      return;
    }

    setAccessSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Сесія завершилася. Увійдіть у систему ще раз.");
        setAccessSaving(false);
        return;
      }

      const response = await fetch("/api/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          login: cleanLogin,
          password: accessPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || tr("Не вдалося створити доступ.", "Nepodařilo se vytvořit přístup."));
        setAccessSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("employees")
        .update({
          auth_user_id: result.userId,
        })
        .eq("id", accessEmployee.id);

      if (updateError) {
        console.error(updateError);
        setError(
          "Обліковий запис створено, але не вдалося прив'язати його до працівника: " +
            updateError.message
        );
        setAccessSaving(false);
        return;
      }

      setEmployees((current) =>
        current.map((employee) =>
          employee.id === accessEmployee.id
            ? { ...employee, auth_user_id: result.userId }
            : employee
        )
      );

      setSuccess(
        tr(
          `Доступ для ${accessEmployee.full_name} створено. Логін: ${cleanLogin}`,
          `Přístup pro ${accessEmployee.full_name} byl vytvořen. Login: ${cleanLogin}`
        )
      );

      closeAccessForm();
    } catch (error) {
      console.error(error);
      setError(tr("Сталася помилка під час створення доступу.", "Při vytváření přístupu došlo k chybě."));
    } finally {
      setAccessSaving(false);
    }
  }

  async function handleAddEmployee(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanName =
      fullName.trim();

    const cleanLogin =
      login.trim().toLowerCase();

    if (!cleanName) {
      setError(
        "Введіть ім'я працівника."
      );
      return;
    }

    if (!cleanLogin) {
      setError(
        "Введіть логін."
      );
      return;
    }

    if (!password) {
      setError(
        "Введіть пароль."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Пароль має містити щонайменше 6 символів."
      );
      return;
    }

    setSaving(true);

    try {
      /*
        Отримуємо поточну сесію
        адміністратора.
      */

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "Сесія завершилася. Увійдіть у систему ще раз."
        );

        setSaving(false);
        return;
      }

      /*
        Передаємо токен на сервер.
      */

      const response =
        await fetch(
          "/api/create-user",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              login: cleanLogin,
              password,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            tr("Не вдалося створити обліковий запис.", "Nepodařilo se vytvořit účet.")
        );

        setSaving(false);
        return;
      }

      const authUserId =
        result.userId;

      /*
        Створюємо працівника
        у таблиці employees.
      */

      const {
        error: employeeError,
      } = await supabase
        .from("employees")
        .insert({
          full_name: cleanName,

          schedule_type:
            Number(scheduleType),

          initial_shift:
            initialShift,

          cycle_start_date:
            cycleStartDate,

          vacation_days_per_year:
            Number(vacationDays),

          active: true,

          role: "employee",

          auth_user_id:
            authUserId,

          team_leader:
            teamLeader,
        });

      if (employeeError) {
        console.error(
          employeeError
        );

        setError(
          "Обліковий запис створено, але не вдалося створити працівника: " +
            employeeError.message
        );

        setSaving(false);
        return;
      }

      /*
        Очищаємо форму.
      */

      setFullName("");
      setLogin("");
      setPassword("");

      setScheduleType("2");

      setInitialShift(
        "early"
      );

      setCycleStartDate(
        "2027-01-04"
      );

      setVacationDays("25");

      setTeamLeader(false);

      setShowForm(false);

      setSuccess(
        tr(
          `Працівника "${cleanName}" успішно додано. Логін: ${cleanLogin}`,
          `Zaměstnanec „${cleanName}“ byl úspěšně přidán. Login: ${cleanLogin}`
        )
      );

      await loadEmployees();
    } catch (error) {
      console.error(error);

      setError(
        tr("Не вдалося зв'язатися із сервером.", "Nepodařilo se spojit se serverem.")
      );
    }

    setSaving(false);
  }

  async function startEditing(
    employee: Employee
  ) {
    setError("");
    setSuccess("");

    setEditingEmployee(
      employee
    );

    setEditFullName(
      employee.full_name
    );

    setEditScheduleType(
      String(
        employee.schedule_type
      )
    );

    setEditInitialShift(
      employee.initial_shift
    );

    setEditCycleStartDate(
      employee.cycle_start_date
    );

    setEditVacationDays(
      String(
        employee.vacation_days_per_year
      )
    );

    setEditTeamLeader(
      employee.team_leader
    );

    setNewChangeDate("");
    setNewChangeShift(
      employee.initial_shift === "night" &&
      employee.schedule_type === 2
        ? "early"
        : employee.initial_shift
    );

    await loadScheduleChanges(employee.id);
  }

  async function loadScheduleChanges(employeeId: string) {
    setScheduleChangesLoading(true);

    const { data, error } = await supabase
      .from("employee_schedule_changes")
      .select("id, employee_id, effective_date, initial_shift, created_at")
      .eq("employee_id", employeeId)
      .order("effective_date", { ascending: true });

    if (error) {
      console.error(error);
      setScheduleChanges([]);
      setError(
        tr("Не вдалося завантажити зміни графіка: ", "Nepodařilo se načíst změny rozpisu: ") +
          error.message
      );
      setScheduleChangesLoading(false);
      return;
    }

    setScheduleChanges((data ?? []) as ScheduleChange[]);
    setScheduleChangesLoading(false);
  }

  async function addScheduleChange() {
    if (!editingEmployee) return;

    setError("");
    setSuccess("");

    if (!newChangeDate) {
      setError("Оберіть дату, з якої починає діяти нова зміна.");
      return;
    }

    if (newChangeDate < editingEmployee.cycle_start_date) {
      setError(
        "Дата зміни не може бути раніше початку основного циклу працівника."
      );
      return;
    }

    if (editScheduleType === "2" && newChangeShift === "night") {
      setError(
        "Для працівника з 2 змінами не можна призначити нічну зміну."
      );
      return;
    }

    if (scheduleChanges.some((change) => change.effective_date === newChangeDate)) {
      setError(
        "На цю дату вже є зміна графіка. Видаліть її або виберіть іншу дату."
      );
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Сесія завершилася. Увійдіть у систему ще раз.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("employee_schedule_changes")
      .insert({
        employee_id: editingEmployee.id,
        effective_date: newChangeDate,
        initial_shift: newChangeShift,
        created_by: user.id,
      });

    if (error) {
      console.error(error);
      setError(
        tr("Не вдалося додати зміну графіка: ", "Nepodařilo se přidat změnu rozpisu: ") +
          error.message
      );
      setSaving(false);
      return;
    }

    const displayDate = formatDateForDisplay(newChangeDate);
    const shiftName = getShiftName(newChangeShift);

    setNewChangeDate("");
    setSuccess(
      tr(`З ${displayDate} працівник працюватиме у зміні «${shiftName}».`, `Od ${displayDate} bude zaměstnanec pracovat ve směně „${shiftName}“.`)
    );

    await loadScheduleChanges(editingEmployee.id);
    setSaving(false);
  }

  async function deleteScheduleChange(change: ScheduleChange) {
    const confirmed = window.confirm(
      tr(`Видалити зміну графіка з ${formatDateForDisplay(change.effective_date)}?`, `Smazat změnu rozpisu od ${formatDateForDisplay(change.effective_date)}?`)
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setSaving(true);

    const { error } = await supabase
      .from("employee_schedule_changes")
      .delete()
      .eq("id", change.id);

    if (error) {
      console.error(error);
      setError(
        tr("Не вдалося видалити зміну графіка: ", "Nepodařilo se smazat změnu rozpisu: ") +
          error.message
      );
      setSaving(false);
      return;
    }

    setSuccess(tr("Зміну графіка видалено.", "Změna rozpisu byla smazána."));

    await loadScheduleChanges(change.employee_id);
    setSaving(false);
  }

  function cancelEditing() {
    setEditingEmployee(null);
    setScheduleChanges([]);
    setNewChangeDate("");
    setError("");
  }

  function formatDateForDisplay(dateString: string) {
    const [year, month, day] = dateString.split("-");
    return `${day}.${month}.${year}`;
  }

  function getShiftName(
    shift: string
  ) {
    if (shift === "early") {
      return tr("Рання", "Ranní");
    }

    if (shift === "day") {
      return tr("Обідня", "Odpolední");
    }

    if (shift === "night") {
      return tr("Нічна", "Noční");
    }

    return shift;
  }

  async function handleEditEmployee(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingEmployee) {
      return;
    }

    setError("");
    setSuccess("");

    if (!editFullName.trim()) {
      setError(
        "Введіть ім'я працівника."
      );
      return;
    }

    if (
      !editCycleStartDate
    ) {
      setError(
        tr("Оберіть початок циклу.", "Vyberte začátek cyklu.")
      );
      return;
    }

    if (
      editScheduleType === "2" &&
      (editingEmployee.initial_shift === "night" ||
        scheduleChanges.some(
          (change) => change.initial_shift === "night"
        ))
    ) {
      setError(
        "Працівника не можна перевести на 2 зміни, поки в його графіку є нічна зміна. Спочатку видаліть нічні зміни графіка."
      );
      return;
    }

    const numericVacationDays =
      Number(
        editVacationDays
      );

    if (
      !Number.isInteger(
        numericVacationDays
      ) ||
      numericVacationDays < 1 ||
      numericVacationDays > 365
    ) {
      setError(
        "Кількість днів відпустки має бути від 1 до 365."
      );
      return;
    }

    setSaving(true);

    const {
      error,
    } = await supabase
      .from("employees")
      .update({
        full_name:
          editFullName.trim(),

        schedule_type:
          Number(
            editScheduleType
          ),

        cycle_start_date:
          editCycleStartDate,

        vacation_days_per_year:
          numericVacationDays,

        team_leader:
          editTeamLeader,
      })
      .eq(
        "id",
        editingEmployee.id
      );

    if (error) {
      console.error(error);

      setError(
        "Не вдалося зберегти зміни: " +
          error.message
      );

      setSaving(false);
      return;
    }

    setEditingEmployee(
      null
    );
    setScheduleChanges([]);
    setNewChangeDate("");

    setSuccess(
      tr("Дані працівника оновлено.", "Údaje zaměstnance byly aktualizovány.")
    );

    await loadEmployees();

    setSaving(false);
  }

  async function toggleEmployeeActive(
    employee: Employee
  ) {
    const newActiveStatus =
      !employee.active;

    const action =
      newActiveStatus
        ? tr("активувати", "aktivovat")
        : tr("деактивувати", "deaktivovat");

    const confirmed =
      window.confirm(
        tr(`Ви впевнені, що хочете ${action} працівника "${employee.full_name}"?`, `Opravdu chcete ${action} zaměstnance „${employee.full_name}“?`)
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const {
      error,
    } = await supabase
      .from("employees")
      .update({
        active:
          newActiveStatus,
      })
      .eq(
        "id",
        employee.id
      );

    if (error) {
      console.error(error);

      setError(
        `Не вдалося ${action} працівника: ` +
          error.message
      );

      return;
    }

    setSuccess(
      newActiveStatus
        ? tr(`Працівника "${employee.full_name}" активовано.`, `Zaměstnanec „${employee.full_name}“ byl aktivován.`)
        : tr(`Працівника "${employee.full_name}" деактивовано.`, `Zaměstnanec „${employee.full_name}“ byl deaktivován.`)
    );

    await loadEmployees();
  }

  async function toggleTeamLeader(
    employee: Employee
  ) {
    const newValue =
      !employee.team_leader;

    const actionText =
      newValue
        ? tr("призначити Team Leader", "jmenovat Team Leadera")
        : tr("зняти статус Team Leader", "odebrat status Team Leader");

    const confirmed =
      window.confirm(
        tr(`Ви впевнені, що хочете ${actionText} для "${employee.full_name}"?`, `Opravdu chcete ${actionText} pro „${employee.full_name}“?`)
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const {
      error,
    } = await supabase
      .from("employees")
      .update({
        team_leader:
          newValue,
      })
      .eq(
        "id",
        employee.id
      );

    if (error) {
      console.error(error);

      setError(
        "Не вдалося змінити статус Team Leader: " +
          error.message
      );

      return;
    }

    setSuccess(
      newValue
        ? tr(`"${employee.full_name}" призначено Team Leader.`, `„${employee.full_name}“ byl jmenován Team Leaderem.`)
        : tr(`Статус Team Leader для "${employee.full_name}" знято.`, `Status Team Leader pro „${employee.full_name}“ byl odebrán.`)
    );

    await loadEmployees();
  }

  

  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.active
    );

  const teamLeaders =
    employees.filter(
      (employee) =>
        employee.team_leader &&
        employee.active
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-gray-500">
              {tr('Завантаження працівників...', 'Načítání zaměstnanců...')}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">

        {/* Заголовок */}

        <div className="rounded-2xl bg-white p-8 shadow-sm">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tr('Працівники', 'Zaměstnanci')}
              </h1>

              <p className="mt-2 text-gray-600">
                {tr("Усього працівників:", "Celkem zaměstnanců:")}{" "}
                <strong>
                  {employees.length}
                </strong>
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {tr("Активних:", "Aktivních:")}{" "}
                <strong>
                  {activeEmployees.length}
                </strong>
                {" · "}
                Team Leader:{" "}
                <strong>
                  {teamLeaders.length}
                </strong>
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <LanguageSwitcher />
              <Link
                href="/admin"
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center font-semibold text-gray-700 hover:bg-gray-100"
              >
                {tr('← Адмін панель', '← Administrace')}
              </Link>

              <button
                type="button"
                onClick={() => {
                  setShowForm(
                    !showForm
                  );

                setEditingEmployee(
                  null
                );

                setError("");
                setSuccess("");
              }}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
                {showForm
                  ? tr("Закрити форму", "Zavřít formulář")
                  : tr("+ Додати працівника", "+ Přidat zaměstnance")}
              </button>
            </div>
          </div>

          

          {/* Форма додавання */}

          {showForm && (
            <form
              onSubmit={
                handleAddEmployee
              }
              className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6"
            >
              <h2 className="text-xl font-bold text-gray-900">
                {tr('Новий працівник', 'Nový zaměstnanec')}
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                {/* Ім'я */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr("Ім'я та прізвище", 'Jméno a příjmení')}
                  </label>

                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(
                        event.target.value
                      )
                    }
                    placeholder={tr("Наприклад: Ivan Petrenko", "Například: Ivan Petrenko")}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                    required
                  />
                </div>

                {/* Логін */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Логін', 'Login')}
                  </label>

                  <input
                    type="text"
                    value={login}
                    onChange={(event) =>
                      setLogin(
                        event.target.value
                      )
                    }
                    placeholder={tr("Наприклад: ivan.petrenko", "Například: ivan.petrenko")}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                    required
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Цей логін працівник
                    використовуватиме
                    для входу.
                  </p>
                </div>

                {/* Пароль */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Пароль', 'Heslo')}
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder={tr("Мінімум 6 символів", "Minimálně 6 znaků")}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                    required
                  />
                </div>

                {/* Кількість змін */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Кількість змін', 'Počet směn')}
                  </label>

                  <select
                    value={
                      scheduleType
                    }
                    onChange={(event) => {
                      const value =
                        event.target
                          .value;

                      setScheduleType(
                        value
                      );

                      if (
                        value ===
                        "2"
                      ) {
                        setInitialShift(
                          "early"
                        );
                      }
                    }}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                  >
                    <option value="2">
                      {tr('2 зміни', '2 směny')}
                    </option>

                    <option value="3">
                      {tr('3 зміни', '3 směny')}
                    </option>
                  </select>
                </div>

                {/* Початкова зміна */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Початкова зміна', 'Počáteční směna')}
                  </label>

                  <select
                    value={
                      initialShift
                    }
                    onChange={(event) =>
                      setInitialShift(
                        event.target
                          .value as
                          | "early"
                          | "day"
                          | "night"
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                  >
                    <option value="early">
                      {tr('Рання', 'Ranní')}
                    </option>

                    <option value="day">
                      {tr('Обідня', 'Odpolední')}
                    </option>

                    <option
                      value="night"
                      disabled={
                        scheduleType ===
                        "2"
                      }
                    >
                      {tr('Нічна', 'Noční')}
                    </option>
                  </select>
                </div>

                {/* Початок циклу */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Початок циклу', 'Začátek cyklu')}
                  </label>

                  <input
                    type="date"
                    value={
                      cycleStartDate
                    }
                    onChange={(event) =>
                      setCycleStartDate(
                        event.target
                          .value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                    required
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Для ранньої та обідньої
                    зміни зазвичай понеділок.
                    Для нічної — неділя.
                  </p>
                </div>

                {/* Дні відпустки */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {tr('Днів відпустки на рік', 'Dnů dovolené za rok')}
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={
                      vacationDays
                    }
                    onChange={(event) =>
                      setVacationDays(
                        event.target
                          .value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                    required
                  />
                </div>

              </div>

              {/* Team Leader */}

              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={
                      teamLeader
                    }
                    onChange={(event) =>
                      setTeamLeader(
                        event.target
                          .checked
                      )
                    }
                    className="h-5 w-5 rounded border-gray-300"
                  />

                  <span className="font-semibold text-emerald-800">
                    👑 Team Leader
                  </span>
                </label>

                <p className="mt-2 text-sm text-emerald-700">
                  Відмітьте, якщо працівник
                  є Team Leader.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving
                    ? "Створення..."
                    : "Створити працівника"}
                </button>
              </div>
            </form>
          )}

          {/* Повідомлення */}

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
              {success}
            </div>
          )}

          {/* Статистика */}

          <div className="mt-8 grid gap-4 md:grid-cols-3">

            <div className="rounded-xl bg-blue-50 p-5">
              <p className="text-sm text-blue-600">
                {tr('Усього', 'Celkem')}
              </p>

              <p className="mt-1 text-3xl font-bold text-blue-800">
                {employees.length}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-5">
              <p className="text-sm text-green-600">
                {tr('Активні', 'Aktivní')}
              </p>

              <p className="mt-1 text-3xl font-bold text-green-800">
                {activeEmployees.length}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-5">
              <p className="text-sm text-emerald-600">
                👑 Team Leader
              </p>

              <p className="mt-1 text-3xl font-bold text-emerald-800">
                {teamLeaders.length}
              </p>
            </div>

          </div>

          {/* Список працівників */}

          <div className="mt-8 space-y-4">

            {employees.map(
              (employee) => (
                <div
                  key={
                    employee.id
                  }
                  className={`rounded-xl border p-5 ${
                    employee.team_leader
                      ? "border-emerald-300 bg-emerald-50/40"
                      : employee.active
                      ? "border-gray-200 bg-white"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >

                  {accessEmployee?.id === employee.id && (
                    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
                      <h3 className="text-lg font-bold text-gray-900">
                        {tr('🔐 Додати доступ до системи', '🔐 Přidat přístup do systému')}
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        {tr('Створіть логін і пароль для цього працівника.', 'Vytvořte pro tohoto zaměstnance login a heslo.')}
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr('Логін', 'Login')}
                          </label>
                          <input
                            type="text"
                            value={accessLogin}
                            onChange={(event) =>
                              setAccessLogin(event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                            autoComplete="off"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr('Пароль', 'Heslo')}
                          </label>
                          <input
                            type="password"
                            value={accessPassword}
                            onChange={(event) =>
                              setAccessPassword(event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                            placeholder={tr("Мінімум 6 символів", "Minimálně 6 znaků")}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleCreateAccess}
                          disabled={accessSaving}
                          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {accessSaving ? tr("Створення...", "Vytváření...") : tr("Створити доступ", "Vytvořit přístup")}
                        </button>

                        <button
                          type="button"
                          onClick={closeAccessForm}
                          disabled={accessSaving}
                          className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {tr('Скасувати', 'Zrušit')}
                        </button>
                      </div>
                    </div>
                  )}

                  {editingEmployee?.id ===
                  employee.id ? (
                    /* =================================
                       РЕДАГУВАННЯ
                       ================================= */

                    <form
                      onSubmit={
                        handleEditEmployee
                      }
                      className="rounded-xl bg-gray-50 p-5"
                    >
                      <h2 className="text-xl font-bold text-gray-900">
                        {tr('Редагування працівника', 'Úprava zaměstnance')}
                      </h2>

                      <div className="mt-6 grid gap-5 md:grid-cols-2">

                        {/* Ім'я */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr("Ім'я та прізвище", 'Jméno a příjmení')}
                          </label>

                          <input
                            type="text"
                            value={
                              editFullName
                            }
                            onChange={(
                              event
                            ) =>
                              setEditFullName(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                            required
                          />
                        </div>

                        {/* Кількість змін */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr('Кількість змін', 'Počet směn')}
                          </label>

                          <select
                            value={
                              editScheduleType
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value;

                              setEditScheduleType(
                                value
                              );

                              if (
                                value ===
                                "2"
                              ) {
                                setEditInitialShift(
                                  "early"
                                );
                              }
                            }}
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                          >
                            <option value="2">
                              {tr('2 зміни', '2 směny')}
                            </option>

                            <option value="3">
                              {tr('3 зміни', '3 směny')}
                            </option>
                          </select>
                        </div>

                        {/* Зміни графіка */}

                        <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-5">
                          <h3 className="text-lg font-bold text-gray-900">
                            {tr('🔄 Зміни графіка', '🔄 Změny rozpisu')}
                          </h3>

                          <p className="mt-1 text-sm text-gray-600">
                            {tr('Вкажіть, з якої дати працівник переходить на іншу зміну.', 'Zadejte datum, od kterého zaměstnanec přechází na jinou směnu.')}
                          </p>

                          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {tr('З дати', 'Od data')}
                              </label>
                              <input
                                type="date"
                                value={newChangeDate}
                                min={editingEmployee.cycle_start_date}
                                onChange={(event) =>
                                  setNewChangeDate(event.target.value)
                                }
                                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {tr('Нова зміна', 'Nová směna')}
                              </label>
                              <select
                                value={newChangeShift}
                                onChange={(event) =>
                                  setNewChangeShift(event.target.value as Shift)
                                }
                                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                              >
                                <option value="early">{tr('R — Рання', 'R — Ranní')}</option>
                                <option value="day">{tr('O — Обідня', 'O — Odpolední')}</option>
                                <option
                                  value="night"
                                  disabled={editScheduleType === "2"}
                                >
                                  {tr('N — Нічна', 'N — Noční')}
                                </option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={addScheduleChange}
                              disabled={saving}
                              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {tr('+ Додати', '+ Přidat')}
                            </button>
                          </div>

                          <div className="mt-5">
                            <p className="text-sm font-semibold text-gray-800">
                              {tr('Історія / заплановані зміни', 'Historie / plánované změny')}
                            </p>

                            {scheduleChangesLoading ? (
                              <p className="mt-2 text-sm text-gray-500">
                                {tr('Завантаження...', 'Načítání...')}
                              </p>
                            ) : scheduleChanges.length === 0 ? (
                              <p className="mt-2 rounded-lg bg-white p-3 text-sm text-gray-500">
                                {tr('Змін немає. Працівник працює за основним графіком.', 'Žádné změny. Zaměstnanec pracuje podle základního rozpisu.')}
                              </p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {scheduleChanges.map((change) => (
                                  <div
                                    key={change.id}
                                    className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="text-sm">
                                      <strong>
                                        {tr(`З ${formatDateForDisplay(change.effective_date)}`, `Od ${formatDateForDisplay(change.effective_date)}`)}
                                      </strong>
                                      <span className="ml-2 text-gray-600">
                                        {change.initial_shift === "early"
                                          ? "R — Рання"
                                          : change.initial_shift === "day"
                                          ? "O — Обідня"
                                          : "N — Нічна"}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => deleteScheduleChange(change)}
                                      disabled={saving}
                                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      {tr('🗑 Видалити', '🗑 Smazat')}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Початок циклу */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr('Початок циклу', 'Začátek cyklu')}
                          </label>

                          <input
                            type="date"
                            value={
                              editCycleStartDate
                            }
                            onChange={(
                              event
                            ) =>
                              setEditCycleStartDate(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                            required
                          />
                        </div>

                        {/* Дні відпустки */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr('Днів відпустки на рік', 'Dnů dovolené za rok')}
                          </label>

                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={
                              editVacationDays
                            }
                            onChange={(
                              event
                            ) =>
                              setEditVacationDays(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                            required
                          />
                        </div>

                      </div>

                      {/* Team Leader */}

                      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              editTeamLeader
                            }
                            onChange={(
                              event
                            ) =>
                              setEditTeamLeader(
                                event
                                  .target
                                  .checked
                              )
                            }
                            className="h-5 w-5 rounded border-gray-300"
                          />

                          <span className="font-semibold text-emerald-800">
                            👑 Team Leader
                          </span>
                        </label>

                        <p className="mt-2 text-sm text-emerald-700">
                          Team Leader має окреме
                          правило конфліктів
                          відпустки.
                        </p>
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                        <button
                          type="button"
                          onClick={
                            cancelEditing
                          }
                          className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          {tr('Скасувати', 'Zrušit')}
                        </button>

                        <button
                          type="submit"
                          disabled={
                            saving
                          }
                          className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving
                            ? tr("Збереження...", "Ukládání...")
                            : tr("Зберегти зміни", "Uložit změny")}
                        </button>

                      </div>
                    </form>
                  ) : (
                    /* =================================
                       КАРТКА ПРАЦІВНИКА
                       ================================= */

                    <div className="flex flex-col gap-5">

                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                        <div>

                          <div className="flex flex-wrap items-center gap-3">

                            <h2 className="text-lg font-semibold text-gray-900">
                              {
                                employee.full_name
                              }
                            </h2>

                            {employee.active ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                {tr('Активний', 'Aktivní')}
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                                {tr('Неактивний', 'Neaktivní')}
                              </span>
                            )}

                            {employee.role ===
                              "admin" && (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {tr('Адміністратор', 'Administrátor')}
                              </span>
                            )}

                            {employee.team_leader && (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                👑 TEAM LEADER
                              </span>
                            )}

                          </div>

                          <p className="mt-2 text-sm text-gray-600">
                            {
                              employee.schedule_type
                            }{" "}
                            {tr("зміни ·", "směny ·")}{" "}
                            {tr("Початкова зміна:", "Počáteční směna:")}{" "}
                            {getShiftName(
                              employee.initial_shift
                            )}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {tr("Початок циклу:", "Začátek cyklu:")}{" "}
                            {
                              employee.cycle_start_date
                            }
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {tr("Відпустка:", "Dovolená:")}{" "}
                            {
                              employee.vacation_days_per_year
                            }{" "}
                            {tr("днів на рік", "dnů ročně")}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {tr("Доступ до системи:", "Přístup do systému:")}{" "}
                            {employee.auth_user_id ? (
                              <span className="font-semibold text-green-600">
                                {tr('Є', 'Ano')}
                              </span>
                            ) : (
                              <span className="font-semibold text-red-600">
                                {tr('Немає', 'Ne')}
                              </span>
                            )}
                          </p>

                        </div>

                        {/* Основні кнопки */}

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">

                          {!employee.auth_user_id && (
                            <button
                              type="button"
                              onClick={() => openAccessForm(employee)}
                              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                            >
                              {tr('🔐 Додати доступ', '🔐 Přidat přístup')}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              startEditing(
                                employee
                              )
                            }
                            className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            {tr('Редагувати', 'Upravit')}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleTeamLeader(
                                employee
                              )
                            }
                            className={`rounded-xl px-5 py-3 font-semibold ${
                              employee.team_leader
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {employee.team_leader
                              ? tr("Зняти Team Leader", "Odebrat Team Leadera")
                              : "👑 Team Leader"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleEmployeeActive(
                                employee
                              )
                            }
                            className={`rounded-xl px-5 py-3 font-semibold ${
                              employee.active
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          >
                            {employee.active
                              ? tr("Деактивувати", "Deaktivovat")
                              : tr("Активувати", "Aktivovat")}
                          </button>

                        </div>

                      </div>

                    </div>
                  )}

                </div>
              )
            )}

          </div>

        </div>

      </div>
    </main>
  );
}