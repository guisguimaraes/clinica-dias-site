# Modificações

Registro do que foi feito no site e na VPS. Os dados de acesso (servidor, porta SSH, usuário e senhas) ficam só no `.env` local, **fora deste repositório**, que é público.

## 23/11/2026: agendamento on-line pelo Feegow (em modo teste)

O paciente marca consulta pelo próprio site, em qualquer especialidade, no mesmo modelo do site do COD (cod.clinicadias.com).

### Como funciona

```
clinicadias.com (VPS da clínica, publicado pelo GitHub)
   │  janela de agendamento e página Meus agendamentos
   ▼
agenda.clinicadias.com (app agenda-clinica-dias no Coolify, 194.195.86.146)
   │  guarda o token do Feegow e só usa as ferramentas de agenda
   ▼
Feegow (MCP em mcpfeegow.clinicadias.com)
```

- **Ponte (servidor):** pasta `agenda/` deste repositório, publicada no Coolify como um app separado do COD. Contrato da API e variáveis em `agenda/README.md`. O token fica só nas variáveis do Coolify, nunca no GitHub. A pasta `agenda/` não vai para a VPS (o deploy copia só `site/`).
- **DNS:** registro A `agenda` → `194.195.86.146` na HostGator. O certificado é do Let's Encrypt, emitido pelo Coolify.
- **Site:**
  - `site/js/agenda.js` + `site/css/agenda.css`: a janela, em 6 passos (especialidade → médico → unidade → dia e hora → dados → confirmação). Abre em todo elemento com `data-agenda`; `data-especialidade="Cardiologia"` já abre na especialidade.
  - `site/agendamentos.html` + `site/js/meus-agendamentos.js`: o paciente entra com CPF e data de nascimento e vê, remarca ou cancela as consultas.
  - O endereço da ponte fica em `<html data-agenda-api="https://agenda.clinicadias.com/api/">`. No computador (127.0.0.1), o site usa a ponte local em `http://127.0.0.1:3100/api/`.
  - `.htaccess`: `https://agenda.clinicadias.com` entrou no `connect-src` do CSP.
  - A política de privacidade foi atualizada: o site agora pede dados para marcar a consulta.
- **Especialidades:** a lista vem do Feegow (só as que têm médico com horário livre nos próximos 30 dias). O site junta as repetidas (Ginecologia, as 5 de Odontologia, Oftalmologia Infantil).
- **Fotos dos médicos:** o Feegow não tem foto. Ficam em `site/img/medicos/<nome-sem-acento>.jpg` (200 px de largura) e o nome entra na lista `FOTOS` do `agenda.js`. Sem foto, aparecem as iniciais.

### Janela nova e preços (23/11, à tarde)

- **Passos:** especialidade → médico → unidade → dia e hora → **pagamento** → paciente → confirmar.
- **Ficha da consulta:** no computador, uma coluna azul à esquerda vai mostrando cada escolha. Tocar numa linha volta àquele passo. No celular, ela vira uma linha de resumo embaixo do título.
- **Preços:** a ponte ganhou `GET /api/precos?profissional_id&unidade_id&especialidade_id`, que devolve o valor Particular no dinheiro/PIX e no cartão, além dos cartões de desconto (CardFácil, AAPI, Associação dos Aposentados, TomoCard), direto do Feegow. O resultado fica guardado por 1 hora. A tabela "Parceria" é interna e fica de fora.
- **Pagamento sempre na clínica, no dia:** o site não cobra nada. A confirmação e a tela final mostram o valor e a forma de pagamento escolhida.
- **Cartões de desconto:** por enquanto não entram como opção no site. Aparece só a frase "Tem CardFácil ou outro cartão de desconto? Ligue…".
- **Tela final:** botões "Salvar no calendário" (arquivo .ics com lembrete 2 h antes) e "Meus agendamentos".
- **Marcação real ligada** (`PERMITIR_AGENDAR=1`) desde 23/11, com o ok do Guilherme.

### Modo teste

Para testar sem gravar, use `PERMITIR_AGENDAR=0` (por exemplo, rodando a ponte no computador com `python3 agenda/servidor.py` e um `agenda/.env` com `PORT=3100` e `CORS_ORIGINS=http://127.0.0.1:8080`): o site faz tudo com horários reais, mas **não grava nada**: no fim aparece "Teste concluído. Nada foi marcado na agenda". Para ligar a marcação de verdade, a clínica aprova, alguém muda `PERMITIR_AGENDAR=1` no app agenda-clinica-dias e faz o redeploy.

### Pendências

- [x] Marcação real ligada em 23/11.
- [ ] Decidir se os cartões de desconto entram como opção de pagamento no site.
- [ ] Fotos dos outros médicos.
- [ ] Endereço da unidade Timóteo · Portaria I: o Feegow diz "Rua Doutor Tadeu Damásio dos Reis, 450", e o site usa "Rua Cento e Vinte e Oito, 14".
- [ ] No Feegow, Infectologia, Obstetrícia, Nutrologia, Psicanálise e Psicopedagogia usam a "CONSULTA UROLOGISTA" (3229) como consulta padrão. Por isso ficaram fora do agendamento on-line até a clínica corrigir.
- [ ] Cinco profissionais sem tratamento (Dr./Dra.) no Feegow.

## 13/11/2026: site novo no ar e publicação automática

### 1. Troca do site antigo pelo novo

- **Antes:** a clinicadias.com tinha um site estático com `index`, `quem-somos`, `contato`, `localizacao` e `404`.
- **Agora:** o conteúdo de `site/` está em `/www/wwwroot/clinicadias.com`, sem a `_previa/`.
- **Servidor:** VPS com aaPanel e **Apache 2.4**, não nginx. Por isso as regras de servidor ficam no `site/.htaccess`, e não na configuração do nginx descrita no LEIA-ME.
- **Preservados no servidor:** o `.user.ini`, que é imutável e criado pelo aaPanel, e o `.well-known/`, que a renovação do SSL usa. O banco de dados não foi tocado.
- **Backup do site antigo:**
  - no servidor: `/www/backup/clinicadias/site-antigo-20261113.tar.gz`
  - no PC: `arquivo/backup-vps/site-antigo-20261113.tar.gz`, que fica fora do git

### 2. `site/.htaccess`

Junta as regras de segurança que já existiam na VPS com o que o site novo precisa:

- **Tipos de arquivo:** registra `.mjs` (mapa), `.wasm` (Draco do passeio) e `.glb` (modelo 3D). Sem isso, o mapa e o passeio não abrem.
- **Arquivos liberados:** o `.htaccess` antigo bloqueava `.mjs` e `.json`, que agora são usados (`maplibre-gl.mjs` e `passeio/modelos/luz.json`). Continuam bloqueados os arquivos ocultos e os de backup ou código (`.env`, `.sql`, `.zip`, `.md`, `.ps1`, `.py`, `.blend`…).
- **Política de segurança (CSP):** libera só o que o site carrega de fora:
  - `cdn.jsdelivr.net`: three.js e gsap do passeio;
  - `tiles.openfreemap.org`: o mapa;
  - `places.googleapis.com`: as avaliações;
  - `*.googleusercontent.com`: as fotos de quem avaliou;
  - `blob:` e `wasm-unsafe-eval`: mapa e Draco;
  - `unsafe-inline`: os scripts e estilos que estão no próprio HTML.

  **Se o site passar a usar outro domínio externo, ele precisa entrar no CSP.**
- **Página 404:** `ErrorDocument 404 /404.html`.
- **Endereço:** força o `https` e tira o `www`.
- **Redirecionamentos 301 do site antigo:** `quem-somos.html` → `a-clinica.html`, `contato.html` → `atendimento.html` e `localizacao.html` → `atendimento.html`.
- **Cache:** 30 dias para imagens, fontes e áudio, 7 dias para `.glb` e `.wasm`, 1 dia para CSS e JS. O HTML é sempre conferido.

### 3. SEO

- Criado o `site/sitemap.xml`, com as 5 páginas e o `/passeio/`.
- Acrescentada no `site/robots.txt` a linha `Sitemap: https://clinicadias.com/sitemap.xml`.

### 4. Publicação automática (GitHub → VPS)

Um push no `main` entra no ar em **até 5 minutos**, sem precisar subir nada à mão.

- **Como funciona:** o cron do root roda `/usr/local/bin/deploy-clinicadias` a cada 5 minutos. O script compara o último commit do `main` no GitHub com o último publicado. Se for o mesmo, encerra sem fazer nada: não reinicia o Apache nem nenhum serviço, e não usa pm2. Se mudou:
  1. baixa as mudanças numa cópia que só traz a pasta `site/` (`/opt/clinicadias/repo`);
  2. confere os arquivos essenciais (`index.html`, `404.html`, `.htaccess`, `passeio/index.html`, `js/site.js`, `css/site.css`). Se faltar algum, **não publica** e registra o erro;
  3. faz um backup do site atual em `/www/backup/clinicadias/auto/`, guardando os 5 últimos;
  4. sincroniza `site/` com a pasta do domínio usando `rsync --delete`: o que sai do repositório sai também do site. Nunca mexe no `.user.ini`, no `.well-known/` nem na `_previa/`;
  5. registra o commit publicado em `/var/log/clinicadias-deploy.log`, que é compactado todo mês.
- **Por que o servidor busca no GitHub, em vez de o GitHub enviar:** o repositório é público, então o servidor não precisa de senha nem de chave para buscar as mudanças. Também não fica nenhuma credencial do servidor guardada no GitHub. E a conta `TTiDias` não tem permissão de admin no repositório, que seria necessária para cadastrar Secrets ou Webhooks.
- **Teste:** um commit de teste entrou no ar em cerca de 3,5 minutos, e o revert dele em cerca de 4,5 minutos.

**Comandos no servidor** (com `sudo`):

| Comando | Para quê |
|---|---|
| `deploy-clinicadias --forcar` | publica o `main` na hora, sem esperar o cron |
| `deploy-clinicadias --restaurar` | volta o backup mais recente |
| `tail /var/log/clinicadias-deploy.log` | mostra o que foi publicado e quando |

**Regras a partir de agora:**
- O GitHub é a única fonte do site. **Não edite arquivos direto na VPS**, porque a próxima publicação sobrescreve.
- Qualquer pessoa com permissão de escrita no repositório publica direto no site. Para exigir revisão antes de publicar, o dono do repositório pode proteger o `main` e exigir Pull Request.
- Para desfazer uma alteração no ar, dê `git revert` no GitHub.

### Pendências

- [ ] **`www.clinicadias.com` com o certificado SSL inválido.** No aaPanel, em Site → clinicadias.com, adicione o domínio `www.clinicadias.com` e reemita o SSL. O redirecionamento para o endereço sem `www` já está pronto no `.htaccess`.
- [ ] **Avaliações ao vivo do Google.** Hoje o site mostra os 4 depoimentos fixos, porque falta a chave da API do Google Places.
- [ ] **Enviar o `sitemap.xml` no Google Search Console.**
- [ ] **Trocar as senhas do servidor** e passar a usar chave SSH em vez de senha.
- [ ] **Consertar o FTP da VPS.** O Pure-FTPd dá erro `pure-pw mkdb`. Não afeta este site, mas afeta qualquer outro que dependa de FTP.
