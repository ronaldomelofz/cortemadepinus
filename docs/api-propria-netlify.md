# API própria no servidor MadePinus + Netlify

O site <https://cortemadepinus.netlify.app> é só a interface (HTML/JS).
A **API MadePinus** já é do sistema (`apps/api`) e deve rodar **no seu servidor**
(PC da oficina, VPS ou Docker). O Netlify só precisa conhecer a URL pública HTTPS
dessa API.

```
Cliente → Netlify (site) → HTTPS → API no seu servidor (:4000) → SQLite + anexos
```

---

## O que já existe no projeto

| Peça | Onde |
| --- | --- |
| API Express + JWT + Prisma | `apps/api` |
| Docker Compose | `docker-compose.yml` |
| Serviço Windows 24/7 | `scripts/configurar-servidor-windows.ps1` + `instalar-servico-windows.ps1` |
| Integração Netlify | `scripts/integrar-api-netlify.ps1` |
| Tunel MadePinus 24/7 | `scripts/instalar-tunel-madepinus.ps1` + [tunel-madepinus-24x7.md](tunel-madepinus-24x7.md) |
| Expor API em HTTPS (teste) | `scripts/expor-api-https.ps1` |

---

## Passo a passo (servidor Windows da MadePinus)

### 1. Preparar a API no servidor

No PowerShell **como Administrador**, na pasta do repositório:

```powershell
.\scripts\configurar-servidor-windows.ps1 -SenhaAdmin 'SuaSenhaForte123'
.\scripts\instalar-servico-windows.ps1
```

Teste local:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/saude
```

Deve retornar `"ok": true`.

O `.env` da API (`apps/api/.env`) já deve incluir:

```
CORS_ORIGINS=https://cortemadepinus.netlify.app,http://localhost:5173
```

### 2. Expor a API em HTTPS (internet)

O Netlify (HTTPS) **não** pode chamar `http://localhost`. Precisa de uma URL pública HTTPS.

**Opção A — Tunel MadePinus 24/7 (recomendada, gratuita)**

Hostname **fixo** + serviço Windows (sobe no boot). Guia: [tunel-madepinus-24x7.md](tunel-madepinus-24x7.md)

```powershell
# 1) Crie o tunel nomeado no painel Cloudflare e grave no .env:
#    TUNNEL_TOKEN=...
#    API_PUBLIC_URL=https://api.seudominio.com.br
.\scripts\instalar-servico-windows.ps1
.\scripts\instalar-tunel-madepinus.ps1 -IntegrarNetlify
.\scripts\status-tunel-madepinus.ps1
```

URL temporaria (`expor-api-https.ps1` / ngrok) serve so para teste — nao e 24/7.

**Opção B — VPS + Coolify + domínio** (`api.seudominio.com.br`)

Guia completo: [api-coolify-vps.md](api-coolify-vps.md)

**Opção C — Docker no servidor**

```powershell
copy .env.example .env
# edite JWT_SECRET, ADMIN_SENHA, CORS_ORIGINS
docker compose up -d --build
```

### 3. Ligar o Netlify à sua API

Com a URL HTTPS da API em mãos (ex.: `https://api.madepinus.com.br`):

```powershell
.\scripts\integrar-api-netlify.ps1 -ApiUrl 'https://SUA-URL-HTTPS'
```

O script:

1. Grava `VITE_API_URL` no projeto Netlify **cortemadepinus**
2. Faz build + deploy de produção do front

Site: <https://cortemadepinus.netlify.app>

---

## Checklist

- [ ] `http://127.0.0.1:4000/saude` responde no servidor
- [ ] Serviço Windows ou Docker mantém a API no ar
- [ ] URL pública HTTPS aponta para a API
- [ ] `CORS_ORIGINS` inclui `https://cortemadepinus.netlify.app`
- [ ] Netlify `VITE_API_URL` = essa URL HTTPS (sem barra no fim)
- [ ] Login em <https://cortemadepinus.netlify.app/entrar> funciona **com o PC da oficina ligado** (túnel) ou **24/7 na VPS**

---

## Segurança

- Use HTTPS (túnel ou domínio). Não publique a porta 4000 aberta na internet sem proxy.
- Troque `ADMIN_SENHA` e `JWT_SECRET`.
- URLs `*.ngrok-free.dev` / `*.trycloudflare.com` são úteis para teste; para produção use domínio próprio.
