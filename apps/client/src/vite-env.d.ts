/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production: địa chỉ API, vd. https://api.chua.example.com (dev để trống). */
  readonly VITE_API_URL?: string;
  readonly VITE_GAME_URL?: string;
}
