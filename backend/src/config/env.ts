import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  CORS_ORIGIN: z.string()
    .default('http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim())),
  PERSISTENCE_API_BASE_URL: z.string().default('https://api.bridgekitty.persistence.one/api/v1'),
});

export const env = schema.parse(process.env);
