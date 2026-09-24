/**
 * A regra de senha do InventExpert, em um lugar só.
 *
 * Duas telas gravam senha — cadastro e redefinição — e regra duplicada vira
 * regra divergente: a pessoa escolhe uma senha que uma tela aceita e a outra
 * recusa. O texto de instrução sai daqui pelo mesmo motivo. O do cadastro
 * prometia "máximo de 8 caracteres" e exigia símbolo enquanto a validação ao
 * lado pedia mínimo 8 e nenhum símbolo; foi assim que uma conta real acabou
 * com senha de 7 caracteres, curta demais para a regra que valia de fato.
 */

/** Por que a senha foi recusada. `null` = aceita. */
export type FalhaDeSenha = "curta" | "longa" | "sem_letra" | "sem_numero";

export const SENHA_MIN = 8;

/**
 * Acima de 72 bytes o bcrypt trunca sem avisar: a senha seria gravada pela
 * metade e a pessoa não conseguiria entrar com o que digitou.
 */
export const SENHA_MAX = 72;

/** A regra em uma frase, para instruir antes de recusar. */
export const REGRA_DE_SENHA = `No mínimo ${SENHA_MIN} caracteres, com pelo menos uma letra e um número.`;

export function validarSenha(senha: string): FalhaDeSenha | null {
  if (senha.length < SENHA_MIN) return "curta";
  if (senha.length > SENHA_MAX) return "longa";
  if (!/[a-zA-Z]/.test(senha)) return "sem_letra";
  if (!/[0-9]/.test(senha)) return "sem_numero";
  return null;
}

export function mensagemDeSenha(falha: FalhaDeSenha): string {
  switch (falha) {
    case "curta":
      return `A senha precisa ter no mínimo ${SENHA_MIN} caracteres.`;
    case "longa":
      return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
    case "sem_letra":
      return "A senha precisa ter pelo menos uma letra.";
    case "sem_numero":
      return "A senha precisa ter pelo menos um número.";
  }
}
