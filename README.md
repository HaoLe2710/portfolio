# Hao.dev portfolio

Frontend Next.js 16 cho portfolio cá nhân, xuất thành static site để chạy trên Cloudflare Pages. Public site gồm nội dung portfolio, project, blog và i18n Việt/Anh; dữ liệu có thể được lấy từ mock source khi phát triển hoặc Worker API lúc build. Website không truy vấn backend theo từng lượt xem.

## Chạy local

Yêu cầu Node.js 22 và pnpm 11.9.0. Cài dependency theo lockfile:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Trang mặc định là `/en`; tiếng Việt ở `/vi`. Local development mặc định dùng `NEXT_PUBLIC_DATA_SOURCE=mock`, đọc dữ liệu trong `src/data/mock-portfolio.ts` qua `PortfolioSource`. Cloudflare Pages yêu cầu khai báo biến này rõ ràng và build sẽ dừng nếu thiếu hoặc sai giá trị.

## Build và kiểm tra

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm verify:static
pnpm test:browser
```

Hoặc chạy cả bộ smoke test:

```bash
pnpm test:smoke
```

Smoke test xác nhận file HTML cho mọi URL trong sitemap, locale và metadata, 404, redirect `/` sang `/en`, khả năng tải trực tiếp/refresh project và blog detail, cùng việc không có horizontal overflow tại viewport mobile, tablet và desktop. Playwright dùng Chromium; nếu máy chưa có browser:

```bash
pnpm exec playwright install chromium
```

Để xem bản export qua Pages local runtime sau khi build:

```bash
pnpm preview:pages
```

## Static export

`next.config.ts` dùng `output: "export"`; `pnpm build` sinh `out/`. Route locale luôn có prefix `/en` hoặc `/vi`. `next-intl` điều hướng nội bộ theo prefix nhưng không dùng locale negotiation ở request time. `public/_redirects` chuyển `/` tới `/en`; `src/app/global-not-found.tsx` sinh trang 404 chung có đường về cả hai locale.

Project và blog detail được sinh trước bằng `generateStaticParams`, lấy slug từ `PortfolioSource` đang chọn tại build. `NEXT_PUBLIC_DATA_SOURCE=mock` là cấu hình Phase 1. Nếu chuyển sang `api`/`hybrid`, API phải truy cập được trong build; lỗi API ở production sẽ làm build dừng và không xuất mock thay thế.

Ảnh hiện tại không dùng Next Image Optimization server. `images.unoptimized` được bật để ảnh static không cần endpoint `/_next/image`. Metadata, `sitemap.xml` và `robots.txt` được xuất trong build. Đặt `NEXT_PUBLIC_SITE_URL` thành origin public chính xác để canonical, Open Graph và sitemap trỏ đúng domain. Build trên Cloudflare Pages sẽ fail nếu thiếu biến này.

## Cloudflare Pages với Git integration

Pages project `web-porfolio` đã kết nối với GitHub repository `HaoLe2710/portfolio`, production branch `main`, root directory để trống và output directory `out`. Cấu hình Git integration triển khai theo push; không dùng Direct Upload.

Build command là `bash scripts/cloudflare-pages-build.sh`. Script đặt môi trường theo branch:

- `main` build từ Worker API, canonical `https://web-porfolio.pages.dev` và `index, follow`.
- Các branch preview build từ Worker API production tại `https://web-portfolio-api.lengochao123-27102004.workers.dev/api`, dùng `CF_PAGES_URL` làm canonical của chính preview và sinh `noindex, follow`.

Pages build image dùng Node `22` và pnpm `11.9.0`, khớp `.nvmrc` và `packageManager`. Output `out` giữ nguyên. Cấu hình build có thể xác minh bằng Cloudflare Dashboard → Workers & Pages → `web-porfolio` → Settings → Builds & deployments. Không thêm Worker secrets hoặc D1 binding vào Pages; trình duyệt chỉ nhận HTML tĩnh.

API-mode preview đã qua data parity, sitemap/metadata, direct refresh, 404 và responsive smoke test. Build command trên cả `main` lẫn Preview dùng Worker API; `main` dùng canonical production URL và indexability, còn Preview dùng URL riêng và `noindex`.

## Environment variables

| Biến | Nơi cấu hình | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_SOURCE` | Do `scripts/cloudflare-pages-build.sh` đặt | `api` trên main và Preview. |
| `NEXT_PUBLIC_API_BASE_URL` | Do build script đặt | Worker `/api` URL dùng lúc Next.js generate static HTML. |
| `NEXT_PUBLIC_SITE_URL` | Do build script đặt | Production domain trên main; `CF_PAGES_URL` trên Preview. |
| `NEXT_PUBLIC_ROBOTS_INDEX` | Do build script đặt | `true` trên Production; `false` trên Preview. |
| `NODE_VERSION` | `22` trong Pages build settings | Khớp `.nvmrc` để pin Node major cho build image. |
| `PNPM_VERSION` | `11.9.0` trong Pages build settings | Đồng bộ pnpm của build image với `packageManager` trong `package.json`. |

## Worker API và D1 (Phase 2)

Backend mới nằm trong workspace `api/`; cấu hình Wrangler của Worker là `api/wrangler.toml`, còn `wrangler.toml` ở root vẫn thuộc Cloudflare Pages. Worker cung cấp public read API qua Hono và binding `DB` tới D1 `portfolio_db`. Không có route ghi dữ liệu public.

Website tiếp tục dùng Static Export. Khi bật `NEXT_PUBLIC_DATA_SOURCE=api`, các Server Component gọi Worker trong lúc `pnpm run build` để tạo HTML, trang project/blog, metadata và sitemap. Trình duyệt nhận static assets nên không truy vấn D1 theo từng lượt xem.

Chạy local theo thứ tự:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm api:dev
```

Worker local chạy tại `http://127.0.0.1:8787`; API base URL là `http://127.0.0.1:8787/api`. Các migration, seed an toàn, endpoint và bước deploy/rollback được ghi trong [api/README.md](api/README.md).

Production Pages build bằng API sau khi D1 remote đã migrate/seed, Worker production đã kiểm thử, API-mode static build và data parity pass, và Pages preview xác nhận SEO/routes. Nếu build API thất bại, build sẽ dừng và giữ deployment production đang hoạt động cho tới khi phát hành mới.

Tài liệu: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Cloudflare Pages static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/) và [Wrangler Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
