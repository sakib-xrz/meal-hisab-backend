import winston from 'winston';
import chalk from 'chalk';
import config from '@/config';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const getColoredLevel = (level: string) => {
  const upperLevel = level.toUpperCase();
  switch (upperLevel) {
    case 'INFO':
      return chalk.bgCyan.bold(upperLevel);
    case 'WARN':
      return chalk.bgYellow.bold(upperLevel);
    case 'ERROR':
      return chalk.bgRed.bold(upperLevel);
    case 'HTTP':
      return chalk.bgMagenta.bold(upperLevel);
    case 'DEBUG':
      return chalk.bgBlue.bold(upperLevel);
    default:
      return upperLevel;
  }
};

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'warn' : 'debug',
  levels: logLevels,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'DD-MM-YYYY HH:mm A' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const coloredLevel = getColoredLevel(level);
          const coloredTimestamp = chalk.white(timestamp);

          if (stack) {
            return `${coloredLevel} [${coloredTimestamp}] ${message}\n${chalk.red(stack)}`;
          }

          return `${coloredLevel} [${coloredTimestamp}] ${message}`;
        }),
      ),
    }),
  ],
});

export { logger };
