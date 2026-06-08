# StudyLoop — PRD

## Original Problem Statement
> "Faça um app com base nas informaçoes contidas nesse arquivo que enviei"

The user attached `StudyLoop_Contexto_Desenvolvimento.docx`, a brief for **StudyLoop**, an AI-powered active-learning app (Brazilian Portuguese). Core loop: user ingests study content (texto / link / PDF / foto) → IA gera quizzes + flashcards com repetição espaçada → usuário pratica → progresso é rastreado.

## User Choices
- Plataforma: **Web app responsivo mobile-first** (max-w-md, parece um celular)
- Escopo MVP: **Core loop + Home (Modo 5 min) + Perfil com heatmap**; **Social só como prévia** "Em breve"
- IA: **Claude Sonnet 4.5** via Emergent LLM Key (geração de questões + OCR de fotos)
- Ingestão: **Texto, PDF, foto (OCR), link (web scraping)**
- Auth: **JWT email/senha + Emergent Google Auth** (Apple = backlog: requer Apple Developer Account)
- Idioma: **PT-BR**

## Tech Stack
- Backend: FastAPI + MongoDB (motor), bcrypt + PyJWT, emergentintegrations (Claude), pypdf, BeautifulSoup
- Frontend: React 19 + react-router 7 + framer-motion + Tailwind, lucide-react
- Theme: dark "deep ink" #090A0F + amber accent #F5A623 (Outfit + DM Sans)

## Personas
- Estudantes brasileiros (ENEM, vestibular, concursos, graduação) que querem reduzir o atrito entre **consumir** conteúdo e **praticar ativamente**.

## Core Requirements (status)
- [x] Onboarding 4 passos (intro + nível + horas + objetivo)
- [x] Auth email+senha (JWT) + Emergent Google Auth + sessão httpOnly cookie
- [x] 4 tabs: Início, Matérias, Social (preview), Perfil
- [x] Home: saudação personalizada, streak pill, "Modo 5 minutos" hero, AI alert, continue estudando, quick stats
- [x] Matérias CRUD com cor + ícone (bottom-sheet)
- [x] Detalhe de matéria com lista de fontes e CTAs Quiz/Flashcards
- [x] AddContentSheet — 4 tipos (texto, link, pdf, foto)
- [x] Geração IA com Claude Sonnet 4.5 (resumo + 6 questões múltipla escolha + 6 flashcards)
- [x] PDF: extração via pypdf (até 50 páginas)
- [x] Link: web scraping com BeautifulSoup (até 20k chars)
- [x] Foto: OCR via Claude vision (image base64)
- [x] Quiz: progresso em pontos, seleção+confirmar, feedback verde/vermelho, explicação, finalização com placar
- [x] Flashcards: flip 3D, 4 ratings SRS (Errei/Difícil/Bom/Fácil), algoritmo SM-2 simplificado
- [x] Sessões salvas com streak diário automático
- [x] Perfil: avatar, plano badge, stats (4), heatmap 18 semanas, conquistas (4), upgrade-to-Pro, logout
- [x] Paywall preview (R$ 29/mês, lista de benefícios)
- [x] Social preview com 4 cards "Em breve" (Grupos, Duelos, Biblioteca, Ranking)
- [x] Dark mode (único tema do app, conforme briefing)

## Architecture
- `/api/auth/{register,login,me,logout,onboarding,google/session}`
- `/api/materias` GET/POST/PATCH/DELETE
- `/api/fontes/{text,link,pdf,photo}` POST + `/api/fontes/{materia_id}` GET + `/api/fontes/{fonte_id}` DELETE
- `/api/questoes`, `/api/questoes/5min`, `/api/flashcards/due/{materia_id}`, `/api/flashcards/{id}/review`
- `/api/sessoes`, `/api/stats`, `/api/home`
- Mongo collections: `users`, `user_sessions`, `materias`, `fontes`, `questoes`, `flashcards`, `sessoes`

## What's been implemented (2026-06-08)
- Tudo acima. Backend testado 18/18 (incluindo geração de IA real, scraping de Wikipédia, SRS). Frontend testado end-to-end via Playwright (register → onboarding → criar matéria → adicionar fonte texto → IA gerar conteúdo → Modo 5 min).
- **+ Share da sessão (iteration 3)**: ShareButton no resultado de Quiz e Flashcards gera PNG 1080x1920 via Canvas nativo (logo, materia, score em ring, streak, footer) + Web Share API com fallback de download. Validado 100% headless.
- **+ Avaliação de questões (iteration 4)**: tela intermediária 🤔 com 5 estrelas + "Enviar" / "Pular" entre Finalizar e tela de resultado. Backend: POST `/api/avaliacoes` { nota 1-5, materia_id?, sessao_id?, fonte_id? } → collection `db.avaliacoes`. Skip não persiste nada. Validado 100% backend + frontend.
- **+ NPS Survey (iteration 5)**: regras 14 dias + 3 sessões + máx 2 tentativas com snooze de 7 dias. Backend `/api/nps/{status,submit,snooze}` + collection `nps_surveys`. Modal disparado na Home com escala 0-10 colorida e comentário opcional. Backend 100%.
- **+ Planos & Paywall (iteration 6)**: FREE limita 3 fontes, 5 sessões/mês, foto e PDF bloqueados. Backend `_enforce_fonte_limit` retorna HTTP 402 com motivo. POST `/api/plan/upgrade` (mock — sem Stripe) marca user como pro e insere doc em `db.payments`. POST `/api/analytics/event` registra paywall_shown e paywall_cta_tapped. Frontend: PaywallProvider global + PaywallModal reutilizável + lock badges nos tipos foto/pdf + gate de sessão via `canStartSession()`.
- **+ Painel Admin (iteration 7)**: `/admin` restrito ao email `jeffinc88@gmail.com` (frontend redirect + backend 403). `GET /api/admin/metrics` retorna usuários, ativação D7, retenção D30, qualidade IA (média estrelas), NPS (score + distribuição), monetização (Pro count, paywall CTR, lista de assinantes). UI desktop-friendly, auto-refresh a cada 30s.
- **+ Correção de Acentuação (iteration 8)**: helper `_normalize_pt_title` aplicado em POST/PATCH `/api/materias` (campo nome) e em POST `/api/fontes/{text,link,pdf,photo}` (campo titulo). Estratégia híbrida: dict in-memory com ~40 termos comuns (instant) + Claude Sonnet 4.5 como fallback. Validado: "biologia"→"Biologia", "ligacoes quimicas"→"Ligações Químicas", "introducao a programacao"→"Introdução à Programação".
- **+ Dica para Exatas (iteration 8)**: card 💡 "Dica para este material" exibido no MateriaDetailScreen logo antes dos CTAs Quiz/Flashcards quando o nome da matéria contém palavras-chave de exatas (matemática, física, cálculo, álgebra, geometria, trigonometria, estatística, química etc.). Detecção 100% client-side via normalização Unicode NFD. "Entendi" persiste `aviso_exatas_visto=true` via PATCH /api/materias e card não retorna.

## Backlog (P1)
- Apple Sign-In (precisa Apple Developer Account + Service ID + .p8)
- Push notifications (web push API)
- Offline mode com IndexedDB
- Compactar AddContentSheet quando todos 4 tipos de conteúdo + form estiverem visíveis em viewports muito pequenos (parcialmente resolvido em iteration 2)
- Stripe + Cobrança real para Pro (atualmente paywall é teaser)

## Backlog (P2)
- Social real: grupos, duelos 1v1, biblioteca colaborativa, ranking
- Plano Teams (multi-tenant, dashboard professor)
- Geração via outros modelos (GPT-5.2, Gemini) como fallback
- Analytics avançado (Mixpanel/Sentry quando user fornecer chave)

## Test Credentials
Ver `/app/memory/test_credentials.md`
