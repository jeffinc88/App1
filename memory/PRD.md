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
