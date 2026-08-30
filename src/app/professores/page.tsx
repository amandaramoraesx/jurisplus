import { redirect } from "next/navigation";

export default function ProfessoresRedirect() {
  redirect("/aulas?abrir=professores");
}
