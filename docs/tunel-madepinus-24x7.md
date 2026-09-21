# Tunel MadePinus 24/7

## O que e (e o que nao e)

Nao reinventamos o protocolo global do ngrok (isso exigiria servidores publicos
nossos em datacenter). Em vez disso, o **Tunel MadePinus** e a operacao 24/7
**sob nosso controle**:

| Camada | De quem e | Custo |
| --- | --- | --- |
| API + banco + anexos no PC | **MadePinus (seu)** | zero |
| Configuracao, token e hostname do tunel | **MadePinus (seu .env)** | zero |
| Binario `cloudflared` (Apache-2.0) | Cloudflare open source, **roda no seu PC** | zero |
| Site | Codigo seu no Netlify (plano free) | zero |

O Netlify so entrega o front. O tunel so abre HTTPS ate **a sua** API local.

```
Cliente -> cortemadepinus.netlify.app
        -> HTTPS (hostname FIXO do SEU tunel)
        -> cloudflared no Windows MadePinus (servico 24/7)
        -> http://127.0.0.1:4000 (sua API)
```

URL temporaria `*.trycloudflare.com` / ngrok **nao** e o modo 24/7.
O modo 24/7 usa **tunel nomeado** + **hostname fixo** no painel Cloudflare.

---

## 1. Criar o tunel (uma vez)

1. Conta gratuita: <https://one.dash.cloudflare.com/>
2. **Zero Trust** -> **Networks** -> **Tunnels** -> **Create a tunnel**
3. Tipo **Cloudflared** -> nome `madepinus-api`
4. Copie o **token** (comeca em geral com `eyJ`)
5. Em **Public Hostname**:
   - Subdomain / Domain: ex. `api` + seu dominio na Cloudflare  
     ou um hostname que a Cloudflare oferecer no plano
   - Service: `http://127.0.0.1:4000`
6. Salve. Anote a URL final, ex.: `https://api.seudominio.com.br`

Sem dominio proprio: use um dominio gratuito na Cloudflare ou o hostname
publicado no painel do tunel. O importante e ser **fixo** (nao muda a cada boot).

---

## 2. Configurar o servidor Windows

No `.env` na **raiz** do repositorio:

```env
TUNNEL_TOKEN=eyJ...cole-o-token-completo...
API_PUBLIC_URL=https://api.seudominio.com.br
CORS_ORIGINS=https://cortemadepinus.netlify.app,http://localhost:5173
JWT_SECRET=...
ADMIN_SENHA=...
```

Garanta a API no ar 24/7:

```powershell
.\scripts\instalar-servico-windows.ps1
```

Instale o tunel 24/7 (PowerShell **como Administrador**):

```powershell
.\scripts\instalar-tunel-madepinus.ps1 -IntegrarNetlify
```

Isso:

- grava o token em `apps/api/dados/tunel.token` (local, fora do git)
- cria a tarefa `MadePinus-Tunel` (sobe no boot, reinicia se cair)
- opcionalmente atualiza o Netlify (`VITE_API_URL`) e faz deploy

---

## 3. Conferir

```powershell
.\scripts\status-tunel-madepinus.ps1
Invoke-RestMethod https://SUA-URL/saude
```

Login: <https://cortemadepinus.netlify.app/entrar>

---

## Manutencao

| Acao | Comando |
| --- | --- |
| Status | `.\scripts\status-tunel-madepinus.ps1` |
| Parar tunel | `Stop-ScheduledTask -TaskName 'MadePinus-Tunel'` |
| Remover tunel | `Unregister-ScheduledTask -TaskName 'MadePinus-Tunel' -Confirm:$false` |
| Log | `apps\api\dados\tunel.log` |
| Trocar token | edite `.env` e rode de novo `instalar-tunel-madepinus.ps1` |

Docker (alternativa ao Windows Task):

```powershell
docker compose --profile tunel up -d
```

(precisa `TUNNEL_TOKEN` no `.env` da raiz)

---

## Seguranca

- Nunca commite `TUNNEL_TOKEN` nem `apps/api/dados/tunel.token`
- HTTPS termina no Cloudflare; no PC a API pode ficar so em localhost
- Nao abra a porta 4000 na internet — o tunel e a entrada
- Mantenha o PC ligado (ou use VPS) para 24/7 real
