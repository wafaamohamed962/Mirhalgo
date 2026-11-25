/// <reference types="vite/client" />

/** Public build-time variables (spec 8.6). Optional at type level: lib/env.ts handles missing ones. Only the Supabase ANON key ever reaches the browser. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
  /** 'true' → customer portal data from MSW mocks (MW_002 decision 17). */
  readonly VITE_USE_MOCKS?: string;
  /** 'false' → the companies directory hides company names (decision 18, default true). */
  readonly VITE_SHOW_COMPANY_IDENTITY?: string;
  /** MW_004: company portal demo tools on a staging / preview build ('true'). */
  readonly VITE_DEMO_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
