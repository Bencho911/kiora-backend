'use strict';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'inventory-service';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    traceExporter: new OTLPTraceExporter({
        url: `${OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
        }),
    ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());

export default sdk;
