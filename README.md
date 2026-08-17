# MadePinus · Central de Serviços de Corte

Plataforma web onde os clientes da MadePinus enviam **planos de corte (medidas)** para a central de
serviços. As peças são lançadas na tela, coladas do Excel ou importadas de um arquivo, e a central
baixa o arquivo **já no layout oficial do software Corte Certo**, pronto para otimizar e cortar na
seccionadora.

- Site (front-end): <https://cortemadepinus.netlify.app>
- Código: <https://github.com/ronaldomelofz/cortemadepinus>
- Licença: MIT · 100% software livre

---

## Sumário

1. [Como funciona](#como-funciona)
2. [Arquitetura](#arquitetura)
3. [Stack](#stack-tudo-open-source)
4. [Formato Corte Certo](#formato-corte-certo)
5. [Rodando na sua máquina](#rodando-na-sua-máquina)
6. [24/7 no Windows](#247-no-windows-sem-docker-e-sem-custo)
7. [Servidor local com Docker](#servidor-local-com-docker)
8. [Expondo a API para a internet](#expondo-a-api-para-a-internet)
9. [Deploy no Netlify](#deploy-no-netlify)
10. [Referência da API](#referência-da-api)
11. [Backup e manutenção](#backup-e-manutenção)

---

## Como funciona

| Etapa | Quem faz | O que acontece |
| --- | --- | --- |
| 1. Cadastro | Cliente | Cria conta com nome, e-mail, telefone e empresa. |
| 2. Materiais | Cliente | Informa cada chapa: código, descrição, espessura, cor e dimensões. |
| 3. Peças | Cliente | Digita as medidas, cola do Excel (Ctrl+V na tabela) ou importa CSV/TXT. |
| 4. Envio | Cliente | O pedido sai de *Rascunho* para *Enviado* e trava a edição. |
| 5. Análise | Central | Baixa o CSV Corte Certo, otimiza, informa o orçamento. |
| 6. Produção | Central | Atualiza o status até *Pronto para retirada* / *Entregue*. |

Os status disponíveis são: `RASCUNHO → ENVIADO → EM_ANALISE → ORCAMENTO_ENVIADO → APROVADO →
EM_PRODUCAO → PRONTO → ENTREGUE` (com `CANCELADO` acessível na maioria das etapas). As transições são
validadas no servidor.

## Arquitetura

```
┌──────────────────────────┐        HTTPS/JSON        ┌───────────────────────────────┐
│  Netlify (CDN global)    │ ───────────────────────► │  Servidor local MadePinus     │
│  React + Vite (SPA)      │                          │                               │
│  cortemadepinus.netlify  │ ◄─────────────────────── │  API Node/Express (:4000)     │
└──────────────────────────┘                          │  SQLite (arquivo local)       │
             ▲                                        │  Anexos em disco              │
             │ deploy automático                      └───────────────────────────────┘
      ┌──────┴───────┐                                              ▲
      │   GitHub     │                                              │
      └──────────────┘                             Cloudflare Tunnel (sem abrir porta)
```

O front-end é estático e não guarda dado nenhum: todo o banco fica **no seu servidor**. O navegador
fala com a API pela URL configurada em `VITE_API_URL`.

## Stack (tudo open source)

| Camada | Tecnologia | Licença | Custo |
| --- | --- | --- | --- |
| Front-end | React 18, Vite 6, React Router 7, Tailwind CSS 4 | MIT | zero |
| API | Node.js 20, Express 4, Zod, JWT, Multer | MIT | zero |
| Banco | **SQLite** (arquivo no servidor) + Prisma ORM | domínio público / Apache-2.0 | **zero** |
| Infra 24/7 | Agendador de Tarefas do Windows + Cloudflare Tunnel | nativo / Apache-2.0 | **zero** |
| Hospedagem do site | Netlify (plano gratuito) | — | **zero** |

O banco padrão é o **SQLite**: um único arquivo (`apps/api/dados/cortemadepinus.db`), sem senha,
sem serviço extra e sem mensalidade. PostgreSQL continua disponível se você já tiver um, mas não
é necessário.

Estrutura do monorepo:

```
apps/
  api/       API Express + Prisma (roda no servidor local)
  web/       SPA React publicada no Netlify
packages/
  shared/    Tipos, validações Zod, cálculos e leitura/escrita Corte Certo
docker-compose.yml
netlify.toml
```

O pacote `shared` é o coração da regra de negócio: ele é usado tanto pelo navegador (validação
instantânea enquanto o cliente digita) quanto pela API (validação definitiva antes de gravar).

## Formato Corte Certo

O Corte Certo importa listas de peças em **CSV com seis campos por linha, separados por vírgula**:

| Ordem | Campo | Tipo | Exemplo |
| --- | --- | --- | --- |
| 1 | Código da peça | numérico | `45` |
| 2 | Quantidade | numérico | `20` |
| 3 | Largura da peça | numérico | `340` |
| 4 | Altura da peça | numérico | `400` |
| 5 | Código do material | numérico | `99000` |
| 6 | Descrição da peça | texto | `Fundo do armário` |

```csv
1,4,700,350,99000,Lateral armario superior
2,2,1200,350,99000,Fundo armario superior
3,6,397,700,99001,Porta
```

No Corte Certo: **Projetos → Importar → escolher o arquivo → Continuar**.

A plataforma gera três arquivos por pedido:

| Arquivo | Uso |
| --- | --- |
| `PEDxxxxx-projeto.cortecerto.csv` | Importação direta no Corte Certo (6 campos, vírgula). |
| `PEDxxxxx-projeto.cortecerto.txt` | Mesmo conteúdo em TAB, com 7º campo livre (`FITA C1+L2 | VEIO LARGURA`). |
| `PEDxxxxx-projeto.producao.csv` | Planilha para o chão de fábrica: fita de borda, veio, cor, espessura e áreas. |

Descrições são normalizadas automaticamente (sem acento, sem vírgula, até 60 caracteres) para não
quebrar a leitura do arquivo.

**Importação**: a plataforma aceita CSV, TXT e colagem direta do Excel. O separador (`,`, `;` ou TAB)
é detectado sozinho, linhas de comentário iniciadas por `/` ou `#` são ignoradas — como nos arquivos
gerados pelo próprio Corte Certo — e o cabeçalho da planilha também.

### Fita de borda e veio

O layout oficial do Corte Certo não tem campo para fita de borda. A plataforma resolve assim:

- `C1` e `C2` são as bordas cujo comprimento é a **largura** da peça;
- `L1` e `L2` são as bordas cujo comprimento é a **altura** da peça;
- a metragem linear é calculada e exibida no resumo;
- a informação viaja no 7º campo do TXT e na planilha de produção.

O veio (`INDIFERENTE`, `COMPRIMENTO`, `LARGURA`) é usado na validação: uma peça sem veio pode ser
girada para caber na chapa; com veio definido, não.

## Rodando na sua máquina

Pré-requisito: **Node.js 20+**. O banco SQLite é criado automaticamente — não instale PostgreSQL.

```bash
git clone https://github.com/ronaldomelofz/cortemadepinus.git
cd cortemadepinus
npm install
```

### 1. Variáveis de ambiente

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Gere um segredo forte e cole em `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Criar o banco SQLite e o administrador

```bash
npm run prisma:deploy -w @cortemadepinus/api   # cria apps/api/dados/cortemadepinus.db
npm run seed -w @cortemadepinus/api            # cria o admin e um pedido de exemplo
```

O seed cria:

- **Administrador**: o e-mail/senha definidos em `ADMIN_EMAIL` / `ADMIN_SENHA`;
- **Cliente de teste** (só fora de produção): `cliente@exemplo.com.br` / `cliente12345`.

> Troque a senha do administrador antes de expor o sistema.

### 3. Subir tudo

```bash
npm run dev
```

- API: <http://localhost:4000> (health check em `/saude`)
- Site: <http://localhost:5173>

Testes da regra de negócio (layout Corte Certo, importação, cálculos):

```bash
npm test -w @cortemadepinus/shared
```

## 24/7 no Windows (sem Docker e sem custo)

O site no Netlify já fica no ar o tempo todo. Para os clientes enviarem pedidos de madrugada, a
**API também precisa estar ligada** no servidor da MadePinus.

```powershell
.\scripts\configurar-servidor-windows.ps1 -SenhaAdmin 'UmaSenhaForte123'
.\scripts\instalar-servico-windows.ps1
```

A segunda linha registra uma tarefa nativa do Windows: a API sobe no boot, reinicia sozinha se
cair e grava log em `apps/api/dados/api.log`. Deixe o computador da central ligado (ou use um
mini-PC que não desliga).

## Servidor local com Docker

O `docker-compose.yml` sobe a API com SQLite, backup diário do arquivo e (opcional) o túnel:

```bash
cp .env.example .env      # ajuste JWT_SECRET, CORS_ORIGINS e ADMIN_SENHA
docker compose up -d
docker compose logs -f api
```

| Serviço | Descrição |
| --- | --- |
| `api` | SQLite + API na porta 4000. |
| `backup` | Cópia diária de `cortemadepinus.db` em `./backups` (14 dias). |
| `tunel` | Cloudflare Tunnel (perfil `tunel`, só sobe se você pedir). |

## Expondo a API para a internet

O site fica no Netlify, então o navegador do cliente precisa alcançar a API do seu servidor. A forma
recomendada é o **Cloudflare Tunnel**: ele cria uma saída HTTPS sem abrir porta no roteador e sem IP
fixo.

1. Em <https://one.dash.cloudflare.com> → **Networks → Tunnels → Create a tunnel** (Cloudflared).
2. Copie o token gerado para `TUNNEL_TOKEN` no `.env`.
3. Configure o *public hostname*, por exemplo `api.cortemadepinus.com.br` → `http://api:4000`.
4. Suba o túnel:

```bash
docker compose --profile tunel up -d
```

5. No Netlify, defina `VITE_API_URL=https://api.cortemadepinus.com.br` e refaça o deploy.
6. No `.env` do servidor, garanta `CORS_ORIGINS=https://cortemadepinus.netlify.app`.

Alternativas: `ngrok`, `frp` ou redirecionamento de porta com DDNS + Let's Encrypt. Em qualquer caso
a API precisa responder em **HTTPS**, senão o navegador bloqueia a chamada vinda do Netlify.

## Deploy no Netlify

O `netlify.toml` já traz tudo configurado. Ao conectar o repositório:

| Campo | Valor |
| --- | --- |
| Base directory | *(vazio, raiz do repositório)* |
| Build command | `npm run build` |
| Publish directory | `apps/web/dist` |
| Node version | 20 |

Em **Site configuration → Environment variables**, adicione:

```
VITE_API_URL = https://api.cortemadepinus.com.br
```

Cada push na branch `main` gera um novo deploy. O redirecionamento SPA (`/* → /index.html 200`) já
está no `netlify.toml` e em `apps/web/public/_redirects`.

Pela CLI:

```bash
npm i -g netlify-cli
netlify login
netlify link            # escolha o projeto cortemadepinus
netlify env:set VITE_API_URL https://api.cortemadepinus.com.br
netlify deploy --build --prod
```

## Referência da API

Autenticação por **Bearer token** (JWT). Downloads aceitam `?token=` na query string.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/auth/registrar` | Cria conta de cliente. |
| `POST` | `/api/auth/login` | Retorna token + perfil. |
| `GET` | `/api/auth/eu` | Perfil autenticado. |
| `PUT` | `/api/auth/eu` | Atualiza dados cadastrais. |
| `GET` | `/api/pedidos` | Lista os pedidos do cliente (filtros `status`, `busca`, `pagina`). |
| `POST` | `/api/pedidos` | Cria pedido (rascunho) com materiais e peças. |
| `GET` | `/api/pedidos/:id` | Pedido completo + resumo calculado. |
| `PUT` | `/api/pedidos/:id` | Substitui materiais e peças (só em rascunho). |
| `DELETE` | `/api/pedidos/:id` | Exclui rascunho. |
| `POST` | `/api/pedidos/:id/enviar` | Envia para a central. |
| `POST` | `/api/pedidos/:id/mensagens` | Mensagem no pedido. |
| `POST` | `/api/pedidos/:id/anexos` | Upload (até 10 arquivos, 20 MB cada). |
| `GET` | `/api/pedidos/:id/anexos/:anexoId` | Download de anexo. |
| `GET` | `/api/pedidos/:id/exportar/csv` | CSV no layout Corte Certo. |
| `GET` | `/api/pedidos/:id/exportar/txt` | TXT (TAB) com observações. |
| `GET` | `/api/pedidos/:id/exportar/producao` | Planilha de produção. |
| `GET` | `/api/admin/painel` | Indicadores da central. |
| `GET` | `/api/admin/pedidos` | Todos os pedidos, com filtros. |
| `PATCH` | `/api/admin/pedidos/:id/status` | Muda status e registra orçamento. |
| `GET` | `/api/admin/clientes` | Lista clientes. |
| `PATCH` | `/api/admin/clientes/:id` | Ativa/desativa cliente. |
| `GET` | `/saude` | Health check (usado pelo túnel e pelo monitoramento). |

Extensões aceitas em anexos: `pdf, png, jpg, jpeg, webp, csv, txt, xls, xlsx, dxf, dwg, zip`.

## Backup e manutenção

```bash
# Backup manual (o banco inteiro é um arquivo)
copy apps\api\dados\cortemadepinus.db backups\cortemadepinus-%DATE%.db

# Ver as tabelas pela interface do Prisma (gratuita)
npm run prisma:studio -w @cortemadepinus/api
```

Os anexos ficam em `apps/api/uploads` — copie essa pasta junto com o arquivo `.db`.

### Checklist de segurança antes de abrir para os clientes

- [ ] `JWT_SECRET` aleatório e com 48 bytes.
- [ ] `ADMIN_SENHA` trocada e o login de exemplo removido.
- [ ] `CORS_ORIGINS` apontando só para o domínio do Netlify.
- [ ] API atrás de HTTPS (túnel ou proxy reverso com Let's Encrypt).
- [ ] Backup diário validado (teste uma restauração).
