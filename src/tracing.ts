/**
 * OpenTelemetry bootstrap — MUST be the first thing main.ts imports, before
 * any other module (including NestFactory). Auto-instrumentation works by
 * monkey-patching Node's module loader for http/express/pg/ioredis/etc.;
 * patching only takes effect for modules `require()`'d *after* this runs.
 *
 * Off by default: does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT is set,
 * so a deployment with no collector configured never fails to boot or
 * silently buffers spans nobody's collecting.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'guardtime-backend',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Health/metrics endpoints are noise — every liveness probe would
        // otherwise become a trace.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) =>
            req.url === '/health' || req.url === '/metrics' || req.url?.startsWith('/health/') === true,
        },
        // File-system instrumentation is extremely noisy (every Prisma
        // client codegen read, every log write) and low-value for a web
        // backend — off by default in most OTel setups for this exact reason.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
} else {
  // eslint-disable-next-line no-console
  console.log('[Tracing] OTEL_EXPORTER_OTLP_ENDPOINT not set — OpenTelemetry tracing disabled.');
}
