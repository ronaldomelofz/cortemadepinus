# Servidor MadePinus 100% gratuito (sem Cloudflare / ngrok)

## A limitacao real (sem enrolacao)

O site no **Netlify** vive na internet (HTTPS).
O banco e a API vivem no **PC da oficina** (rede privada).

Para o navegador de um cliente na internet chamar o PC, **sempre** existe uma
“ponte”: IP publico + porta, ou um tunel (Cloudflare/ngrok), ou uma VPS.

Nao existe magica gratuita eterna que ligue Netlify ↔ PC sem nenhuma dessas vias.
Por isso o modo **verdadeiramente free e nosso** e este:

```
PC da MadePinus (Windows)
  ├── Site (React compilado)
  ├── API (Express)
  └── Banco SQLite + anexos
       ▲
       │  http://IP-DO-PC:4000
       │
  Celular / notebook na MESMA rede Wi-Fi ou cabo
```

- Sem assinatura
- Sem tunel
- Sem limite de terceiro
- Dados 100% no vosso disco

O Netlify pode continuar no ar como pagina institucional, mas **o sistema de
pedidos** usa o endereco do servidor local.

---

## Instalar (uma vez)

PowerShell **como Administrador**, na pasta do projeto:

```powershell
cd E:\PROJETOS-CURSOR\CORTE-MADEPINUS
.\scripts\instalar-servidor-local-completo.ps1 -SenhaAdmin 'SuaSenhaForte123'
```

O script:

1. Gera `apps/api/.env` com SQLite + `PUBLICO_DIR=apps/web/dist`
2. Compila API e site com `VITE_API_URL` vazio (mesma origem)
3. Cria o banco e o usuario admin
4. Instala a tarefa Windows `MadePinus-API` (sobe no boot)

---

## Usar no dia a dia

1. Deixe o PC servidor ligado.
2. No proprio PC: [http://127.0.0.1:4000](http://127.0.0.1:4000)
3. Em outro aparelho na **mesma rede**: `http://IP-DO-SERVIDOR:4000`  
   (o script mostra o IP ao terminar; ou rode `ipconfig`)

Teste:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/saude
```

Se o Windows Firewall bloquear, permita a porta **4000** na rede privada.

---

## E o Netlify?

| Uso | Recomendacao |
| --- | --- |
| Sistema de corte (login, pedidos, planos) | **Servidor local** `http://IP:4000` |
| Site institucional / divulgacao | Netlify (opcional, gratis) |

Nao e necessario Cloudflare nem ngrok para a oficina trabalhar.

Se no futuro quiserem clientes **fora** da rede (internet) sem pagar tunel:

1. IP publico do provedor de internet (sem CGNAT)
2. Liberar porta 4000 (ou 443) no roteador
3. HTTPS gratis com Let’s Encrypt (win-acme) no proprio PC  

Ainda assim e **vosso** servidor — sem SaaS de tunel.

---

## Comparacao rapida

| Modo | Custo | Depende de terceiro | Clientes na internet |
| --- | --- | --- | --- |
| Servidor local completo (este guia) | Zero | Nao | So na LAN (ou com IP publico vosso) |
| Tunel Cloudflare | Zero hoje* | Sim (Cloudflare) | Sim |
| Ngrok free | Zero com limites | Sim | Sim |

\* Planos free mudam regras; por isso este modo local nao depende deles.

---

## Manutencao

| Acao | Comando |
| --- | --- |
| Status da API | `Invoke-RestMethod http://127.0.0.1:4000/saude` |
| Parar | `Stop-ScheduledTask -TaskName 'MadePinus-API'` |
| Log | `apps\api\dados\api.log` |
| Backup | Copiar `apps\api\dados\cortemadepinus.db` |
