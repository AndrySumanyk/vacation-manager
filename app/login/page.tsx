"use client";

import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { t } = useLanguage();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const email = `${login.trim().toLowerCase()}@vacation-manager.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(t("login.error"));
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-end">
            <LanguageSwitcher />
          </div>

          <div className="mb-8 text-center">
            <div className="mb-3 text-5xl">🏖️</div>

            <h1 className="text-2xl font-bold text-gray-900">
              {t("login.title")}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Vacation Manager
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                {t("login.login")}
              </label>

              <input
                id="login"
                type="text"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="symaniuk.andrii"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                {t("login.password")}
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? t("common.loading")
                : t("login.submit")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
