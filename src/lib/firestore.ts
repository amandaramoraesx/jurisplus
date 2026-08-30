import { createHash } from "crypto";
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";

export type Professor = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  createdAt: Date;
};

export type Disciplina = {
  id: string;
  nome: string;
  semestre: string;
  professorId: string | null;
  createdAt: Date;
};

export type Aula = {
  id: string;
  disciplinaId: string;
  data: Date;
  tema: string;
  resumo: string | null;
  anotacoesLousa: string | null;
  resumoIA: string | null;
  createdAt: Date;
};

export type Presenca = {
  id: string;
  disciplinaId: string;
  data: Date;
  presente: boolean;
  createdAt: Date;
};

export type Nota = {
  id: string;
  disciplinaId: string;
  descricao: string;
  valor: number;
  createdAt: Date;
};

export type Prova = {
  id: string;
  disciplinaId: string;
  data: Date;
  conteudo: string | null;
  createdAt: Date;
};

export type Palestra = {
  id: string;
  tema: string;
  palestrante: string | null;
  resumo: string | null;
  data: Date;
  horas: number;
  local: string | null;
  createdAt: Date;
};

export type Integrante = { id: string; nome: string };

export type Grupo = {
  id: string;
  tema: string;
  disciplinaId: string | null;
  data: Date;
  apresentacao: string | null;
  integrantes: Integrante[];
  createdAt: Date;
};

export type VadeMecumArtigo = {
  id: string;
  codigo: string;
  numero: string;
  texto: string;
};

export type VadeMecumFavorito = {
  id: string;
  codigo: string;
  numero: string;
  texto: string;
  aulaId: string | null;
  createdAt: Date;
};

export type PushSubscriptionDoc = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
};

export type LembreteEnviado = {
  id: string;
  provaId: string;
  dias: number;
  enviadoEm: Date;
};

const DATE_KEYS = ["data", "createdAt", "enviadoEm"];

function toPlain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  return value;
}

/** Converte um snapshot do Firestore em objeto plano, com Timestamps virando Date. */
export function fromDoc<T>(doc: DocumentSnapshot): T {
  const data = doc.data();
  if (!data) throw new Error(`Documento ${doc.ref.path} não existe`);
  const out: Record<string, unknown> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    out[key] = DATE_KEYS.includes(key) ? toPlain(value) : value;
  }
  return out as T;
}

/** ID determinístico "YYYY-MM-DD" para uma data sem hora, usado em chaves compostas. */
export function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Doc IDs do Firestore não podem conter "/", então endpoints de push (URLs) precisam de hash. */
export function hashEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}
