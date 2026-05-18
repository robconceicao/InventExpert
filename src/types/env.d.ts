// Declaração de tipos para as variáveis de ambiente do arquivo .env
// Importar assim: import { GEMINI_API_KEY } from '@env';

declare module '@env' {
  export const GEMINI_API_KEY: string;
  export const DEEPSEEK_API_KEY: string;
  export const OPENAI_API_KEY: string;
  export const GROQ_API_KEY: string;
}
