import { supabase } from "@/lib/supabase";
export default async function TestDb() { const { data: employees, error } = await supabase .from("employees") .select("full_name, schedule_type, initial_shift, active") .order("full_name");
if (error) { return ( <main style={{ padding: "40px" }}> <h1>Помилка Supabase</h1> <p>{error.message}</p> </main> ); }
return ( <main style={{ padding: "40px" }}> <h1>Працівники з бази</h1>

JavaScript
  <p>
    Знайдено працівників: <strong>{employees?.length ?? 0}</strong>
  </p>

  {employees?.map((employee) => (
    <div key={employee.full_name} style={{ marginTop: "10px" }}>
      {employee.full_name} — {employee.schedule_type} —{" "}
      {employee.initial_shift}
    </div>
  ))}
</main>
); }