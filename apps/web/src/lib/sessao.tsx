import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '@cortemadepinus/shared';
import { api, armazenamento } from './api';

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<Usuario>;
  cadastrar: (dados: Record<string, unknown>) => Promise<{
    usuario: Usuario;
    aguardandoLiberacao: boolean;
    mensagem: string;
  }>;
  sair: () => void;
  atualizarUsuario: (usuario: Usuario) => void;
}

const ContextoSessao = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!armazenamento.lerToken()) {
      setCarregando(false);
      return;
    }
    api
      .eu()
      .then(({ usuario: perfil }) => setUsuario(perfil))
      .catch(() => armazenamento.limparToken())
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { token, usuario: perfil } = await api.login({ email, senha });
    armazenamento.gravarToken(token);
    setUsuario(perfil);
    return perfil;
  }, []);

  const cadastrar = useCallback(async (dados: Record<string, unknown>) => {
    const resposta = await api.registrar(dados);
    // Cadastro público não inicia sessão — admin precisa liberar o acesso.
    return {
      usuario: resposta.usuario,
      aguardandoLiberacao: resposta.aguardandoLiberacao !== false,
      mensagem:
        resposta.mensagem ??
        'Conta criada. Aguarde a liberação da central MadePinus para entrar no sistema.',
    };
  }, []);

  const sair = useCallback(() => {
    armazenamento.limparToken();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, cadastrar, sair, atualizarUsuario: setUsuario }),
    [usuario, carregando, entrar, cadastrar, sair],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao(): Sessao {
  const contexto = useContext(ContextoSessao);
  if (!contexto) throw new Error('useSessao precisa estar dentro de ProvedorSessao');
  return contexto;
}
