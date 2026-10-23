# Hao.dev portfolio

Frontend Next.js 16 cho portfolio cá nhân, xuất thành static site để chạy trên Cloudflare Pages. Phase 1 chỉ gồm nội dung portfolio, project, blog và i18n Việt/Anh; không có backend runtime, CMS, Worker API hay D1.

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

Trong Cloudflare Dashboard:

1. Tạo Pages project và kết nối Git repository.
2. Để **Root directory** trống. Git repository `HaoLe2710/portfolio` được khởi tạo trực tiếp tại thư mục `frontend`, nên đây đã là repository root.
3. Đặt **Build command** là `pnpm run build` và **Build output directory** là `out`.
4. Trong **Settings → Environment variables**, ghim build toolchain bằng `NODE_VERSION=22` và `PNPM_VERSION=11.9.0`. `NODE_VERSION` khớp `.nvmrc`; `PNPM_VERSION` khớp `packageManager` trong `package.json`.
5. Thêm các biến ứng dụng cho cả Production và Preview:
   - `NEXT_PUBLIC_DATA_SOURCE=mock`
   - `NEXT_PUBLIC_SITE_URL=https://<canonical-production-origin>`
   - `NEXT_PUBLIC_ROBOTS_INDEX=true` trong Production và `false` trong Preview
6. Nếu gắn custom domain, đặt `NEXT_PUBLIC_SITE_URL` thành origin custom domain (ví dụ `https://portfolio.example`) và chạy deployment mới để metadata được build lại.

`NEXT_PUBLIC_SITE_URL` phải là origin canonical production cho cả hai môi trường; build Preview vẫn phát canonical về trang production. `NEXT_PUBLIC_ROBOTS_INDEX` bắt buộc trên Cloudflare Pages: Production phải là `true`, Preview phải là `false`. Trang Preview giữ `noindex, follow` để bot có thể đọc chỉ thị noindex.

`wrangler.toml` khai báo Pages project name `web-porfolio` và output `./out` cho Wrangler local preview/Direct Upload. Đổi `name` nếu Pages project thực tế dùng tên khác. Khi dùng cấu hình Wrangler để deploy, giữ project name và output directory đồng bộ với Pages project trong Dashboard. Không cần thêm secret ở Phase 1.

Chưa có deployment thực tế trong bước chuẩn bị này. Sau khi lưu Git integration và environment variables, Cloudflare sẽ build mỗi lần push; kiểm tra Build log và preview URL trong Dashboard trước khi gắn domain.

## Environment variables

| Biến | Phase 1 | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_SOURCE` | Required trên Pages (`mock` cho Phase 1) | Nguồn dữ liệu được chọn tại build; Pages build fail nếu biến thiếu hoặc không hợp lệ. |
| `NEXT_PUBLIC_SITE_URL` | Required trên Pages | Origin dùng cho metadata, canonical và sitemap. |
| `NEXT_PUBLIC_ROBOTS_INDEX` | Required trên Pages | `true` cho Production; `false` cho Preview để tránh index nội dung chưa phát hành. |
| `NODE_VERSION` | `22` trong Pages build settings | Khớp `.nvmrc` để pin Node major cho build image. |
| `PNPM_VERSION` | `11.9.0` trong Pages build settings | Đồng bộ pnpm của build image với `packageManager` trong `package.json`. |
| `NEXT_PUBLIC_API_BASE_URL` | Không dùng với `mock` | Base URL adapter nếu chuyển API ở phase sau. |

Tài liệu: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Cloudflare Pages static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/) và [Wrangler Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
