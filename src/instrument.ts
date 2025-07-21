import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import Transport from 'winston-transport';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

export const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport, {
  levels: ['error', 'warn'],
});
