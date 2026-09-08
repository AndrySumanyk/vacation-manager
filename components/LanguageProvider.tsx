"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Language = "uk" | "cs";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const translations: Record<
  Language,
  Record<string, string>
> = {
  uk: {
    // LANGUAGE
    "language.uk": "Українська",
    "language.cs": "Čeština",
    "language.switch": "Мова",

    // COMMON
    "common.loading": "Завантаження...",
    "common.save": "Зберегти",
    "common.cancel": "Скасувати",
    "common.delete": "Видалити",
    "common.edit": "Редагувати",
    "common.add": "Додати",
    "common.close": "Закрити",
    "common.back": "Назад",
    "common.logout": "Вийти",
    "common.open": "Відкрити",

    // NAVIGATION
    "nav.myVacations": "Мої відпустки",
    "nav.admin": "Адмін панель",
    "nav.calendar": "Календар",
    "nav.employees": "Працівники",
    "nav.vacations": "Відпустки",
    "nav.daysOff": "Вихідні",

    // LOGIN
    "login.title": "Вхід у систему",
    "login.login": "Логін",
    "login.password": "Пароль",
    "login.submit": "Увійти",
    "login.error": "Неправильний логін або пароль.",

    // ADMIN
    "admin.title": "Адмін панель",
    "admin.welcome": "Вітаємо,",
    "admin.employees": "Працівники",
    "admin.employeesDescription":
      "Додавання, редагування та керування працівниками.",
    "admin.vacations": "Відпустки",
    "admin.vacationsDescription":
      "Перегляд та погодження заявок на відпустку.",
    "admin.calendar": "Графік",
    "admin.calendarDescription":
      "Перегляд змін та планування роботи команди.",
    "admin.daysOff": "Вихідні",
    "admin.daysOffDescription":
      "Додавання та керування додатковими вихідними працівників.",

    // VACATIONS
    "vacation.title": "Планування відпустки",
    "vacation.start": "Дата початку",
    "vacation.end": "Дата завершення",
    "vacation.days": "Робочих днів",
    "vacation.submit": "Подати заявку",
    "vacation.pending": "Очікує погодження",
    "vacation.approved": "Погоджено",
    "vacation.rejected": "Відхилено",
    "vacation.conflict": "Є конфлікт дат",

    // CALENDAR
    "calendar.title": "Календар змін",
    "calendar.previous": "← Попередній",
    "calendar.next": "Наступний →",
    "calendar.today": "Сьогодні",
    "calendar.dayOff": "ВИХ",
    "calendar.vacation": "В",
    "calendar.holiday": "Свято",

    // DAYS OFF
    "daysOff.title": "Вихідні для змін",

    // EMPLOYEE
    "employee.teamLeader": "TEAM LEADER",
    "employee.active": "Активний",
    "employee.inactive": "Неактивний",

    // SHIFTS
    "shift.early": "Ранкова",
    "shift.day": "Денна",
    "shift.night": "Нічна",

    // STATUS
    "status.pending": "Очікує",
    "status.approved": "Погоджено",
    "status.rejected": "Відхилено",
  },

  cs: {
    // LANGUAGE
    "language.uk": "Українська",
    "language.cs": "Čeština",
    "language.switch": "Jazyk",

    // COMMON
    "common.loading": "Načítání...",
    "common.save": "Uložit",
    "common.cancel": "Zrušit",
    "common.delete": "Smazat",
    "common.edit": "Upravit",
    "common.add": "Přidat",
    "common.close": "Zavřít",
    "common.back": "Zpět",
    "common.logout": "Odhlásit se",
    "common.open": "Otevřít",

    // NAVIGATION
    "nav.myVacations": "Moje dovolené",
    "nav.admin": "Administrace",
    "nav.calendar": "Kalendář",
    "nav.employees": "Zaměstnanci",
    "nav.vacations": "Dovolené",
    "nav.daysOff": "Volné dny",

    // LOGIN
    "login.title": "Přihlášení do systému",
    "login.login": "Login",
    "login.password": "Heslo",
    "login.submit": "Přihlásit se",
    "login.error": "Nesprávný login nebo heslo.",

    // ADMIN
    "admin.title": "Administrace",
    "admin.welcome": "Vítejte,",
    "admin.employees": "Zaměstnanci",
    "admin.employeesDescription":
      "Přidávání, úprava a správa zaměstnanců.",
    "admin.vacations": "Dovolené",
    "admin.vacationsDescription":
      "Prohlížení a schvalování žádostí o dovolenou.",
    "admin.calendar": "Rozpis směn",
    "admin.calendarDescription":
      "Prohlížení směn a plánování práce týmu.",
    "admin.daysOff": "Volné dny",
    "admin.daysOffDescription":
      "Přidávání a správa dodatečných volných dnů.",

    // VACATIONS
    "vacation.title": "Plánování dovolené",
    "vacation.start": "Datum začátku",
    "vacation.end": "Datum konce",
    "vacation.days": "Pracovních dnů",
    "vacation.submit": "Odeslat žádost",
    "vacation.pending": "Čeká na schválení",
    "vacation.approved": "Schváleno",
    "vacation.rejected": "Zamítnuto",
    "vacation.conflict": "Existuje konflikt termínu",

    // CALENDAR
    "calendar.title": "Kalendář směn",
    "calendar.previous": "← Předchozí",
    "calendar.next": "Další →",
    "calendar.today": "Dnes",
    "calendar.dayOff": "VOLNO",
    "calendar.vacation": "D",
    "calendar.holiday": "Svátek",

    // DAYS OFF
    "daysOff.title": "Volné dny pro směny",

    // EMPLOYEE
    "employee.teamLeader": "TEAM LEADER",
    "employee.active": "Aktivní",
    "employee.inactive": "Neaktivní",

    // SHIFTS
    "shift.early": "Ranní",
    "shift.day": "Odpolední",
    "shift.night": "Noční",

    // STATUS
    "status.pending": "Čeká",
    "status.approved": "Schváleno",
    "status.rejected": "Zamítnuto",
  },
};

const LanguageContext =
  createContext<LanguageContextType | null>(null);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] =
    useState<Language>("uk");

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedLanguage =
      window.localStorage.getItem(
        "vacation-manager-language"
      );

    if (
      savedLanguage === "uk" ||
      savedLanguage === "cs"
    ) {
      setLanguageState(savedLanguage);
      setReady(true);
      return;
    }

    const browserLanguage =
      navigator.language.toLowerCase();

    if (browserLanguage.startsWith("cs")) {
      setLanguageState("cs");
    } else {
      setLanguageState("uk");
    }

    setReady(true);
  }, []);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);

    window.localStorage.setItem(
      "vacation-manager-language",
      nextLanguage
    );
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) =>
        translations[language][key] ?? key,
    }),
    [language]
  );

  if (!ready) {
    return (
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context =
    useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}