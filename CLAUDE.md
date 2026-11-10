# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ASP.NET Core Web API starter kit (.NET 10, SQL Server) with a single project, `API/`. The README (in Vietnamese) is the authoritative reference for conventions, the error format, and the auth flow. This file summarizes what matters when changing code. User-facing text (validation messages, exception `detail`, code comments) is written in Vietnamese; keep it that way.

## Commands

Run these from `API/`:

```bash
dotnet tool restore                       # installs the pinned dotnet-ef (10.0.14)
dotnet build
dotnet run --launch-profile http          # http://localhost:5157/swagger, /health/ready
```

Secrets (the connection string, `Seed:AdminPassword`, and `JwtSettings:SecretKey`, which must be at least 32 bytes) live in user-secrets. User-secrets load only in the Development environment, so EF commands need that environment set:

```bash
# PowerShell: $env:ASPNETCORE_ENVIRONMENT="Development"
ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add AddXxx -o Data/Migrations
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update
dotnet ef migrations script --idempotent  # for production; the app never auto-migrates
```

Tests live in `API.Tests` (xUnit, `WebApplicationFactory`, real SQL Server) and run with `dotnet test` from the repo root. Set `TEST_SQL_CONNECTION` (no Initial Catalog) to use an existing server; otherwise Testcontainers starts SQL Server and needs Docker in Linux containers mode. Stop any running `API.exe` first, because it locks the build output. Browser tests live in `Client/e2e` and run with `npm run e2e` from `Client/` using the same `TEST_SQL_CONNECTION`; they recreate and drop a `StarterKit_E2E` database and need ports 5157 and 4200 free. There is no CI yet. `API/API.http` holds manual request samples. No password is seeded by migrations: `Startup/AdminSeedConfiguration.cs` creates user `admin` at startup when `Users` is empty and migrations are applied, using `Seed:AdminPassword`.

After changing a controller or DTO, run `npm run api:gen` from `Client/` and commit the regenerated `API/openapi.json` and `Client/src/app/core/api/schema.d.ts`. Declare every response with `[ProducesResponseType]`, because those attributes are the source of the Client's types.

## Architecture

- **Startup**: `Program.cs` only chains extension methods. Each concern lives in its own file under `Startup/` or `Common/Security/`. `PipelineConfiguration.cs` sets the middleware order, and that order is deliberate: ForwardedHeaders → security headers → request logging → exception handler/status code pages → HSTS/HTTPS redirection → Angular static files → CORS → rate limiter → authN → authZ. Options classes use `ValidateOnStart`, so invalid configuration fails at startup. Scheduled jobs are `BackgroundService`s registered in `Startup/BackgroundJobsConfiguration.cs` (SQL Server Express has no SQL Agent); `RefreshTokenCleanupService` deletes refresh tokens expired for more than `Cleanup:RefreshTokenRetentionDays`, catching errors so a failed run never stops the app.
- **Layering**: `Controllers → Services → Data → Models`. Any layer may use `Common`. Services take `IUnitOfWork`, which exposes `Repository<T>()` for EF and `.Dapper` for raw SQL and stored procedures.
- **EF + Dapper share one connection and transaction**: `DapperDbContext` borrows `EFDbContext`'s connection and its current transaction. `IUnitOfWork.ExecuteInTransactionAsync` runs inside the EF execution strategy, joins any outer transaction instead of opening a nested one, and calls `SaveChangesAsync` before commit. Never begin, commit, or roll back a transaction on the Dapper side.
- **`EFDbContext.SaveChangesAsync` is where the cross-cutting behavior happens**, for entities that inherit `AuditableEntity`:
  - It sets `CreatedAt`/`UpdatedAt`.
  - It turns `Repository.Delete(entity)` into a soft delete (`IsActive = false`, `DeletedAt = now`). Use `.IgnoreQueryFilters()` to see deleted rows; a global query filter then hides rows where `DeletedAt != null`.
  - It writes `AuditLogs` rows with old and new values, using `IUserContext` for user and IP. Sensitive columns such as `PasswordHash` are logged by name only.
  - Writes made through Dapper or `ExecuteUpdate/ExecuteDeleteAsync` bypass all of this.
- **DateTime**: a value converter (EF) and `UtcDateTimeTypeHandler` (Dapper) mark every value read from the database as UTC. Get the current time from the injected `TimeProvider` (`_timeProvider.GetUtcNow().UtcDateTime`), never from `DateTime.UtcNow`/`Now`.
- **Errors**: services throw `AppException` subclasses (`Common/Exceptions/AppExceptions.cs`). Controllers do not return `BadRequest`/`NotFound` themselves. `GlobalExceptionHandler` maps these exceptions to Problem Details with a `code` from `ErrorCodes.cs`. It maps DB unique/FK/concurrency errors to 409 (from EF and from Dapper), and every other exception to a 500 with the message hidden.
- **Validation**: FluentValidation runs through `FluentValidationFilter`. The implicit `[Required]` is disabled, so every required string needs `NotEmpty()`. Validators check format only. Checks that need the database (duplicates, existence) belong in the service.
- **Authorization**: a FallbackPolicy requires authentication on every endpoint. Use `[AllowAnonymous]` to open an endpoint and `[Authorize(Roles = Roles.Admin)]` to restrict one. Refresh tokens sit in an HttpOnly cookie scoped to `/api/auth` and are rotated on each refresh. Reusing a token more than 30 seconds after rotation revokes every session for that user. Ten consecutive wrong passwords (login or change-password) lock the account for 15 minutes (`Lockout` settings, 429 `ACCOUNT_LOCKED`); while locked the password is not checked, and admins can unlock with `PUT /api/users/{id}/unlock`. Tests must not send wrong passwords for the shared `admin` account.
- **Mapping**: Mapster maps properties with matching names automatically. Put special cases in `Common/Mappings/MappingConfig.cs`.
- **Hosting**: in production the API also serves the Angular build from `wwwroot` (`Startup/ClientAppConfiguration.cs`), so IIS needs one site and no URL Rewrite or ARR. `/api/*` goes to controllers, an unknown `/api/*` path stays a Problem Details 404, and every other path is a file or `index.html`. Hashed files are cached for a year, `index.html` is `no-cache` and carries the CSP, and static files are compressed while `/api` responses never are (BREACH). In development there is no `wwwroot`, so this is off and `ng serve` proxies `/api`. `deploy/iis/publish.ps1` builds `publish/app` (API plus `wwwroot`) and `migrate.sql`; `deploy.ps1` backs up the database (`COPY_ONLY`) before migrating. Deployment scripts must stay UTF-8 with BOM so Windows PowerShell 5.1 reads the Vietnamese text.

## Adding a module

Copy the Category vertical slice:

1. Entity inheriting `AuditableEntity`
2. `Data/Configurations/*Configuration.cs`
3. A `DbSet` in `EFDbContext`
4. DTOs named `XxxCreateRequest`/`XxxUpdateRequest`/`XxxQueryRequest` (inheriting `PagedListQueryBase`)/`XxxResponse`
5. Validators
6. Service interface and implementation
7. Controller
8. `AddScoped` registration in `Startup/ApplicationServicesConfiguration.cs`
9. A migration

Patterns to follow:
- **List queries** (`Data/Extensions/QueryableExtensions.cs`): filter with `WhereIf(request.X.HasValue, x => x.X == request.X)` so values become SQL parameters, search with `ApplySearch`, and sort with `ApplySorting(request.SortBy, request.Desc, SortColumns)`. The `SortColumns` whitelist is required (see `CategoryService`); unknown columns fall back to `Id`, and `Id` is appended as a tiebreaker so paging stays stable.
- **Updates**: load the entity with `Query(asNoTracking: false)`, change its properties, then call `SaveChangesAsync`. No `Update()` call is needed.
- **`PUT`** returns 200 with the updated record.
- **Concurrency**: `AuditableEntity.RowVersion` is a SQL Server rowversion. Return it in the response, accept it in the update request, and compare it in the service; see `CategoryService.UpdateAsync`.
- **Client**: copy `Client/src/app/features/categories` and add one line to `core/navigation/navigation.ts`. Forms call the API and show their own errors; list state (page, search, sort) lives in the URL through `shared/ui/table/list-query.ts`. Features use only `shared/ui` for UI (ESLint blocks `@angular/cdk` there), design tokens from `src/tailwind.css` instead of raw colors, and Lucide icons instead of emoji.
- **Excel export**: the API builds the file (ClosedXML through `IExcelExporter`), so it contains every row matching the filter. Share one `BuildListQuery` between `GetPagedAsync` and `ExportAsync`, declare columns from the response DTO so entity fields such as `PasswordHash` cannot leak, call `EnsureWithinLimit` before loading rows, and register a `GET .../export` action. See `CategoryService.ExportAsync`. `Export:MaxRows` and `Export:TimeZone` are configured in appsettings.
- **Routes** are written in lowercase (`[Route("api/categories")]`), not `[controller]`: the refresh cookie's path is case-sensitive and the generated OpenAPI paths follow the attribute.
