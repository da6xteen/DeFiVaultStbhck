import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import kycRouter from './routes/kyc';
import complianceRouter from './routes/compliance';
import vaultRouter, { publicVaultRouter } from './routes/vault';

const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/public/vault', publicVaultRouter);

const PORT = config.PORT;

let server: any;

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Solana Network: ${config.SOLANA_NETWORK}`);
  });
}

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log('HTTP server closed');
        resolve(null);
      });
    });
  }
  const { prisma } = await import('./lib/prisma');
  await prisma.$disconnect();
  console.log('Database connection closed');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
