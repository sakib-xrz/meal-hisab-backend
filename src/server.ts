import { Server } from 'http';
import app from './app';
import config from './config';
import { logger } from './utils/logger';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

let server: Server | null = null;

async function startServer() {
  server = app.listen(config.port, () => {
    logger.info(`🎯 Server listening on port: ${config.port}`);
  });

  process.on('unhandledRejection', (error) => {
    if (server) {
      server.close(() => {
        logger.error('Unhandled Rejection:', error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

startServer();

process.on('SIGTERM', () => {
  if (server) {
    server.close();
  }
});
