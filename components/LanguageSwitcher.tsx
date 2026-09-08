"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguageSwitcher() {
  const { language, setLanguage } =
    useLanguage();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-500">
        Мова:
      </span>

      <button
        type="button"
        onClick={() => setLanguage("uk")}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          language === "uk"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        🇺🇦 UA
      </button>

      <button
        type="button"
        onClick={() => setLanguage("cs")}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          language === "cs"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        🇨🇿 CZ
      </button>
    </div>
  );
}