import { Worker, Job } from 'bullmq';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010;

// Configurar Redis. Soporta Sentinel si está configurado en docker-compose
const redisOptions: any = {};
if (process.env.REDIS_SENTINEL_HOSTS) {
  const hosts = process.env.REDIS_SENTINEL_HOSTS.split(',');
  redisOptions.sentinels = hosts.map((h: string) => {
    const [host, port] = h.split(':');
    return { host, port: parseInt(port, 10) || 26379 };
  });
  redisOptions.name = process.env.REDIS_SENTINEL_NAME || 'kiora-master';
} else {
  redisOptions.host = process.env.REDIS_HOST || 'localhost';
  redisOptions.port = parseInt(process.env.REDIS_PORT || '6379', 10);
}

if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}

// BullMQ requires maxRetriesPerRequest to be null for blocking commands
redisOptions.maxRetriesPerRequest = null;

const connection = new Redis(redisOptions);

connection.on('error', (err: Error) => {
  console.error('[SIESA Integration] Redis connection error:', err);
});
connection.on('ready', () => {
  console.log('[SIESA Integration] Connected to Redis successfully.');
});

console.log('[SIESA Integration] Inicializando Worker de BullMQ para SIESA...');

const worker = new Worker(
  'siesa-sync-queue',
  async (job: Job) => {
    console.log(`[SIESA Integration] Procesando trabajo ${job.id} de tipo ${job.name}`);
    
    // MOCK ADAPTER PARA SIESA ERP
    if (job.name === 'SYNC_ORDER') {
      const orderData = job.data;
      console.log(`[SIESA Integration] [MOCK] Enviando pedido al ERP... Payload:`, orderData);
      
      const delayMs = parseInt(process.env.SIESA_ERP_MOCK_DELAY_MS || '1500', 10);
      
      // Simulamos latencia de red hacia el ERP
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      console.log(`[SIESA Integration] [MOCK] Pedido enviado a SIESA exitosamente.`);
      return { status: 'success', siesa_doc_id: `ERP-${Date.now()}` };
    }

    throw new Error(`Tipo de trabajo no soportado: ${job.name}`);
  },
  { connection }
);

worker.on('completed', (job: Job) => {
  console.log(`[SIESA Integration] Trabajo ${job.id} completado con resultado:`, job.returnvalue);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[SIESA Integration] Trabajo ${job?.id} falló:`, err.message);
});

// Endpoint de Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'siesa-integration-service' });
});

app.listen(PORT, () => {
  console.log(`[SIESA Integration] Health server listening on port ${PORT}`);
});
