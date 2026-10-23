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
- Các branch preview build từ staging Worker/D1 tại `https://web-portfolio-api-staging.lengochao123-27102004.workers.dev/api`, dùng `CF_PAGES_URL` làm canonical của chính preview và sinh `noindex, follow`.

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

## CMS admin and staging releases (Phase 3–4)

CMS chạy tại `/admin` trên cùng Pages origin. Giao diện vẫn được xuất tĩnh; `functions/api/admin/[[path]].ts` chuyển tiếp riêng `/api/admin/*` qua Pages Service Binding. Preview dùng Worker `web-portfolio-api-staging`; production chỉ dùng Worker `web-portfolio-api` sau khi triển khai Phase 3 được chấp thuận. Không cần CORS hoặc third-party cookie. Trang admin có `noindex`, `X-Robots-Tag`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin` và không được cache. API response admin đặt `Cache-Control: no-store, private`.

Đăng nhập chỉ dành cho owner/admin đã được bootstrap. Không có đăng ký công khai. Mật khẩu mới dùng Argon2id v1.3 (salt ngẫu nhiên 16 byte, hash 32 byte, 19.456 KiB bộ nhớ, 2 lượt, 1 lane) qua WASM trên Worker. Tài khoản PBKDF2-SHA-256 cũ (100.000 vòng) vẫn đăng nhập được và được nâng cấp sang Argon2id sau lần đăng nhập hợp lệ. Session random chỉ lưu hash trong D1 và dùng cookie `HttpOnly`, `SameSite=Lax`, `Secure` trên HTTPS. POST/PUT/PATCH/DELETE và đăng nhập phải có `Origin` cùng origin. Đăng nhập bị giới hạn 5 lần mỗi 15 phút theo IP. Đổi mật khẩu thu hồi mọi session.

CMS đọc snapshot từ các bảng published hiện có; thao tác Save/Discard/Restore ghi các bảng `admin_*` và lưu revision/audit, có kiểm tra version để phát hiện cập nhật đồng thời. Phase 4 bổ sung immutable release snapshots, Owner-only publish/unpublish, kiểm tra deployment, retry có giới hạn và content rollback bằng release mới. Public content chỉ chuyển sang release live sau khi Pages Preview build và smoke verification thành công. Workflow hiện bị khóa ở staging; Pages production, Worker production và D1 production không được cập nhật bởi các thao tác CMS này. Không triển khai R2, media upload hay public write API.

### Chạy CMS local

```bash
pnpm db:migrate:local
pnpm db:seed:local
pnpm admin:bootstrap:local
```

Lệnh bootstrap hỏi email và mật khẩu trực tiếp trong terminal; mật khẩu không được echo hay ghi vào repo. Sau đó chạy Worker và Pages ở hai terminal:

```bash
pnpm exec wrangler dev --config api/wrangler.toml --name web-portfolio-api-staging --ip 127.0.0.1 --port 8787
pnpm preview:pages
```

Local browser suite tự khởi động cả hai process theo đúng thứ tự và kiểm tra Pages Function qua Service Binding. `pnpm api:test` kiểm tra auth/session, CSRF/origin, rate limit, role, snapshot/revision isolation, optimistic concurrency và schema.

### Staging Cloudflare

Staging phải là D1 riêng tên `portfolio_db_staging`, Worker `web-portfolio-api-staging` và Pages preview deployment. Không chạy migration/seed/bootstrap staging với `api/wrangler.toml` hay production database. Sau khi tạo D1 staging, thêm UUID trả về vào `api/wrangler.staging.toml`; sau đó:

```bash
pnpm db:migrate:staging
pnpm db:seed:staging
pnpm admin:bootstrap:staging
pnpm api:deploy:staging
```

Bootstrap staging cũng yêu cầu terminal tương tác và email/mật khẩu do operator chọn. Wrangler Pages phải đọc `wrangler.toml` để áp dụng service binding: preview → `web-portfolio-api-staging`, production → `web-portfolio-api`. Trong Dashboard xác minh Workers & Pages → `web-porfolio` → Settings → Functions → Service bindings và bật Preview deployments cho branch staging.

Phase 4 staging release cần cấu hình Worker staging (không đặt các giá trị này trong repo):

```bash
pnpm exec wrangler secret put CLOUDFLARE_API_TOKEN --config api/wrangler.staging.toml
pnpm exec wrangler secret put PAGES_BUILD_TOKEN --config api/wrangler.staging.toml
pnpm api:deploy:staging
```

`CLOUDFLARE_API_TOKEN` phải là token hẹp quyền cho Pages project `web-porfolio`; `PAGES_BUILD_TOKEN` là secret ngẫu nhiên riêng dùng để xác thực Pages build với staging Worker. Worker vars cố định trong `api/wrangler.staging.toml` giới hạn project, GitHub repo và branch. Pages project Preview environment nhận release ID/checksum và build token lúc tạo deployment. Không dùng Wrangler OAuth credential làm runtime token, không paste secret vào chat, shell history hoặc source. Nếu staging Worker secrets chưa được cấu hình, CMS draft vẫn có thể dùng nhưng publish sẽ fail-closed.

Publish đóng băng toàn bộ content thành release snapshot/checksum, tạo Pages Preview từ commit Git branch staging, rồi kiểm tra release manifest, route/locales, metadata, assets, nội dung, sitemap/robots và Pages Admin Function. Scheduled reconciliation chạy mỗi phút để đồng bộ trạng thái job. Retry chỉ dành cho failure đã xác định và tối đa ba attempt; timeout/ambiguous request phải reconcile trước để tránh tạo deployment trùng. Unpublish cũng là release mới; rollback content tạo release mới từ snapshot lịch sử. Endpoint Pages deployment rollback bị chặn vì Cloudflare rollback API nhắm production. CMS UI hiển thị release history và trạng thái deploy.

Kiểm tra tại Preview thực tế bằng `pnpm test:admin:preview` theo biến môi trường hướng dẫn bên dưới. Unit/integration fake provider không thay thế Pages Preview E2E. Chỉ xem staging release là đã nghiệm thu sau khi một Preview deployment thực tế qua xác minh; production chưa nằm trong Phase 4.

Migrations `0002_admin_cms.sql`, `0003_argon2id_auth.sql`, và `0004_content_release_workflow.sql` là additive/giữ dữ liệu; không sửa `0001_init_schema.sql`. `0003` giữ tương thích tài khoản PBKDF2 cũ. Nếu cần dừng workflow, revert code rồi redeploy riêng staging Worker/Pages; giữ `admin_*` và release history cho đến khi backup và phê duyệt riêng việc xóa. Không áp dụng rollback SQL phá hủy hoặc release workflow lên production.

Tài liệu: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Cloudflare Pages static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/) và [Wrangler Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
