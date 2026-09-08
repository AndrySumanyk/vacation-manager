"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentEmployee } from "@/lib/auth";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

type Employee = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
};

export default function AdminPage() {
  const { language } = useLanguage();

  const tr = (uk: string, cs: string) =>
    language === "uk" ? uk : cs;

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setLoading(true);
    setError("");

    const currentEmployee =
      await getCurrentEmployee();

    if (!currentEmployee) {
      window.location.href = "/login";
      return;
    }

    if (currentEmployee.role !== "admin") {
      setError(
        tr(
          "Доступ дозволено тільки адміністраторам.",
          "Přístup je povolen pouze administrátorům."
        )
      );
      setLoading(false);
      return;
    }

    setEmployee(currentEmployee);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-gray-500">
              {tr(
                "Завантаження адмін-панелі...",
                "Načítání administrace..."
              )}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-bold text-gray-900">
              Vacation Manager
            </h1>

            <div className="mt-6 rounded-xl bg-red-50 p-5 text-red-700">
              {error}
            </div>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              ←{" "}
              {tr(
                "На головну",
                "Na hlavní stránku"
              )}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="text-lg text-blue-600 hover:text-blue-700"
            >
              {tr(
                "Панель адміністратора",
                "Administrace"
              )}
            </Link>

            <h1 className="mt-2 text-4xl font-bold text-gray-900">
              Vacation Manager
            </h1>

            {employee && (
              <p className="mt-3 text-xl text-gray-700">
                {tr(
                  "Вітаємо,",
                  "Vítejte,"
                )}{" "}
                <strong>
                  {employee.full_name}!
                </strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />

            <Link
              href="/"
              className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-100"
            >
              ←{" "}
              {tr(
                "Назад",
                "Zpět"
              )}
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
            >
              {tr(
                "Вийти",
                "Odhlásit se"
              )}
            </button>
          </div>
        </div>

        {/* КАРТКИ */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">

          {/* ПРАЦІВНИКИ */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-4xl">
              👥
            </div>

            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              {tr(
                "Працівники",
                "Zaměstnanci"
              )}
            </h2>

            <p className="mt-3 text-lg leading-7 text-gray-600">
              {tr(
                "Додавання, редагування та керування працівниками.",
                "Přidávání, úprava a správa zaměstnanců."
              )}
            </p>

            <Link
              href="/admin/employees"
              className="mt-8 inline-block font-semibold text-blue-600 hover:text-blue-700"
            >
              {tr(
                "Відкрити",
                "Otevřít"
              )} →
            </Link>
          </div>

          {/* ВІДПУСТКИ */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-4xl">
              🏖️
            </div>

            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              {tr(
                "Відпустки",
                "Dovolené"
              )}
            </h2>

            <p className="mt-3 text-lg leading-7 text-gray-600">
              {tr(
                "Перегляд та погодження заявок на відпустку.",
                "Prohlížení a schvalování žádostí o dovolenou."
              )}
            </p>

            <Link
              href="/admin/vacations"
              className="mt-8 inline-block font-semibold text-blue-600 hover:text-blue-700"
            >
              {tr(
                "Відкрити",
                "Otevřít"
              )} →
            </Link>
          </div>

          {/* ГРАФІК */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-4xl">
              🗓️
            </div>

            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              {tr(
                "Графік",
                "Rozpis směn"
              )}
            </h2>

            <p className="mt-3 text-lg leading-7 text-gray-600">
              {tr(
                "Перегляд змін та планування роботи команди.",
                "Prohlížení směn a plánování práce týmu."
              )}
            </p>

            <Link
              href="/calendar"
              className="mt-8 inline-block font-semibold text-blue-600 hover:text-blue-700"
            >
              {tr(
                "Відкрити",
                "Otevřít"
              )} →
            </Link>
          </div>

          {/* ВИХІДНІ */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="text-4xl">
              📅
            </div>

            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              {tr(
                "Вихідні",
                "Volné dny"
              )}
            </h2>

            <p className="mt-3 text-lg leading-7 text-gray-600">
              {tr(
                "Додавання та керування додатковими вихідними працівників.",
                "Přidávání a správa dodatečných volných dnů zaměstnanců."
              )}
            </p>

            <Link
              href="/admin/days-off"
              className="mt-8 inline-block font-semibold text-blue-600 hover:text-blue-700"
            >
              {tr(
                "Відкрити",
                "Otevřít"
              )} →
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}