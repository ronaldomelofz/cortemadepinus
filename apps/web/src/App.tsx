import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { LayoutApp } from './componentes/Layout';
import { Carregando } from './componentes/ui';
import { Cadastrar } from './paginas/Cadastrar';
import { DetalhePedido } from './paginas/DetalhePedido';
import { EditorPedido } from './paginas/EditorPedido';
import { Entrar } from './paginas/Entrar';
import { Inicio } from './paginas/Inicio';
import { MeusPedidos } from './paginas/MeusPedidos';
import { Perfil } from './paginas/Perfil';
import { ClientesAdmin } from './paginas/admin/ClientesAdmin';
import { CadastrosAdmin } from './paginas/admin/CadastrosAdmin';
import { PainelAdmin } from './paginas/admin/PainelAdmin';
import { PaginaImpressao } from './paginas/admin/PaginaImpressao';
import { PedidosAdmin } from './paginas/admin/PedidosAdmin';
import { useSessao } from './lib/sessao';

function Protegido({ children, somenteAdmin }: { children: ReactElement; somenteAdmin?: boolean }) {
  const { usuario, carregando } = useSessao();
  const local = useLocation();

  if (carregando) return <Carregando texto="Verificando acesso..." />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  if (somenteAdmin && usuario.role !== 'ADMIN') return <Navigate to="/app" replace />;
  if (!somenteAdmin && usuario.role === 'ADMIN' && local.pathname.startsWith('/app')) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/cadastrar" element={<Cadastrar />} />

      <Route
        path="/app"
        element={
          <Protegido>
            <LayoutApp />
          </Protegido>
        }
      >
        <Route index element={<MeusPedidos />} />
        <Route path="novo" element={<EditorPedido />} />
        <Route path="pedidos/:id" element={<DetalhePedido />} />
        <Route path="pedidos/:id/editar" element={<EditorPedido />} />
        <Route path="perfil" element={<Perfil />} />
      </Route>

      <Route
        path="/admin"
        element={
          <Protegido somenteAdmin>
            <LayoutApp />
          </Protegido>
        }
      >
        <Route index element={<PainelAdmin />} />
        <Route path="pedidos" element={<PedidosAdmin />} />
        <Route path="pedidos/:id" element={<DetalhePedido />} />
        <Route path="clientes" element={<ClientesAdmin />} />
        <Route path="cadastros" element={<CadastrosAdmin />} />
      </Route>

      <Route
        path="/admin/pedidos/:id/imprimir/:tipo"
        element={
          <Protegido somenteAdmin>
            <PaginaImpressao />
          </Protegido>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
