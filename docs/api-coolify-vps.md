# API 24/7 em VPS + Coolify (recomendado)

O site <https://cortemadepinus.netlify.app> fica no Netlify. Login, pedidos e anexos ficam na
**API**. Para o site funcionar com o computador da MadePinus desligado, a API precisa rodar numa
máquina na nuvem.

Esta receita usa uma **VPS barata (Ubuntu)** + **[Coolify](https://coolify.io/)** (PaaS open source,
Apache-2.0): painel web, Docker Compose, HTTPS com Let's Encrypt. O código continua o mesmo
(Docker + SQLite).

A Oracle Always Free (Ampere) **não é recomendada** para este projeto: em São Paulo costuma falhar
com *Out of capacity*. Guia antigo: [api-oracle-cloud.md](api-oracle-cloud.md).

---

## O que você vai ter no fim

```
Cliente  →  Netlify (site)  →  HTTPS  →  VPS (Coolify + Traefik)  →  API Docker (SQLite)
```

- Site: já está no ar
- API: Ubuntu na VPS, Docker via Coolify, porta 4000 só na rede interna
- HTTPS: certificado automático (domínio apontando para o IP da VPS)

---

## 1. Criar a VPS

Qualquer provedor com **Ubuntu 24.04**, IP público e SSH serve. Sugestões:

| Provedor | Por quê |
| --- | --- |
| [Hetzner Cloud](https://www.hetzner.com/cloud) | Bom preço (€) |
| [DigitalOcean](https://www.digitalocean.com/) | Tem datacenter em São Paulo (menor latência) |
| [Contabo](https://contabo.com/) | Barato; conferir localização do datacenter |

**Tamanho mínimo para MadePinus + Coolify:**

| Recurso | Mínimo | Ideal |
| --- | --- | --- |
| vCPU | 2 | 2–4 |
| RAM | 2 GB | **4 GB** |
| Disco | 40 GB SSD | 40–80 GB |
| SO | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

1. Crie a conta no provedor e uma VM Ubuntu 24.04.
2. Anote o **IP público**.
3. Guarde a senha root **ou** a chave SSH (como em `CHAVES/`).

No PowerShell (Windows):

```powershell
ssh root@IP_PUBLICO
```

(Se o provedor criar usuário `ubuntu` com sudo: `ssh ubuntu@IP_PUBLICO` e use `sudo` nos
comandos.)

---

## 2. Abrir portas no firewall da VPS

No painel do provedor (Firewall / Security Group), libere:

| Porta | Uso |
| --- | --- |
| 22 | SSH |
| 80 | HTTP (Let's Encrypt + redirect) |
| 443 | HTTPS (API pública) |
| 8000 | Painel Coolify (pode restringir ao seu IP depois) |

**Não** abra a porta 4000 para a internet: o Coolify/Traefik faz o proxy HTTPS.

---

## 3. Instalar o Coolify

Como root na VPS (instalação oficial):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Espere 2–5 minutos. No fim, o script mostra a URL do painel, em geral:

```
http://IP_PUBLICO:8000
```

Abra no navegador, crie o **usuário admin** (e-mail + senha fortes) e guarde esses dados.

Documentação: <https://coolify.io/docs>

---

## 4. Domínio para a API

Você precisa de um hostname HTTPS, por exemplo `api.seudominio.com.br`.

1. No DNS do domínio (Cloudflare, Registro.br, etc.), crie um registro **A**:
   - Nome: `api`
   - Valor: **IP público da VPS**
   - Proxy Cloudflare: **desligado** (cinza) na primeira vez — Let's Encrypt precisa ver o IP real.
2. Espere a propagação (pode levar alguns minutos).

Sem domínio próprio: use o túnel Cloudflare na VPS (passo opcional no final deste guia).

---

## 5. Subir a API no Coolify

No painel Coolify (`http://IP:8000`):

1. **Servers** — o servidor local (`localhost`) já deve aparecer como configurado.
2. **Projects** → **Add** → nome `madepinus`.
3. Dentro do projeto → **Add Resource** → **Docker Compose**.
4. Conecte o repositório GitHub `ronaldomelofz/cortemadepinus` (ou cole a URL pública).
5. Aponte o arquivo para `docker-compose.yml` na raiz do repo.
6. Em **Environment Variables**, defina (obrigatório):

```
JWT_SECRET=cole-aqui-uma-chave-longa
ADMIN_SENHA=uma-senha-forte-do-admin
CORS_ORIGINS=https://cortemadepinus.netlify.app
ADMIN_EMAIL=admin@madepinus.com.br
ADMIN_NOME=Central de Servicos MadePinus
```

Gere o `JWT_SECRET` na VPS:

```bash
python3 -c "import secrets; print(secrets.token_hex(48))"
```

7. Em **Domains** / proxy do serviço `api`, coloque `https://api.seudominio.com.br` (ou o
   hostname que criou no DNS).
8. **Deploy**.

O Coolify sobe o Compose (API + backup). O perfil `tunel` do Compose **não** é necessário se o
Traefik já expõe HTTPS no domínio.

Teste no navegador:

```
https://api.seudominio.com.br/saude
```

Deve devolver `"ok": true`.

### Alternativa sem painel (só Docker)

Se preferir não usar Coolify, na VPS:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/ronaldomelofz/cortemadepinus.git
cd cortemadepinus
cp .env.example .env
nano .env   # JWT_SECRET, ADMIN_SENHA, CORS_ORIGINS
chmod +x scripts/preparar-vm-ubuntu.sh
./scripts/preparar-vm-ubuntu.sh
```

Aí configure um reverse proxy (Caddy/Nginx) ou Cloudflare Tunnel para HTTPS.

---

## 6. Ligar o Netlify à API nova

No computador da MadePinus:

```powershell
cd E:\PROJETOS-CURSOR\CORTE-MADEPINUS
netlify env:set VITE_API_URL https://api.seudominio.com.br --context production --filter @cortemadepinus/web
netlify deploy --build --prod --filter @cortemadepinus/web
```

Ou no painel Netlify: **Site configuration → Environment variables** → `VITE_API_URL` =
`https://api.seudominio.com.br` (sem barra no fim) → **Trigger deploy**.

Abra <https://cortemadepinus.netlify.app/entrar> **com o PC da oficina desligado**. O login tem de
responder. Admin: e-mail/senha do `.env` / variáveis do Coolify.

---

## 7. Atualizar o código depois

No Coolify: **Redeploy** (ou webhook automático no push do GitHub).

Ou por SSH:

```bash
cd /caminho/do/repo   # se usou clone manual
git pull
docker compose up -d --build
```

O volume Docker guarda o SQLite e os anexos; o `git pull` não apaga pedidos.

---

## 8. Backup

O serviço `backup` do `docker-compose.yml` copia o banco para `./backups` uma vez por dia (14 dias).

Baixe de vez em quando (ajuste o caminho se o Coolify montar o volume noutro sítio):

```powershell
scp -i "E:\PROJETOS-CURSOR\CORTE-MADEPINUS\CHAVES\sua-chave.key" -r root@IP_PUBLICO:~/cortemadepinus/backups ./backups-vps
```

No Coolify, ative também backup de volumes/S3 se disponível no painel.

---

## Sem domínio: Cloudflare Tunnel na VPS

Igual ao guia Oracle:

1. Crie um túnel em <https://one.dash.cloudflare.com> → **Networks → Tunnels**.
2. Hostname público: `api` + seu domínio → serviço `http://api:4000` (rede Docker) ou
   `http://127.0.0.1:4000`.
3. No ambiente da API: `TUNNEL_TOKEN=...`
4. `docker compose --profile tunel up -d`

---

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| Painel Coolify não abre | Porta 8000 liberada no firewall? `curl -I http://127.0.0.1:8000` na VPS |
| HTTPS / certificado falha | DNS A aponta para o IP? Proxy Cloudflare desligado no registro `api`? |
| Site Netlify não fala com a API | `VITE_API_URL` HTTPS + **rebuild** depois de gravar a variável |
| CORS no browser | `CORS_ORIGINS` deve incluir `https://cortemadepinus.netlify.app` |
| Disco cheio | limpe imagens Docker: `docker system prune -a` (cuidado em produção) |

---

## Checklist rápido

1. [ ] VPS Ubuntu 24.04 (2 vCPU / 4 GB) criada  
2. [ ] Portas 22, 80, 443, 8000 abertas  
3. [ ] Coolify instalado → admin criado em `:8000`  
4. [ ] DNS `api.…` → IP da VPS  
5. [ ] Deploy Docker Compose + `JWT_SECRET` / `ADMIN_SENHA` / `CORS_ORIGINS`  
6. [ ] `https://api.…/saude` → ok  
7. [ ] Netlify `VITE_API_URL` atualizado + deploy  
8. [ ] Login no site com PC da oficina desligado  
