# معماری استقرار و عملیات

وضعیت: طرح اولیه؛ هیچ deployment در Bootstrap انجام نمی‌شود.

## محیط‌ها

| محیط | Data/Secret | هدف |
|---|---|---|
| Local | synthetic، secret محلی خارج Git | توسعه با Docker Compose |
| Test/CI | ephemeral/synthetic | unit/integration/migration/contract |
| Staging | جدا از Production، Provider sandbox | E2E، UAT، smoke و migration rehearsal |
| Production | least privilege، secret manager، داده واقعی | سرویس عملیاتی |

اشتراک DB/bucket/Redis/credential بین محیط‌ها ممنوع و تست روی Production ممنوع است.

## Topology هدف

Nginx/TLS → Next.js web و NestJS API؛ Workerهای BullMQ جدا؛ PostgreSQL، Redis و S3-compatible.
API و Worker image version یکسان/سازگار با event contract deploy می‌شوند. health endpoints:
`/health/live`, `/health/ready`; readiness dependency critical را بررسی می‌کند.

## Pipeline پیشنهادی

1. install از lockfile و verify toolchain
2. format/lint، typecheck، unit و architecture tests
3. integration/contract با serviceهای ephemeral
4. Prisma migration validation و migrate روی DB خالی + upgrade fixture
5. affected builds، image scan/SBOM و image immutable
6. deploy Staging، migration job، smoke/E2E و approval
7. Production فقط با تایید صریح، backup checkpoint و rollout کنترل‌شده

## Migration

expand/contract و backward compatibility برای zero/low downtime. Migration پس از Push immutable.
تغییر مخرب در release جدا، backfill observable و تایید recovery. schema deployment قبل از code
مصرف‌کننده و contract cleanup بعد از حذف مصرف‌کننده.

## Backup و Disaster Recovery

PostgreSQL backup رمزنگاری‌شده + PITR در صورت تایید؛ object versioning/lifecycle؛ config/secret
backup طبق provider. نسخه خارج از سرور و restore drill دوره‌ای. RPO/RTO، retention و region تصمیم بازند.

## Monitoring

API latency/error، saturation، DB connection/slow query، Redis memory، queue depth/age/failure،
Provider/gateway health، paid-not-issued، payment mismatch، storage failure، check reminder lag و
backup freshness. alertها severity/owner/runbook دارند؛ Sentry release و trace correlation فعال می‌شود.

## Nginx و Network

TLS modern، body/header/time limits، security headers، rate limit edge، trusted proxy config؛ DB/Redis/
object admin public نیست. outbound allowlist و egress observation برای Providerها.

## موارد پیش از اجرا

انتخاب hosting/region، domains، certificate/DNS owner، secret manager، managed/self-hosted services،
RPO/RTO، expected traffic، on-call و maintenance window باید تایید شود.
