import { redirect } from "next/navigation";

export default function NotasRedirect() {
  redirect("/aulas?abrir=notas");
}
