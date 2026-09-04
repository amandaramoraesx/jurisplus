import { createHash } from "crypto";
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";

export type Professor = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  createdAt: Date;
};

export type QuizPergunta = {
  pergunta: string;
  opcoes: string[];
  respostaCorreta: number;
  explicacao: string | null;
};

export type Disciplina = {
  id: string;
  nome: string;
  semestre: string;
  professorId: string | null;
  createdAt: Date;
  /** Dias da semana em que a disciplina tem aula (0=domingo...6=sábado, igual Date.getDay()). */
  diasSemana?: number[];
  /** Texto livre pra exibir o horário, ex: "19:10 às 20:25". */
  horario?: string | null;
  quizIA?: QuizPergunta[] | null;
  quizIAGeradoEm?: Date | null;
};

export type Anexo = {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  storagePath: string;
  /** ISO string (não Timestamp) pra evitar conversão de data em item de array. */
  criadoEm: string;
};

export type Aula = {
  id: string;
  disciplinaId: string;
  data: Date;
  tema: string;
  /** @deprecated Anotação global de antes das anotações virarem por login. Só leitura; ver subcoleção "anotacoes". */
  resumo: string | null;
  /** @deprecated Lousa global de antes das anotações virarem por login. Só leitura; ver subcoleção "anotacoes". */
  anotacoesLousa: string | null;
  resumoIA: string | null;
  createdAt: Date;
  quizIA?: QuizPergunta[] | null;
  anexos?: Anexo[];
};

/**
 * Anotação pessoal de um login numa aula (subcoleção `aulas/{aulaId}/anotacoes/{uid}`).
 * Por padrão é privada (só quem escreveu vê); só aparece pros colegas quando `compartilhado` é true.
 */
export type AnotacaoPessoal = {
  id: string;
  uid: string;
  nome: string;
  resumo: string | null;
  anotacoesLousa: string | null;
  compartilhado: boolean;
  updatedAt: Date;
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
  fonte?: string | null;
};

export type VadeMecumFavorito = {
  id: string;
  codigo: string;
  numero: string;
  texto: string;
  aulaId: string | null;
  createdAt: Date;
  fonte?: string | null;
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

const DATE_KEYS = ["data", "createdAt", "enviadoEm", "quizIAGeradoEm", "updatedAt"];

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

/** Nomes dos dias da semana, no mesmo índice de Date.getDay() (0=domingo...6=sábado). */
export const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
