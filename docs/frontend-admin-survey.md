# Frontend Admin Phase 0 Survey

This document records the current frontend state before adding the admin CMS UI.
Phase 0 is survey and planning only; it does not add runtime code.

## Project Overview

| Area | Confirmed state |
| --- | --- |
| Framework | Next.js `16.2.9`, App Router |
| React | React `19.2.4`, React DOM `19.2.4` |
| TypeScript | TypeScript `^5`, strict mode enabled, path alias `@/* -> ./src/*` |
| Styling | Tailwind CSS `^4`, CSS variables in `src/app/globals.css`, deep green brand accent |
| Icons | Google Material Symbols loaded globally, wrapped by `MaterialIcon` |
| Theme | `next-themes` via `src/providers/theme-provider.tsx` |
| i18n | `next-intl`, locale prefix is always enabled for `en` and `vi` |
| Motion | `framer-motion` used by `AnimatedSection` with reduced-motion support |
| API/data | `axios`, current public API client in `src/lib/api-client.ts` |
| Query library | `@tanstack/react-query` is installed but no app-wide query provider exists yet |
| Forms/validation | `react-hook-form`, `zod`, and `@hookform/resolvers` are installed but not used yet |
| Markdown | `react-markdown` and `remark-gfm` via `MarkdownContent` |

## Directory Map

```txt
frontend/
|-- docs/
|   `-- api-integration-plan.md
|-- messages/
|   |-- en.json
|   `-- vi.json
|-- public/
|-- src/
|   |-- app/
|   |   |-- [locale]/
|   |   |   |-- blog/
|   |   |   |   |-- [slug]/page.tsx
|   |   |   |   `-- page.tsx
|   |   |   |-- projects/
|   |   |   |   |-- [slug]/page.tsx
|   |   |   |   `-- page.tsx
|   |   |   |-- layout.tsx
|   |   |   |-- not-found.tsx
|   |   |   `-- page.tsx
|   |   |-- globals.css
|   |   |-- robots.ts
|   |   `-- sitemap.ts
|   |-- components/
|   |   |-- blog/
|   |   |-- home/
|   |   |-- layout/
|   |   |-- projects/
|   |   `-- ui/
|   |-- data/
|   |   `-- mock-portfolio.ts
|   |-- i18n/
|   |-- lib/
|   |   |-- portfolio/
|   |   |   |-- api-portfolio-source.ts
|   |   |   |-- mock-portfolio-source.ts
|   |   |   |-- portfolio-adapter.ts
|   |   |   `-- portfolio-source.ts
|   |   |-- api-client.ts
|   |   |-- data-source.ts
|   |   |-- portfolio-service.ts
|   |   |-- seo.ts
|   |   `-- utils.ts
|   |-- providers/
|   |   `-- theme-provider.tsx
|   |-- proxy.ts
|   `-- types/
|       `-- portfolio.ts
|-- .env.example
|-- next.config.ts
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
`-- tsconfig.json
```

There is no current `src/features`, `src/services`, `frontend/app`, or root-level
`frontend/components` runtime directory. Future admin work should use `src/`.

## Public Route Survey

All public app routes are under `src/app/[locale]`. `src/proxy.ts` uses
`next-intl` middleware and excludes API/static assets. Locale behavior is
`/en/...` and `/vi/...` because `localePrefix` is `always`.

| Route | Page file | Main components | Current data source | API mapping status |
| --- | --- | --- | --- | --- |
| `/{locale}` | `src/app/[locale]/page.tsx` | `HeroSection`, `AboutSection`, `SkillsSection`, `FeaturedProjectsSection`, `EducationAchievementsSection`, `CertificatesSection`, `LatestBlogSection`, `ContactSection` | `getHomeData()`, `getProfile()` through `portfolio-service` | partially mapped; public source exists but needs envelope unwrap and DTO adapters |
| `/{locale}/projects` | `src/app/[locale]/projects/page.tsx` | `ProjectsPageHeader`, `ProjectFilterTabs`, `AnimatedSection`, `Container` | `getProjects()` through `portfolio-service` | partially mapped |
| `/{locale}/projects/{slug}` | `src/app/[locale]/projects/[slug]/page.tsx` | `ProjectDetailLayout`, project content block components | `getProjectBySlug()` through `portfolio-service` | partially mapped; backend detail DTO differs from current localized project type |
| `/{locale}/blog` | `src/app/[locale]/blog/page.tsx` | `BlogPageHeader`, `BlogList`, `Container` | `getBlogPosts()` through `portfolio-service` | partially mapped |
| `/{locale}/blog/{slug}` | `src/app/[locale]/blog/[slug]/page.tsx` | `BlogPostHeader`, `BlogPostContent`, `MarkdownContent` | `getBlogPostBySlug()` through `portfolio-service` | partially mapped; backend uses `contentMarkdown` and envelope |
| `/robots.txt` | `src/app/robots.ts` | none | SEO helper only | not an API mapping target |
| `/sitemap.xml` | `src/app/sitemap.ts` | none | `getProjects()`, `getBlogPosts()` through `portfolio-service` | partially mapped |

## Existing Data Flow

```txt
src/data/mock-portfolio.ts
  -> src/lib/portfolio/mock-portfolio-source.ts
  -> src/lib/portfolio-service.ts
  -> src/app pages and layout components

NEXT_PUBLIC_DATA_SOURCE=api|hybrid
  -> src/lib/portfolio/api-portfolio-source.ts
  -> src/lib/api-client.ts
  -> backend public API
  -> fallback to mock in portfolio-service on request failure
```

Raw mock data is centralized in `src/data/mock-portfolio.ts` and exports:

- `profile`
- `skillGroups`
- `projects`
- `achievements`
- `certificates`
- `blogPosts`
- `contactLinks`
- `siteSettings`
- `mockPortfolio`

Public pages and layout components import service functions, not raw mock data.
Confirmed service boundary is `src/lib/portfolio-service.ts`.

Data source mode is controlled by `src/lib/data-source.ts`:

- default mode: `mock`
- supported values: `mock`, `api`, `hybrid`
- `api` and `hybrid` both choose `apiPortfolioSource`
- API failure falls back to `mockPortfolioSource` inside `withMockFallback()`

API base URL is controlled by `src/lib/api-client.ts`:

- default: `http://localhost:8080/api`
- override: `NEXT_PUBLIC_API_BASE_URL`
- current API paths are `/public/...`, which combine with the base URL into
  `/api/public/...`

Important gap: backend public/admin docs specify `ApiResponse<T>` envelopes, but
`safeApiGet<T>()` currently returns `response.data` directly as `TResponse`.
Phase 1/2 should add envelope unwrap and DTO-to-frontend adapters.

## Existing Reusable UI Inventory

| Component area | Existing components | Admin reuse potential | Gap for admin |
| --- | --- | --- | --- |
| Buttons | `Button`, `buttonVariants`, `ExternalLinkButton` | good base for actions | no async submit pattern beyond `isLoading`; no destructive confirmation pattern |
| Cards | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `IconCard` | usable for summaries and detail panels | admin pages should avoid nested card layouts |
| Badges | `Badge` | usable for status, tags, publication state | may need semantic status variants |
| Icons | `MaterialIcon` | reusable for admin nav/actions | icon names should stay Material Symbols |
| Layout | `Container`, `SiteHeader`, `SiteFooter`, `MobileMenu`, `NavLink`, `LanguageSwitcher`, `ThemeToggle` | public layout patterns useful for visual consistency | no protected admin shell/sidebar/topbar/breadcrumb |
| Motion | `AnimatedSection` | can support subtle page transitions | should be minimal for admin productivity screens |
| Empty state | `EmptyState` | reusable for list empty states | no error/retry state component yet |
| Markdown | `MarkdownContent` | reusable for blog/project preview | no editor or split preview UI |
| Project blocks | project detail block renderers | useful for previewing project content | no editable block builder |
| Tables | none found | not available | needed for CMS lists |
| Inputs/forms | none found | not available | needed for admin forms |
| Dropdowns/menus | none found | not available | needed for action menus/filter menus |
| Dialogs/modals | none found | not available | needed for confirms and lightweight CRUD |
| Toasts | none found | not available | needed for save/delete feedback |
| Loading state | button spinner only | limited | page/list loading skeletons needed |

## Existing Technical Constraints

- Most App Router pages and layout components are server components.
- Client components currently include theme toggle, language/mobile interactions,
  motion sections, and other interactive UI where needed.
- `NextIntlClientProvider` and `ThemeProvider` are initialized in
  `src/app/[locale]/layout.tsx`.
- No React Query `QueryClientProvider` is initialized yet.
- Axios is used only by `src/lib/api-client.ts`.
- No admin auth, token storage, refresh handling, route guard, or middleware
  protection exists.
- `src/proxy.ts` is currently dedicated to `next-intl` locale routing.
- Form stack is installed but not configured in app code.
- Public types live in `src/types/portfolio.ts`; no backend DTO types or admin
  DTO types exist yet.
- Current public source assumes API responses match frontend localized types, but
  backend contracts expose response envelopes and some field names that need
  adapters.
- Frontend API mode requires the backend to be reachable at
  `NEXT_PUBLIC_API_BASE_URL`; mock mode remains safe by default.
