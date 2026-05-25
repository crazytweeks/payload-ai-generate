declare module 'next/headers' {
  export function draftMode(): Promise<{
    isEnabled: boolean;
    enable(): void;
    disable(): void;
  }>;
}

declare module 'next/navigation' {
  export function useRouter(): {
    refresh(): void;
  };
  export function notFound(): never;
  export function redirect(path: string): never;
}

declare module 'next/server' {
  export interface NextRequest {
    headers: Headers;
    url: string;
  }
}
