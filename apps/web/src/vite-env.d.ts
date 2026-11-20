/// <reference types="vite/client" />

/** Public build-time variables (spec 8.6). Optional at type level: lib/env.ts handles missing ones. Only the Supabase ANON key ever reaches the browser. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
