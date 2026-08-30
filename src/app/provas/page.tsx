import { redirect } from "next/navigation";

export default function ProvasRedirect() {
  redirect("/aulas?abrir=provas");
}
