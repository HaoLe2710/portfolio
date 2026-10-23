# Frontend API Integration Plan

The frontend defaults to mock data. API mode is optional and must not break the
public portfolio when the backend is unavailable.

## Data Source Modes

- `NEXT_PUBLIC_DATA_SOURCE=mock`: use local mock data only. This is the default.
- `NEXT_PUBLIC_DATA_SOURCE=api`: try public API endpoints, then fall back to mock
  data when a request fails.
- `NEXT_PUBLIC_DATA_SOURCE=hybrid`: reserved for gradual migration; currently
  behaves like API mode with mock fallback.

## Expected Public Endpoints

The API source assumes localized, UI-ready responses that match the existing
frontend `Localized*` TypeScript types.

- `GET /public/profile?locale=en`
- `GET /public/skills?locale=en`
- `GET /public/projects?locale=en`
- `GET /public/projects/{slug}?locale=en`
- `GET /public/achievements?locale=en`
- `GET /public/certificates?locale=en`
- `GET /public/blog-posts?locale=en`
- `GET /public/blog-posts/{slug}?locale=en`
- `GET /public/site-settings?locale=en`
- `GET /public/contact-links?locale=en`

## Frontend Behavior

- Public pages import only `src/lib/portfolio-service.ts`.
- The service chooses the active data source internally.
- Mock data remains the source of truth during frontend-first development.
- API failures fall back to mock data at the service layer.
- Unknown project/blog slugs should return `null` so route pages can call
  `notFound()`.
- Backend DTOs should be normalized into the existing frontend types before UI
  components consume them.
