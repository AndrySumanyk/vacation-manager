import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          error:
            "Не знайдено NEXT_PUBLIC_SUPABASE_URL.",
        },
        { status: 500 }
      );
    }

    if (!supabasePublishableKey) {
      return NextResponse.json(
        {
          error:
            "Не знайдено NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        },
        { status: 500 }
      );
    }

    if (!supabaseSecretKey) {
      return NextResponse.json(
        {
          error:
            "Не знайдено SUPABASE_SECRET_KEY.",
        },
        { status: 500 }
      );
    }

    /*
      ==========================================
      1. Перевіряємо авторизацію поточного користувача
      ==========================================
    */

    const authorization =
      request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        {
          error:
            "Ви не авторизовані.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Не знайдено токен авторизації.",
        },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      supabasePublishableKey
    );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Недійсна авторизація.",
        },
        { status: 401 }
      );
    }

    /*
      ==========================================
      2. Перевіряємо, що користувач є адміном
      ==========================================
    */

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseSecretKey
    );

    const {
      data: currentEmployee,
      error: employeeError,
    } =
      await supabaseAdmin
        .from("employees")
        .select(
          "id, full_name, role, active"
        )
        .eq(
          "auth_user_id",
          user.id
        )
        .eq(
          "active",
          true
        )
        .single();

    if (
      employeeError ||
      !currentEmployee
    ) {
      return NextResponse.json(
        {
          error:
            "Ваш профіль працівника не знайдено.",
        },
        { status: 403 }
      );
    }

    if (
      currentEmployee.role !==
      "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Тільки адміністратор може створювати працівників.",
        },
        { status: 403 }
      );
    }

    /*
      ==========================================
      3. Отримуємо дані нового користувача
      ==========================================
    */

    const body =
      await request.json();

    const login = String(
      body.login ?? ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body.password ?? ""
    );

    if (!login) {
      return NextResponse.json(
        {
          error:
            "Логін обов'язковий.",
        },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          error:
            "Пароль обов'язковий.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Пароль має містити щонайменше 6 символів.",
        },
        { status: 400 }
      );
    }

    /*
      ==========================================
      4. Перевіряємо, чи такий логін вже існує
      ==========================================
    */

    const email =
      `${login}@vacation-manager.local`;

    const {
      data: existingUsers,
      error: listUsersError,
    } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listUsersError) {
      console.error(
        "LIST USERS ERROR:",
        listUsersError
      );

      return NextResponse.json(
        {
          error:
            "Не вдалося перевірити існуючі акаунти.",
        },
        { status: 500 }
      );
    }

    const loginAlreadyExists =
      existingUsers.users.some(
        (existingUser) =>
          existingUser.email
            ?.toLowerCase() ===
          email.toLowerCase()
      );

    if (loginAlreadyExists) {
      return NextResponse.json(
        {
          error:
            "Такий логін вже існує.",
        },
        { status: 400 }
      );
    }

    /*
      ==========================================
      5. Створюємо Auth-користувача
      ==========================================
    */

    const {
      data,
      error,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            login,
            role: "employee",
          },
        }
      );

    if (error) {
      console.error(
        "SUPABASE CREATE USER ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 400 }
      );
    }

    /*
      ==========================================
      6. Повертаємо ID створеного користувача
      ==========================================
    */

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      login,
    });
  } catch (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Помилка сервера.",
      },
      { status: 500 }
    );
  }
}