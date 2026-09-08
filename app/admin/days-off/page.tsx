"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/lib/supabase";
import { getCurrentEmployee } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";

type ShiftType = "early" | "day" | "night";

type DayOff = {
  id: string;
  day_off_date: string;
  shift_type: ShiftType;
  created_by: string;
  created_at: string;
};

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-");

  return `${day}.${month}.${year}`;
}

function getShiftName(shift: ShiftType, language: "uk" | "cs" = "uk") {
  if (shift === "early") {
    return language === "cs" ? "Ranní směna" : "Рання зміна";
  }

  if (shift === "day") {
    return language === "cs" ? "Odpolední směna" : "Обідня зміна";
  }

  return language === "cs" ? "Noční směna" : "Нічна зміна";
}

function getShiftIcon(shift: ShiftType) {
  if (shift === "early") {
    return "🌅";
  }

  if (shift === "day") {
    return "☀️";
  }

  return "🌙";
}

function getShiftStyle(shift: ShiftType) {
  if (shift === "early") {
    return "border-blue-200 bg-blue-50";
  }

  if (shift === "day") {
    return "border-green-200 bg-green-50";
  }

  return "border-red-200 bg-red-50";
}

export default function DaysOffPage() {
  const { language } = useLanguage();
  const tr = (uk: string, cs: string) => (language === "cs" ? cs : uk);
  const [currentEmployee, setCurrentEmployee] =
    useState<any>(null);

  const [daysOff, setDaysOff] = useState<DayOff[]>([]);

  const [selectedDate, setSelectedDate] =
    useState("");

  const [selectedShifts, setSelectedShifts] =
    useState<ShiftType[]>([
      "early",
      "day",
    ]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const employee =
      await getCurrentEmployee();

    if (!employee) {
      setError(
        tr("Не вдалося перевірити профіль.", "Nepodařilo se ověřit profil.")
      );

      setLoading(false);
      return;
    }

    setCurrentEmployee(employee);

    if (
      employee.role !== "admin" &&
      !employee.team_leader
    ) {
      setError(
        tr("Доступ дозволено тільки адміністратору або Team Leader.", "Přístup je povolen pouze administrátorovi nebo Team Leaderovi.")
      );

      setLoading(false);
      return;
    }

    const {
      data,
      error: daysOffError,
    } = await supabase
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
      )
      .order(
        "shift_type",
        {
          ascending: true,
        }
      );

    if (daysOffError) {
      console.error(
        "LOAD DAYS OFF ERROR:",
        daysOffError
      );

      setError(
        tr("Не вдалося завантажити вихідні.", "Nepodařilo se načíst volné dny.")
      );
    } else {
      setDaysOff(
        (data ?? []) as DayOff[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleShift(
    shift: ShiftType
  ) {
    setSelectedShifts(
      (current) => {
        if (current.includes(shift)) {
          return current.filter(
            (item) => item !== shift
          );
        }

        return [
          ...current,
          shift,
        ];
      }
    );
  }

  async function handleAddDaysOff() {
    setError("");
    setSuccess("");

    if (!selectedDate) {
      setError(
        tr("Спочатку виберіть дату.", "Nejprve vyberte datum.")
      );

      return;
    }

    if (
      selectedShifts.length === 0
    ) {
      setError(
        tr("Виберіть хоча б одну зміну.", "Vyberte alespoň jednu směnu.")
      );

      return;
    }

    if (!currentEmployee) {
      setError(
        tr("Профіль користувача не знайдено.", "Profil uživatele nebyl nalezen.")
      );

      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          tr("Сесія завершилася. Увійдіть у систему ще раз.", "Relace vypršela. Přihlaste se znovu.")
        );

        setSaving(false);

        return;
      }

      const existingShifts =
        daysOff
          .filter(
            (dayOff) =>
              dayOff.day_off_date ===
              selectedDate
          )
          .map(
            (dayOff) =>
              dayOff.shift_type
          );

      const newShifts =
        selectedShifts.filter(
          (shift) =>
            !existingShifts.includes(
              shift
            )
        );

      if (
        newShifts.length === 0
      ) {
        setError(
          tr("Для цієї дати вибрані зміни вже мають вихідний.", "Pro toto datum již mají vybrané směny volno.")
        );

        setSaving(false);

        return;
      }

      const rows =
        newShifts.map(
          (shift) => ({
            day_off_date:
              selectedDate,

            shift_type:
              shift,

            created_by:
              user.id,
          })
        );

      const {
        error: insertError,
      } = await supabase
        .from("days_off")
        .insert(rows);

      if (insertError) {
        console.error(
          "INSERT DAYS OFF ERROR:",
          insertError
        );

        setError(
          tr("Не вдалося додати вихідний: ", "Nepodařilo se přidat volný den: ") +
            insertError.message
        );

        setSaving(false);

        return;
      }

      setSuccess(
        `${tr("Вихідний успішно додано для: ", "Volný den byl úspěšně přidán pro: ")}${newShifts
          .map((shift) => getShiftName(shift, language))
          .join(", ")}.`
      );

      await loadData();
    } catch (error) {
      console.error(
        "ADD DAYS OFF ERROR:",
        error
      );

      setError(
        tr("Сталася помилка під час додавання вихідного.", "Při přidávání volného dne došlo k chybě.")
      );
    }

    setSaving(false);
  }

  async function handleDelete(
    dayOff: DayOff
  ) {
    const confirmed =
      window.confirm(
        `${tr("Видалити вихідний для", "Smazat volno pro")} "${getShiftName(
          dayOff.shift_type,
          language
        )}" ${tr("на", "dne")} ${formatDate(dayOff.day_off_date)}?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const {
      error: deleteError,
    } = await supabase
      .from("days_off")
      .delete()
      .eq("id", dayOff.id);

    if (deleteError) {
      console.error(
        "DELETE DAYS OFF ERROR:",
        deleteError
      );

      setError(
        "Не вдалося видалити вихідний."
      );

      return;
    }

    setSuccess(
      tr("Вихідний видалено.", "Volný den byl odstraněn.")
    );

    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            {tr("Завантаження...", "Načítání...")}
          </div>
        </div>
      </main>
    );
  }

  if (
    currentEmployee &&
    currentEmployee.role !== "admin" &&
    !currentEmployee.team_leader
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <div className="mb-3 text-4xl">
              🔒
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              {tr("Доступ заборонено", "Přístup odepřen")}
            </h1>

            <p className="mt-2 text-gray-600">
              {tr("Керувати вихідними може тільки", "Volné dny může spravovat pouze")}
              {tr("адміністратор або Team Leader.", "administrátor nebo Team Leader.")}
            </p>

            <Link
              href="/admin"
              className="mt-6 inline-block rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800"
            >
              {tr("← Адмін панель", "← Administrace")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tr("📅 Вихідні", "📅 Volné dny")}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {tr("Призначення вихідних для змін", "Nastavení volna pro směny")}
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


        {/* MESSAGES */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </div>
        )}


        {/* ADD FORM */}

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-1 text-lg font-bold text-gray-900">
            {tr("Додати вихідний", "Přidat volný den")}
          </h2>

          <p className="mb-6 text-sm text-gray-500">
            {tr("Виберіть дату та одну або декілька змін.", "Vyberte datum a jednu nebo více směn.")}
          </p>


          <div className="grid gap-6 md:grid-cols-2">

            {/* DATE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {tr("Дата", "Datum")}
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-gray-500"
              />
            </div>


            {/* SHIFTS */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {tr("Вихідний для змін", "Volno pro směny")}
              </label>

              <div className="space-y-2">

                <button
                  type="button"
                  onClick={() =>
                    toggleShift(
                      "early"
                    )
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedShifts.includes(
                      "early"
                    )
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">

                    <span className="font-semibold text-gray-800">
                      {tr("🌅 Рання зміна", "🌅 Ranní směna")}
                    </span>

                    <span className="text-xl">
                      {selectedShifts.includes(
                        "early"
                      )
                        ? "☑️"
                        : "⬜"}
                    </span>

                  </div>
                </button>


                <button
                  type="button"
                  onClick={() =>
                    toggleShift(
                      "day"
                    )
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedShifts.includes(
                      "day"
                    )
                      ? "border-green-400 bg-green-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">

                    <span className="font-semibold text-gray-800">
                      {tr("☀️ Обідня зміна", "☀️ Odpolední směna")}
                    </span>

                    <span className="text-xl">
                      {selectedShifts.includes(
                        "day"
                      )
                        ? "☑️"
                        : "⬜"}
                    </span>

                  </div>
                </button>


                <button
                  type="button"
                  onClick={() =>
                    toggleShift(
                      "night"
                    )
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedShifts.includes(
                      "night"
                    )
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">

                    <span className="font-semibold text-gray-800">
                      {tr("🌙 Нічна зміна", "🌙 Noční směna")}
                    </span>

                    <span className="text-xl">
                      {selectedShifts.includes(
                        "night"
                      )
                        ? "☑️"
                        : "⬜"}
                    </span>

                  </div>
                </button>

              </div>
            </div>

          </div>


          {/* PREVIEW */}

          {selectedDate && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">

              <div className="text-sm font-semibold text-gray-700">
                {tr("Попередній перегляд", "Náhled")}
              </div>

              <div className="mt-2 text-sm text-gray-600">
                {formatDate(
                  selectedDate
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">

                {selectedShifts.length ===
                0 ? (
                  <span className="text-sm text-gray-400">
                    {tr("Зміни не вибрані", "Nejsou vybrány žádné směny")}
                  </span>
                ) : (
                  selectedShifts.map(
                    (shift) => (
                      <span
                        key={shift}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${getShiftStyle(
                          shift
                        )}`}
                      >
                        {getShiftIcon(
                          shift
                        )}{" "}
                        {getShiftName(
                          shift
                        )}
                      </span>
                    )
                  )
                )}

              </div>

            </div>
          )}


          <button
            type="button"
            onClick={
              handleAddDaysOff
            }
            disabled={saving}
            className="mt-6 rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? tr("Додавання...", "Přidávání...")
              : "+ " + tr("Додати вихідний", "Přidat volný den") + ""}
          </button>

        </section>


        {/* CURRENT DAYS OFF */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {tr("Встановлені вихідні", "Nastavené volné dny")}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {tr("Вихідний автоматично застосовується до всіх працівників відповідної зміни.", "Volný den se automaticky vztahuje na všechny zaměstnance příslušné směny.")}
            </p>
          </div>


          {daysOff.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
              {tr("Поки що вихідних не встановлено.", "Zatím nejsou nastaveny žádné volné dny.")}
            </div>
          ) : (
            <div className="space-y-3">

              {daysOff.map(
                (dayOff) => (
                  <div
                    key={
                      dayOff.id
                    }
                    className={`flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between ${getShiftStyle(
                      dayOff.shift_type
                    )}`}
                  >

                    <div className="flex items-center gap-4">

                      <div className="text-3xl">
                        {getShiftIcon(
                          dayOff.shift_type
                        )}
                      </div>

                      <div>
                        <div className="font-bold text-gray-900">
                          {formatDate(
                            dayOff.day_off_date
                          )}
                        </div>

                        <div className="text-sm text-gray-600">
                          {getShiftName(
                            dayOff.shift_type
                          )}
                        </div>
                      </div>

                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          dayOff
                        )
                      }
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      {tr("Видалити", "Smazat")}
                    </button>

                  </div>
                )
              )}

            </div>
          )}

        </section>


        {/* INFO */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">

          <div className="text-sm font-bold text-gray-800">
            {tr("💡 Як це працює", "💡 Jak to funguje")}
          </div>

          <div className="mt-3 space-y-2 text-sm text-gray-600">

            <p>
              • {tr("Вихідний встановлюється для всієї зміни, а не для окремого працівника.", "Volný den se nastavuje pro celou směnu, ne pro jednotlivého zaměstnance.")}
            </p>

            <p>
              • {tr("Якщо вибрати ранню та обідню зміну, всі працівники цих змін отримають вихідний.", "Pokud vyberete ranní a odpolední směnu, všichni zaměstnanci těchto směn budou mít volno.")}
            </p>

            <p>
              • {tr("Нічна зміна при цьому продовжує працювати.", "Noční směna přitom pokračuje v práci.")}
            </p>

            <p>
              • {tr("Один і той самий вихідний не можна створити двічі для однієї зміни.", "Stejné volno nelze vytvořit dvakrát pro jednu směnu.")}
            </p>

            <p>
              • {tr("Пізніше календар та розрахунок днів відпустки автоматично враховуватимуть ці вихідні.", "Kalendář a výpočet dnů dovolené budou tyto dny volna automaticky zohledňovat.")}
            </p>

          </div>

        </section>

      </div>
    </main>
  );
}