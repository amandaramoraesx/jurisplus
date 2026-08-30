import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function buildApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase não configuradas. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let firestore: Firestore | undefined;

function getDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getApps()[0] ?? buildApp());
  }
  return firestore;
}

// Proxy adia a inicialização (e a checagem de credenciais) para o primeiro uso
// real em runtime, em vez do momento em que o módulo é importado — necessário
// porque o Next.js importa route handlers durante o build para coletar
// metadados, sem de fato invocar GET/POST.
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb(), prop, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});
