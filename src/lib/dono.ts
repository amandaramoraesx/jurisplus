import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey } from "@/lib/firestore";

/**
 * Coleções pessoais: cada documento tem `uid` de quem criou e só essa pessoa vê.
 * Disciplinas, professores, aulas e provas continuam da turma (iguais pra todo mundo).
 */
export const COLECOES_PESSOAIS = ["presencas", "notas", "palestras", "grupos", "vademecum_favoritos"] as const;

/** Frequência é uma por pessoa, disciplina e dia — o id inclui o uid pra não colidir entre colegas. */
export function idPresenca(uid: string, disciplinaId: string, data: Date) {
  return `${uid}_${disciplinaId}_${dateOnlyKey(data)}`;
}

/** Garante que o documento pessoal é de quem está pedindo (ação de editar/apagar). */
export async function garantirDono(colecao: (typeof COLECOES_PESSOAIS)[number], id: string, uid: string) {
  const doc = await db.collection(colecao).doc(id).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    throw new Error("Esse registro não é seu.");
  }
  return doc;
}

const flagMigracao = () => db.collection("config").doc("migracao_dono_v1");
let migracaoConferida = false;

/**
 * Antes deste ajuste tudo era compartilhado e nada tinha dono. Na primeira vez que uma admin
 * entra, os registros pessoais sem `uid` passam a ser dela (presenças ganham id novo com uid).
 * Roda uma vez só (marca em config/migracao_dono_v1).
 */
export async function migrarDadosSemDono(uid: string) {
  if (migracaoConferida) return;
  const flag = await flagMigracao().get();
  if (flag.exists) {
    migracaoConferida = true;
    return;
  }

  type Op = (batch: FirebaseFirestore.WriteBatch) => void;
  const ops: Op[] = [];

  for (const colecao of COLECOES_PESSOAIS) {
    const snap = await db.collection(colecao).get();
    for (const doc of snap.docs) {
      const dados = doc.data();
      if (dados.uid) continue;
      if (colecao === "presencas") {
        const data: Date = dados.data?.toDate?.() ?? new Date(dados.data);
        const novoRef = db.collection("presencas").doc(idPresenca(uid, dados.disciplinaId, data));
        ops.push((b) => b.set(novoRef, { ...dados, uid }, { merge: true }));
        ops.push((b) => b.delete(doc.ref));
      } else {
        ops.push((b) => b.update(doc.ref, { uid }));
      }
    }
  }

  // Lote do Firestore aceita no máximo 500 operações.
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
  }

  await flagMigracao().set({ uid, migradoEm: new Date(), registros: ops.length });
  migracaoConferida = true;
}

const flagMigracaoV2 = () => db.collection("config").doc("migracao_individual_v2");
let migracaoV2Conferida = false;

function juntarTextos(...textos: (string | null | undefined)[]) {
  const unicos = [...new Set(textos.map((t) => t?.trim()).filter((t): t is string => Boolean(t)))];
  return unicos.length ? unicos.join("\n\n") : null;
}

/**
 * Aulas viraram individuais: cada aula guarda `participantes` (quem fez check-in, anotou ou criou)
 * e só eles a veem. O que ficava gravado na própria aula — anotação de antes do login, anexos,
 * resumo/quiz/mapa da IA — e o quiz da disciplina passam pro caderno de quem era dona dos dados
 * antigos (a admin que recebeu a migração v1). Roda uma vez (config/migracao_individual_v2).
 */
export async function migrarParaCadernoIndividual(user: { uid: string; nome: string | null; role: string }) {
  if (migracaoV2Conferida) return;
  const flagV2 = await flagMigracaoV2().get();
  if (flagV2.exists) {
    migracaoV2Conferida = true;
    return;
  }
  const v1 = await flagMigracao().get();
  const dono = (v1.data()?.uid as string | undefined) ?? (user.role === "admin" ? user.uid : null);
  if (!dono) return; // ninguém sabe ainda de quem são os dados antigos: espera a admin entrar

  // Trava: create() falha se outra requisição já começou a migração.
  try {
    await flagMigracaoV2().create({ status: "rodando", dono, iniciadoEm: new Date() });
  } catch {
    return;
  }

  try {
    const [aulasSnap, presencasSnap, disciplinasSnap] = await Promise.all([
      db.collection("aulas").get(),
      db.collection("presencas").get(),
      db.collection("disciplinas").get(),
    ]);

    const presentesPorAula = new Map<string, Set<string>>();
    for (const doc of presencasSnap.docs) {
      const p = doc.data();
      if (!p.uid) continue;
      const data: Date = p.data?.toDate?.() ?? new Date(p.data);
      const aulaId = `${p.disciplinaId}_${dateOnlyKey(data)}`;
      if (!presentesPorAula.has(aulaId)) presentesPorAula.set(aulaId, new Set());
      presentesPorAula.get(aulaId)!.add(p.uid);
    }

    type Op = (batch: FirebaseFirestore.WriteBatch) => void;
    const ops: Op[] = [];
    const apagar = FieldValue.delete();

    for (const aulaDoc of aulasSnap.docs) {
      const aula = aulaDoc.data();
      const anotacoesSnap = await aulaDoc.ref.collection("anotacoes").get();
      const participantes = new Set<string>(aula.participantes ?? []);
      for (const a of anotacoesSnap.docs) participantes.add(a.id);
      for (const uid of presentesPorAula.get(aulaDoc.id) ?? []) participantes.add(uid);

      const temLegado = Boolean(
        aula.resumo || aula.anotacoesLousa || aula.resumoIA || aula.quizIA?.length || aula.mapaMental || aula.anexos?.length
      );
      if (temLegado || participantes.size === 0) participantes.add(dono);

      if (temLegado) {
        const atual = anotacoesSnap.docs.find((d) => d.id === dono)?.data() ?? {};
        const caderno = aulaDoc.ref.collection("anotacoes").doc(dono);
        ops.push((b) =>
          b.set(
            caderno,
            {
              uid: dono,
              nome: atual.nome ?? (dono === user.uid ? user.nome : null) ?? "Admin",
              resumo: juntarTextos(atual.resumo, aula.resumo),
              anotacoesLousa: juntarTextos(atual.anotacoesLousa, aula.anotacoesLousa),
              resumoIA: atual.resumoIA ?? aula.resumoIA ?? null,
              quizIA: atual.quizIA ?? aula.quizIA ?? null,
              mapaMental: atual.mapaMental ?? aula.mapaMental ?? null,
              mapaMentalGeradoEm: atual.mapaMentalGeradoEm ?? aula.mapaMentalGeradoEm ?? null,
              anexos: [...(atual.anexos ?? []), ...(aula.anexos ?? [])],
              updatedAt: atual.updatedAt ?? new Date(),
            },
            { merge: true }
          )
        );
      }
      ops.push((b) =>
        b.update(aulaDoc.ref, {
          participantes: [...participantes],
          ...(temLegado
            ? { resumo: null, anotacoesLousa: null, resumoIA: null, quizIA: apagar, mapaMental: apagar, mapaMentalGeradoEm: apagar, anexos: apagar }
            : {}),
        })
      );
    }

    for (const discDoc of disciplinasSnap.docs) {
      const disc = discDoc.data();
      if (!disc.quizIA?.length) continue;
      const quiz = discDoc.ref.collection("quizzes").doc(dono);
      ops.push((b) => b.set(quiz, { uid: dono, quizIA: disc.quizIA, quizIAGeradoEm: disc.quizIAGeradoEm ?? new Date() }, { merge: true }));
      ops.push((b) => b.update(discDoc.ref, { quizIA: apagar, quizIAGeradoEm: apagar }));
    }

    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      for (const op of ops.slice(i, i + 450)) op(batch);
      await batch.commit();
    }

    await flagMigracaoV2().set({ status: "ok", dono, migradoEm: new Date(), operacoes: ops.length });
    migracaoV2Conferida = true;
  } catch (erro) {
    await flagMigracaoV2().delete().catch(() => {}); // libera pra tentar de novo na próxima entrada
    throw erro;
  }
}
