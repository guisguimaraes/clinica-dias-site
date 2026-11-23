# Agenda da Clínica Dias

Ponte entre os sites da Clínica Dias e o Feegow, para o paciente marcar, ver, remarcar e cancelar consultas on-line. É Python puro, sem dependências: um arquivo só, `servidor.py`.

- O token do Feegow fica só no servidor, em variável de ambiente.
- Só as ferramentas listadas em `FERRAMENTAS` são chamadas.
- O navegador só consegue chamar a ponte a partir dos sites listados em `CORS_ORIGINS`.

## Rodar no computador

```bash
cp .env.example .env   # preencha FEEGOW_MCP_URL e FEEGOW_MCP_TOKEN
python3 servidor.py    # http://127.0.0.1:3000
```

O catálogo de médicos leva 1 a 2 minutos para ficar pronto depois que o servidor sobe. Para acompanhar, veja `"catalogo"` em `/api/saude`.

## Modo teste

Sem `PERMITIR_AGENDAR=1`, a ponte confere o horário, a idade, o preço e o cadastro. Depois responde `{"simulado": true}` sem gravar nada. Vale para agendar, cancelar e remarcar.

## Quem aparece no site

A cada 30 minutos (`CATALOGO_MINUTOS`), a ponte monta o catálogo:

1. Pega as especialidades com agendamento on-line no Feegow, menos as de `ESPECIALIDADES_FORA` e as que usam uma consulta de `CONSULTAS_FORA`.
2. Para cada uma, busca os horários livres dos próximos `DIAS` dias. O Feegow já descarta o profissional com cadastro divergente.
3. Guarda cada médico + especialidade + unidade (de `UNIDADES`) que tiver vaga.

Só esses trios podem ser marcados. Pedidos fora deles voltam com erro 400.

Duas pegadinhas do Feegow:

- O procedimento 3229 ("CONSULTA UROLOGISTA") está como consulta padrão de infectologia, obstetrícia, nutrologia, psicanálise e psicopedagogia. Por isso essas especialidades ficam de fora até a clínica corrigir o cadastro.
- Cada médico tem uma faixa de idade (`idade_minima` e `idade_maxima`). A ponte recusa marcar fora dela.

## API

Endpoints de consulta (GET):

| Rota | O que devolve |
|---|---|
| `/api/saude` | `{ok, marcacao_real, catalogo: {pronto, atualizado_em, medicos, erro}}` |
| `/api/medicos[?especialidade_id=]` | `{atualizado_em, especialidades: [{id, nome, medicos: [{id, nome, sexo, unidades: [ids], idade_minima, idade_maxima, horarios_livres}]}], unidades: {"0": {nome, endereco}}}` |
| `/api/especialidades` | `{especialidades: [{id, nome, medicos}]}` |
| `/api/unidades` | `{unidades: [{id, nome, endereco}]}` |
| `/api/horarios?profissional_id&unidade_id&especialidade_id` | `{horarios: [{data: "AAAA-MM-DD", horario: "HH:MM", local_id}]}` |
| `/api/convenios?profissional_id[&especialidade_id]` | `{convenios: [{id, nome}]}` |
| `/api/meus/agendamentos[?periodo=historico]` | Precisa de `Authorization: Bearer <token>`. Devolve `{agendamentos: [{id, data, hora, medico_id, medico, especialidade_id, especialidade, procedimento, status_id, status, unidade_id, unidade, ativa, pode_cancelar, pode_remarcar}]}` |

Endpoints que recebem dados (POST, corpo em JSON):

| Rota | Corpo | Resposta |
|---|---|---|
| `/api/paciente` | `{cpf}` | `{encontrado, primeiro_nome, dados: {nome, nascimento: "", celular, sexo, email}}` |
| `/api/valor` | `{profissional_id, unidade_id, especialidade_id, pagamento: "pix"\|"cartao"\|"convenio", convenio_id?}` | `{valor, tabela_id}` ou `{convenio}` |
| `/api/agendar` | `{profissional_id, unidade_id, especialidade_id, data, horario, cpf, nome, nascimento, celular, sexo, email?, pagamento, convenio_id?}` | `{agendamento_id}` ou `{simulado: true}` |
| `/api/meus/entrar` | `{cpf, nascimento: "DD/MM/AAAA"}` | `{token, primeiro_nome}` |
| `/api/meus/sair` | (Bearer) | `{ok: true}` |
| `/api/meus/cancelar` | (Bearer) `{agendamento_id}` | `{ok: true}` |
| `/api/meus/remarcar` | (Bearer) `{agendamento_id, data, horario}` | `{ok: true}` |

Os erros chegam como `{erro: "texto pronto para mostrar"}`, com um destes códigos:

| Código | Quando |
|---|---|
| 400 | Dado inválido |
| 401 | Sessão expirada ou CPF e nascimento não conferem |
| 403 | Origem não permitida, ou consulta que não se altera pelo site |
| 409 | Horário ocupado, ou consulta mudou na agenda |
| 422 | Recusado pelo Feegow, ou fora da faixa de idade |
| 429 | Limite de tentativas |
| 502 e 503 | Feegow fora do ar, ou catálogo ainda carregando |

## Segurança

- **Limites de tentativa:**
  - 8 buscas de CPF a cada 10 minutos por IP;
  - 8 entradas em "Meus agendamentos" a cada 10 minutos por IP;
  - 5 datas de nascimento erradas por CPF travam aquele CPF por 1 hora;
  - 10 marcações por hora por IP.
- **IP real:** vem só de `X-Real-Ip`, que o Traefik escreve.
- **Sessões e limites:** ficam na memória. Por isso use uma réplica só. Cada novo deploy desloga quem estiver em "Meus agendamentos".
- **Data de nascimento:** a busca por CPF nunca devolve a data. Ela é a prova de identidade em "Meus agendamentos".

## Deploy (Coolify)

Use o Dockerfile da raiz. A porta é 3000 e o healthcheck é `/api/saude`. Cadastre as variáveis do `.env.example` no Coolify.
