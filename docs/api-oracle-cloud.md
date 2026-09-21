# API 24/7 na Oracle Cloud (Always Free)

> **Não recomendado para o MadePinus.** Em São Paulo o shape Ampère (`VM.Standard.A1.Flex`) costuma
> falhar com *Out of capacity*. Use em vez disso **[api-coolify-vps.md](api-coolify-vps.md)**
> (VPS + Coolify).

O site <https://cortemadepinus.netlify.app> fica no Netlify. Login, pedidos e anexos ficam na
**API**. Para o site funcionar com o computador da MadePinus desligado, a API precisa rodar numa
máquina na nuvem.

Esta receita usa a **VM Always Free da Oracle Cloud** (Ampere ARM): não tem mensalidade se você
respeitar o limite gratuito. O código continua o mesmo (Docker + SQLite).

Não dá para criar a conta da Oracle daqui: o cadastro pede e-mail, telemóvel e cartão (não cobra se
ficar no Always Free). O restante é copiar e colar.

---

## O que você vai ter no fim

```
Cliente  →  Netlify (site)  →  HTTPS  →  Cloudflare Tunnel  →  API na VM Oracle (SQLite)
```

- Site: já está no ar
- API: Ubuntu na Oracle, Docker, porta 4000 só na máquina (não precisa abrir no router)
- HTTPS: túnel Cloudflare (grátis), sem ngrok

---

## 1. Criar a conta e a VM

1. Abra <https://cloud.oracle.com> e crie a conta **Always Free**.
2. Escolha a região **Brazil East (Sao Paulo)** — depois não dá para mudar.
3. No menu: **Compute → Instances → Create instance**.
4. Preencha:

| Campo | Valor sugerido |
| --- | --- |
| Name | `madepinus-api` |
| Image | Canonical Ubuntu 24.04 (aarch64) |
| Shape | **VM.Standard.A1.Flex** (Ampere) |
| OCPU | 1 |
| Memory | 6 GB |
| Boot volume | deixe o padrão (~47 GB) |
| SSH keys | gere um par e **guarde a chave privada** |

5. Em **Networking**, deixe um IP público (para o SSH).
6. Crie a instância. Se aparecer *out of capacity*, tente outro *Availability domain* ou 1 OCPU / 4 GB.

No **VCN → Security lists → Ingress**, libere só SSH (porta 22) do seu IP. **Não abra a porta 4000**
para a internet: o Cloudflare Tunnel faz a saída HTTPS.

Anote o **IP público**. No seu computador:

```bash
ssh -i caminho/da/chave ubuntu@IP_PUBLICO
```

No Windows (PowerShell), o equivalente é:

```powershell
ssh -i $HOME\.ssh\id_rsa ubuntu@IP_PUBLICO
```

---

## 2. Instalar Docker na VM

Cole isto no SSH (já como `ubuntu`):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Saia e volte a entrar no SSH (`exit` e `ssh` de novo) para o grupo `docker` valer.

```bash
docker --version
docker compose version
```

---

## 3. Subir a API

```bash
cd ~
git clone https://github.com/ronaldomelofz/cortemadepinus.git
cd cortemadepinus
cp .env.example .env
```

Edite o `.env`:

```bash
nano .env
```

Obrigatório:

```
JWT_SECRET=cole-aqui-uma-chave-longa
ADMIN_SENHA=uma-senha-forte-do-admin
CORS_ORIGINS=https://cortemadepinus.netlify.app
```

Gere o `JWT_SECRET` na própria VM:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

(Se ainda não tiver Node: `python3 -c "import secrets; print(secrets.token_hex(48))"`.)

Suba:

```bash
docker compose up -d --build
docker compose logs -f api
```

Quando aparecer `Neste computador: http://localhost:4000`, teste **dentro da VM**:

```bash
curl -s http://127.0.0.1:4000/saude
```

Deve devolver `"ok": true`. `Ctrl+C` sai do log; os contentores continuam a correr (`restart: unless-stopped`).

---

## 4. HTTPS com Cloudflare Tunnel (grátis)

1. Conta em <https://one.dash.cloudflare.com> (Zero Trust é grátis no plano gratuito).
2. **Networks → Tunnels → Create a tunnel** → tipo **Cloudflared**.
3. Copie o **token**.
4. **Public hostname**:
   - Subdomain: `api`
   - Domain: o domínio que já está na Cloudflare (ex.: `cortemadepinus.com.br`)
   - Service: `http://api:4000`  
     (o contentor do túnel alcança o serviço `api` da rede Docker.)
5. Na VM, no `.env`:

```
TUNNEL_TOKEN=cole-o-token-aqui
```

6. Suba o túnel:

```bash
cd ~/cortemadepinus
docker compose --profile tunel up -d
docker compose logs -f tunel
```

Teste no navegador: `https://api.SEUDOMINIO/saude`.

### Sem domínio próprio

Use um túnel rápido só para validar (o URL muda se o contentor reiniciar):

```bash
docker run --rm --network container:madepinus-api cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://127.0.0.1:4000
```

Anote o `https://….trycloudflare.com` e use-o no Netlify até ter um hostname fixo no painel
Cloudflare. Para produção, o túnel **com nome + hostname** (passo acima) é o que deve ficar.

---

## 5. Ligar o Netlify à API nova

No computador da MadePinus (não precisa ser a VM):

```bash
cd E:\PROJETOS-CURSOR\CORTE-MADEPINUS
netlify env:set VITE_API_URL https://api.SEUDOMINIO --context production --filter @cortemadepinus/web
netlify deploy --build --prod --filter @cortemadepinus/web
```

Ou no painel: **Site configuration → Environment variables** → `VITE_API_URL` =
`https://api.SEUDOMINIO` (sem barra no fim) → **Deploys → Trigger deploy**.

Confirme no `.env` da VM:

```
CORS_ORIGINS=https://cortemadepinus.netlify.app
```

Reinicie a API se alterou o CORS:

```bash
docker compose up -d api
```

Abra <https://cortemadepinus.netlify.app/entrar> **com o PC da oficina desligado**. O login tem de
responder. Admin: o e-mail/senha do `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env` da VM.

---

## 6. Atualizar o código depois

Na VM:

```bash
cd ~/cortemadepinus
git pull
docker compose up -d --build
```

O volume Docker guarda o SQLite e os anexos; o `git pull` não apaga pedidos.

---

## 7. Backup

O `docker compose` já copia o banco para `./backups` uma vez por dia (14 dias). Baixe de vez em quando:

```bash
scp -i caminho/da/chave -r ubuntu@IP_PUBLICO:~/cortemadepinus/backups ./backups-oracle
```

---

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| *Out of capacity* na Oracle | Outro AD, 1 OCPU, ou região com vaga (a região da conta não muda) |
| `Permission denied` no `docker` | Saiu e voltou a entrar no SSH depois do `usermod`? |
| Site Netlify não fala com a API | `VITE_API_URL` tem de ser HTTPS e o **build** precisa de ter sido feito **depois** de gravar a variável |
| CORS no browser | `CORS_ORIGINS` na VM tem de incluir `https://cortemadepinus.netlify.app` |
| Túnel *unauthorized* | Token novo no `.env` e `docker compose --profile tunel up -d --force-recreate tunel` |
| Login falha com admin | Senha é a da VM (`ADMIN_SENHA`), não a do `.env` antigo do Windows |

O ngrok neste PC deixa de ser necessário quando a Oracle e o túnel estiverem no ar.
