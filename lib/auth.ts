import { supabase } from "@/lib/supabase";

export async function getCurrentEmployee() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: employee,
    error,
  } = await supabase
    .from("employees")
    .select(
      `
        id,
        full_name,
        schedule_type,
        initial_shift,
        cycle_start_date,
        vacation_days_per_year,
        active,
        role,
        team_leader
      `
    )
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .single();

  if (error) {
    console.error(
      "GET CURRENT EMPLOYEE ERROR:",
      error
    );

    return null;
  }

  return employee;
}

export async function isAdmin() {
  const employee =
    await getCurrentEmployee();

  return employee?.role === "admin";
}