# QualiDocs — Sistema de Gerenciamento de Testes (TMS)

> **Português / English:** Plataforma completa de QA para planejar, executar e auditar testes de software.  
> Complete QA platform to plan, execute and audit software tests.

[![QualiDocs](https://qualidocs.lovable.app)](https://qualidocs.lovable.app)

---

## 1. Visão Geral / Overview

O **QualiDocs** é um **Test Management System (TMS)** moderno, pensado para times de QA que precisam organizar planos de teste, histórias de usuário, casos de teste, execuções, bugs e trilha de auditoria em um único lugar.

**QualiDocs** is a modern Test Management System (TMS) designed for QA teams that need to organize test plans, user stories, test cases, executions, bugs and audit trails in one place.

### Principais diferenciais / Key differentiators

- **Plano de teste estruturado** — objetivo, escopo, cronograma e riscos.  
- **User stories e casos de teste vinculados** — rastreabilidade por ID.  
- **Execução de testes em tempo real** — status Passou, Falhou, Bloqueado, Pendente.  
- **Módulo de bugs integrado** — abertura automática a partir de uma falha.  
- **Trilha de auditoria (audit log)** — quem alterou o quê e quando.  
- **Exportação para Excel e PDF** — relatórios prontos para compartilhar.  
- **Segurança e LGPD** — RLS, sanitização, avisos de credenciais, histórico de acesso.  
- **Backup local e Error Boundary global** — proteção contra perda de dados e crashes.

---

## 2. Funcionalidades / Features

| Módulo | Descrição / Description |
|--------|-------------------------|
| **Projetos / Projects** | Criação, edição, exclusão e listagem de planos de teste. |
| **Cronograma / Schedule** | Fases, atividades, responsáveis, datas e status. |
| **Riscos / Risks** | Registro de riscos com probabilidade, impacto e mitigação. |
| **User Stories (US)** | Histórias com módulo, ator, critérios de aceite, prioridade e sprint. |
| **Casos de Teste (CT)** | Pré-condições, massa, passos, resultado esperado e vinculação com US. |
| **Execução / Execution** | Atualização de status, registro do obtido e evidências. |
| **Bugs / Defects** | Severidade, comportamento atual/esperado, status de correção. |
| **Auditoria / Audit** | Log automático de criação, edição e exclusão. |
| **Exportação / Export** | XLSX com múltiplas abas (plano, US, CT, matriz, bugs, dashboard). |
| **Acesso / Access History** | IP, localização geográfica, data/hora e tipo de evento. |

---

## 3. Stack Tecnológico / Tech Stack

| Camada | Tecnologia |
|--------|------------|
| Framework full-stack | [TanStack Start](https://tanstack.com/start) v1 + React 19 |
| Build tool | Vite 7 |
| Roteamento | TanStack Router (file-based) |
| Estado / dados | TanStack Query v5 |
| Server functions | `createServerFn` do `@tanstack/react-start` |
| Estilização | Tailwind CSS v4 + shadcn/ui |
| Componentes UI | Radix UI + Lucide React |
| Backend / Auth / DB | Lovable Cloud (Supabase) — Postgres, RLS, Auth |
| Validação | Zod |
| Exportação | ExcelJS, jsPDF, jspdf-autotable |
| Notificações | Sonner |
| Deploy | Cloudflare Workers (edge) via Lovable |

---

## 4. Arquitetura / Architecture

```text
src/
├── routes/                 # Rotas do TanStack Start (file-based)
│   ├── __root.tsx          # Layout raiz + Error Boundary global
│   ├── index.tsx           # Landing page
│   ├── auth.tsx            # Login / signup / Google OAuth
│   ├── _authenticated/     # Área logada
│   │   ├── route.tsx       # Layout protegido
│   │   ├── projects.tsx    # Dashboard de projetos
│   │   ├── projects.$id.tsx # Editor do projeto
│   │   ├── account.tsx     # Perfil + histórico de acesso
│   │   └── ...
│   └── api/                # (quando necessário) endpoints públicos
├── lib/                    # Server functions, tipos, utilitários
│   ├── tms.functions.ts    # CRUD de projetos, US, CT, bugs, auditoria
│   ├── access-history.functions.ts # Registro e listagem de acessos
│   ├── backup.ts           # Backup local e sanitização
│   ├── citse-export.ts     # Exportação XLSX/PDF
│   └── tms-types.ts        # Tipos compartilhados
├── components/             # Componentes reutilizáveis (shadcn + custom)
│   ├── BackupDialog.tsx
│   └── GlobalErrorBoundary.tsx
├── integrations/supabase/  # Clientes e middleware de auth
└── styles.css              # Tokens do Tailwind v4
```

---

## 5. Segurança, Privacidade e LGPD / Security, Privacy & LGPD

O QualiDocs lida com dados de conformidade e, por isso, adota práticas de segurança em várias camadas:

- **Row Level Security (RLS)** em todas as tabelas do banco.  
  Cada usuário vê e manipula apenas os próprios projetos e registros.
- **Autenticação via Lovable Cloud** — e-mail/senha e Google OAuth.
- **Sanitização de entrada** — funções em `src/lib/backup.ts` removem tags `<script>`, handlers `on*` e URLs `javascript:`.
- **Detecção de credenciais em texto** — aviso quando o usuário digita algo que parece senha em campos livres.
- **Histórico de acesso** — IP, cidade, região, país, fuso horário, data/hora e tipo de evento (`login`/`logout`/`signup`).
- **Error Boundary global** — evita tela em branco em caso de crash; oferece recarregar ou baixar backup de emergência.
- **Backup local automático** — snapshots do projeto são salvos no `localStorage` a cada alteração relevante.
- **Avisos de ambiente de teste** — lembrete para não inserir credenciais reais em ambientes de desenvolvimento.

---

## 6. Mecanismo de Backup e Persistência Local / Backup & Local Persistence

O QualiDocs implementa uma rotina de auto-save robusta para evitar perda de dados durante o desenvolvimento:

- **Auto-save em `localStorage`** a cada mudança significativa no projeto.
- **Snapshot de emergência** — o último estado válido é sempre mantido em `qualidocs:backup:__last__`.
- **Download manual de backup** — botão para exportar o snapshot atual como `.json`.
- **Importação de backup** — permite restaurar um projeto a partir de um arquivo `.json` gerado pelo sistema.
- **Backup de emergência no crash** — o Error Boundary global permite baixar o último snapshot antes de recarregar a página.

Arquivos principais:

- `src/lib/backup.ts` — utilitários de sanitização e persistência.
- `src/components/BackupDialog.tsx` — diálogo de backup/importação.
- `src/components/GlobalErrorBoundary.tsx` — tela amigável de erro + botão de backup de emergência.

---

## 7. Tratamento de Exceções / Error Handling

- **Global Error Boundary** em `src/routes/__root.tsx` captura erros de renderização em qualquer componente filho.
- **Mensagens bilingues** — Português (Inglês) — para todos os textos de erro.
- **Ações disponíveis:**
  - Recarregar a página (`window.location.reload()`).
  - Baixar o backup de emergência dos dados vigentes antes do crash.
- **Logs estruturados** no console com prefixo `[QualiDocs]` para facilitar debugging.

---

## 8. Instalação e Execução Local / Local Setup

> Pré-requisitos / Requirements: [Bun](https://bun.sh) ou Node 20+ com `npm`/`pnpm`.

### 8.1 Clone e instalação

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd qualidocs

# Instale as dependências
bun install
# ou
npm install
```

### 8.2 Variáveis de ambiente

Crie um arquivo `.env` na raiz com as variáveis fornecidas pelo Lovable Cloud:

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua-anon-key>
VITE_SUPABASE_PROJECT_ID=<seu-project-id>
```

> **Atenção:** Nunca comite o arquivo `.env`. Ele já está listado no `.gitignore`.

### 8.3 Rodar em desenvolvimento

```bash
bun run dev
# ou
npm run dev
```

O app estará disponível em `http://localhost:8080`.

### 8.4 Build de produção

```bash
bun run build
# ou
npm run build
```

---

## 9. Scripts Disponíveis / Available Scripts

| Script | Descrição |
|--------|-------------|
| `dev` | Inicia o servidor de desenvolvimento Vite. |
| `build` | Gera o build de produção. |
| `build:dev` | Build no modo desenvolvimento. |
| `preview` | Pré-visualiza o build de produção localmente. |
| `lint` | Executa o ESLint em todo o projeto. |
| `format` | Formata o código com Prettier. |

---

## 10. Banco de Dados / Database

Principais tabelas (schema `public`):

| Tabela | Propósito |
|--------|-----------|
| `projects` | Planos de teste |
| `schedule_items` | Cronograma do projeto |
| `risks` | Riscos do projeto |
| `user_stories` | Histórias de usuário |
| `test_cases` | Casos de teste |
| `bugs` | Defeitos registrados |
| `audit_logs` | Trilha de auditoria |
| `access_history` | Histórico de acesso (IP, localização, evento) |
| `project_tags` | Tags globais por usuário |
| `project_tag_links` | Vinculação tags ↔ projetos |
| `members` | Membros convidados por projeto |

Todas as tabelas possuem:

- `GRANT` explícito para `authenticated` e `service_role`.
- Row Level Security (RLS) habilitado.
- Políticas que restringem acesso ao dono do projeto (`owner_id = auth.uid()`).

---

## 11. Qualidade e Testes / QA & Testing

O projeto possui um **projeto interno de QA** completo, criado para garantir a qualidade da própria plataforma:

- **17 User Stories** cobrindo autenticação, projetos, execução, bugs, auditoria, exportação e segurança.
- **43 Casos de Teste** manuais com pré-condições, passos, resultado esperado e rastreabilidade.
- **Matriz de rastreabilidade** entre US e CT.
- **Relatório de bugs** e **dashboard de fechamento** no export XLSX.

Esse material é ideal para praticar testes, demonstrar competências de QA em entrevistas e documentar a evolução do produto.

---

## 12. Links / Links

- **Demo publicado / Live demo:** https://qualidocs.lovable.app
- **Repositório / Repository:** (adicione a URL do seu repo)
- **LinkedIn:** (adicione o link do seu perfil)

---

## 13. Licença / License

Este projeto foi desenvolvido para fins de aprendizado, prática de QA e portfólio.  
Sinta-se livre para estudar, inspirar-se e adaptar — mantenha os créditos ao autor original.

---

## 14. Contato / Contact

Desenvolvido com 💙 por **[Seu Nome]** — QA em busca de novas oportunidades.

- E-mail: seu-email@exemplo.com
- LinkedIn: https://www.linkedin.com/in/seu-perfil

---

> **Nota de segurança / Security note:** Este README é um artefato público. Não inclua chaves de API, senhas, tokens ou dados sensíveis neste arquivo.
