
# Evolução para TMS Completo

Vou transformar o app atual (rascunho local + export) em um sistema completo de gerenciamento de testes com banco de dados, autenticação e trilha de auditoria.

## 1. Backend (Lovable Cloud)

Habilito o Lovable Cloud e crio o esquema:

- `projects` — plano de teste (projeto, versão, responsável, ambiente, objetivo, in/out scope, datas). Dono: `owner_id`.
- `schedule_items` — cronograma (FK `project_id`).
- `risks` — riscos (FK `project_id`).
- `user_stories` — US (FK `project_id`, ID, módulo, ator, story, critérios, prioridade, sprint, status).
- `test_cases` — CT (FK `project_id`, `user_story_id` opcional, campos completos + status de execução).
- `bugs` — defeitos (FK `test_case_id`, severidade, comportamento atual/esperado, status).
- `audit_logs` — trilha (ator, entidade, entity_id, ação `create/update/delete`, diff JSON, timestamp).

**Segurança:** RLS em tudo, projetos **privados por usuário** (`owner_id = auth.uid()`). Filhos herdam via `EXISTS` na tabela `projects`. `audit_logs` só leitura pelo dono. Grants explícitos para `authenticated` e `service_role`.

**Auditoria:** trigger `AFTER INSERT/UPDATE/DELETE` em cada tabela principal, gravando diff em `audit_logs` com `auth.uid()`.

## 2. Autenticação

- E-mail/senha + Google (via broker `lovable.auth.signInWithOAuth`).
- Rota pública `/auth` (login + signup, com botão Google).
- Layout gerenciado `_authenticated/route.tsx` protege tudo que exige login.
- Header mostra usuário/logout quando logado.

## 3. Rotas e telas

```
/                        landing simples → CTA "Entrar"
/auth                    login/signup + Google
/_authenticated/
  projects               Dashboard: lista de projetos (cards com nome, versão, %sucesso, bugs)
                         + botão "Novo projeto" + "Importar rascunho local"
  projects/$id           Editor do projeto (abas atuais: Plano, US, CT, Matriz)
                         + CRUD via server functions (createServerFn)
  projects/$id/execution Modo Execução: lista de CTs com botões Passou/Falhou/Bloqueado/Pendente
                         Ao marcar "Falhou" → abre modal de Bug pré-preenchido
                         (passos + massa do CT)
  projects/$id/bugs      Lista/edição de bugs
  projects/$id/audit     Trilha de auditoria filtrada por projeto
```

## 4. Migração do rascunho local

Botão "Importar rascunho local" no dashboard: lê `citse-qa-data-v1` do localStorage, cria projeto + filhos via server function, e limpa o rascunho após confirmação.

## 5. Export XLSX atualizado

O botão "Exportar XLSX" (já existente) passa a receber `projectId` e busca do banco. Adiciono duas abas:

- **Aba 5 — Relatório de Bugs**: ID_Bug, CT relacionado, severidade, comportamento atual/esperado, status, data.
- **Aba 6 — Dashboard de Fechamento**: Total CTs, Passou, Falhou, Bloqueado, Pendente, %Sucesso, %Falha, Bugs abertos, Bugs corrigidos.

Mantidas as 4 abas originais (Plano, US, CT, Matriz).

## 6. Design

Mantenho o layout limpo atual (shadcn + tabs + cards). Adiciono:
- Sidebar simples no `_authenticated` com navegação (Projetos, Execução, Bugs, Auditoria) quando dentro de um projeto.
- Badges coloridos por status (verde=Passou, vermelho=Falhou, âmbar=Bloqueado, cinza=Pendente).
- Barra de progresso de execução no dashboard.

## Detalhes técnicos

- Server functions em `src/lib/*.functions.ts` usando `requireSupabaseAuth` (RLS aplica como usuário).
- Loaders em rotas `_authenticated` usam `context.queryClient.ensureQueryData` + `useSuspenseQuery`.
- Mutações via `useMutation` + `invalidateQueries`.
- Export permanece dinâmico (`await import("@/lib/citse-export")`) para não quebrar SSR.
- Store local (`useCitseData`) permanece apenas para a função de importação do rascunho.

## Entrega

Vou executar em uma sequência longa (habilitar Cloud → migração SQL → server functions → páginas → export). A quantidade de arquivos é grande (~15-20 arquivos novos/editados). Se aprovar, começo agora.
