const CHAVE_EMAIL = 'madepinus.login.email';
const CHAVE_LEMBRAR = 'madepinus.login.lembrar';

/** Preferências de login no navegador (e-mail). A senha fica no gerenciador do browser. */
export const lembreteLogin = {
  lerEmail(): string {
    try {
      if (localStorage.getItem(CHAVE_LEMBRAR) !== '1') return '';
      return localStorage.getItem(CHAVE_EMAIL) ?? '';
    } catch {
      return '';
    }
  },

  lembrarAtivo(): boolean {
    try {
      return localStorage.getItem(CHAVE_LEMBRAR) === '1';
    } catch {
      return false;
    }
  },

  gravar(email: string, lembrar: boolean) {
    try {
      if (!lembrar) {
        localStorage.removeItem(CHAVE_EMAIL);
        localStorage.removeItem(CHAVE_LEMBRAR);
        return;
      }
      localStorage.setItem(CHAVE_LEMBRAR, '1');
      localStorage.setItem(CHAVE_EMAIL, email.trim());
    } catch {
      /* navegador sem storage */
    }
  },
};

/** Tenta gravar e-mail/senha no gerenciador de senhas do navegador (Chrome/Edge). */
export async function oferecerSalvarCredenciais(email: string, senha: string): Promise<void> {
  try {
    const PasswordCredentialCtor = (
      window as Window & {
        PasswordCredential?: new (dados: { id: string; password: string }) => Credential;
      }
    ).PasswordCredential;
    if (!PasswordCredentialCtor || !navigator.credentials?.store) return;
    const credencial = new PasswordCredentialCtor({ id: email.trim(), password: senha });
    await navigator.credentials.store(credencial);
  } catch {
    /* usuário recusou ou API indisponível — o autocomplete nativo cobre o resto */
  }
}

/** Preenche o formulário se o navegador tiver credencial salva. */
export async function tentarPreencherCredenciaisSalvas(): Promise<{
  email: string;
  senha: string;
} | null> {
  try {
    if (!navigator.credentials?.get) return null;
    const credencial = (await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as CredentialRequestOptions)) as (Credential & { id?: string; password?: string }) | null;
    if (!credencial?.id || !credencial.password) return null;
    return { email: credencial.id, senha: credencial.password };
  } catch {
    return null;
  }
}
