import type { CorsOptions } from 'cors';

export function parseCorsOrigins(value: string | undefined, isProduction: boolean) {
  const origins = (value ?? (isProduction ? '' : '*')).split(',').map((origin) => origin.trim()).filter(Boolean);
  if (isProduction && origins.includes('*')) throw new Error('CORS_ORIGIN must not contain * in production');
  return origins;
}

export function createCorsOptions(origins: string[]): CorsOptions {
  return {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || origins.includes('*') || origins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      const rejection = Object.assign(new Error('Origine CORS refusée'), { status: 403 });
      callback(rejection);
    },
  };
}
