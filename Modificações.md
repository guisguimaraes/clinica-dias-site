# Modificações

Registro do que foi feito no site e na VPS. Os dados de acesso (servidor, porta SSH, usuário e senhas) ficam só no `.env` local, **fora deste repositório**, que é público.

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
