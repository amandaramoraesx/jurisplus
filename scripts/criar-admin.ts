import "dotenv/config";
import { auth } from "../src/lib/firebase-admin";

async function main() {
  const [, , email, senha, nome] = process.argv;

  if (!email || !senha || !nome) {
    console.error("Uso: tsx scripts/criar-admin.ts <email> <senha> <nome>");
    process.exit(1);
  }

  const existente = await auth.getUserByEmail(email).catch(() => null);
  if (existente) {
    await auth.setCustomUserClaims(existente.uid, { role: "admin" });
    console.log(`Usuário já existia (${existente.uid}) — papel definido como admin.`);
    return;
  }

  const user = await auth.createUser({ email, password: senha, displayName: nome });
  await auth.setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`Conta admin criada: ${user.uid} (${email})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
