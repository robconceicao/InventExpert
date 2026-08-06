// Declaração de tipos para as variáveis de ambiente do arquivo .env
// Importar assim: import { GEMINI_API_KEY } from '@env';
// Supabase: preferir process.env.EXPO_PUBLIC_* (app.config.js → extra)

declare module '@env' {
  export const GEMINI_API_KEY: string;
  export const DEEPSEEK_API_KEY: string;
  export const OPENAI_API_KEY: string | undefined;
  export const GROQ_API_KEY: string | undefined;
}

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_FORM_CLEANER_URL?: string;
  }
}
