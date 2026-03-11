const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
];

export function buildLoggerConfig() {
  const env = process.env.NODE_ENV ?? 'development';

  if (env === 'test') {
    return false;
  }

  if (env === 'production') {
    return {
      level: LOG_LEVEL,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            remoteAddress: request.ip,
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
    };
  }

  return {
    level: LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  };
}
