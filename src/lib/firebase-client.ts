"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Config pública do Firebase (não é segredo — a segurança vem do Auth em si,
// não de esconder essa chave). Precisa dos prefixos NEXT_PUBLIC_ pra o
// Next.js incluir no bundle do navegador.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const clientAuth = getAuth(app);
