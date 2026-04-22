'use strict';

/**
 * tracing.js — OpenTelemetry instrumentation
 * DEBE importarse ANTES de cualquier otro require en index.js.
 *
 * Configura:
 * - Traces automáticos de HTTP y Express
 * - Exportación a Jaeger vía OTLP (HTTP)
 * - Graceful degradation si el collector no está disponible
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'api-gateway';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    traceExporter: new OTLPTraceExporter({
        url: `${OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            // Desactivar instrumentaciones muy ruidosas
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
        }),
    ],
});

sdk.start();

// Graceful shutdown del SDK
process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());

module.exports = sdk;
