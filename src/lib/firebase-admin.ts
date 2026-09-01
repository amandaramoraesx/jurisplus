import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

function buildApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase não configuradas. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env."
    );
  }

  // Bucket padrão de projetos novos do Firebase; se o bucket real for
  // diferente (projeto mais antigo), defina FIREBASE_STORAGE_BUCKET no .env
  // com o nome exato mostrado em Console do Firebase > Storage.
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

function lazyApp<T extends object>(get: (app: ReturnType<typeof getApps>[number]) => T): T {
  let instance: T | undefined;
  function resolve(): T {
    if (!instance) {
      instance = get(getApps()[0] ?? buildApp());
    }
    return instance;
  }

  // Proxy adia a inicialização (e a checagem de credenciais) para o primeiro uso
  // real em runtime, em vez do momento em que o módulo é importado — necessário
  // porque o Next.js importa route handlers durante o build para coletar
  // metadados, sem de fato invocar GET/POST.
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const value = Reflect.get(resolve() as object, prop, receiver);
      return typeof value === "function" ? value.bind(resolve()) : value;
    },
  });
}

export const db: Firestore = lazyApp((app) => getFirestore(app));
export const auth: Auth = lazyApp((app) => getAuth(app));
export const storage: Storage = lazyApp((app) => getStorage(app));
