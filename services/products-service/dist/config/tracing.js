"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'products-service';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const sdk = new sdk_node_1.NodeSDK({
    resource: (0, resources_1.resourceFromAttributes)({ 'service.name': SERVICE_NAME }),
    traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: `${OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
        (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
        }),
    ],
});
sdk.start();
process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());
exports.default = sdk;
