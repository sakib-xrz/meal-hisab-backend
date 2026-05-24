import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  corsOrigin: string;
  jwt: {
    accessTokenSecret: string;
    accessTokenExpiresIn: string;
  };
  emailSender: {
    email: string;
    app_pass: string;
  };
  frontendBaseUrl: string;
  cloudflareR2: {
    account_id?: string;
    access_key_id?: string;
    secret_access_key?: string;
    bucket_name?: string;
    public_url?: string;
  };
}

const config: Config = {
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '',
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET || '',
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '',
  },
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || '',
  emailSender: {
    email: process.env.EMAIL_SENDER_EMAIL || '',
    app_pass: process.env.EMAIL_SENDER_APP_PASS || '',
  },
  cloudflareR2: {
    account_id: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    access_key_id: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secret_access_key: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket_name: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    public_url: process.env.CLOUDFLARE_R2_PUBLIC_URL,
  },
};

export default config;
