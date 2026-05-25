declare module '@payload-config' {
  const config: import('payload').SanitizedConfig | Promise<import('payload').SanitizedConfig>;
  export default config;
}

declare module 'next/headers' {
  export function draftMode(): Promise<{
    isEnabled: boolean;
  }>;
}

declare module 'next/navigation' {
  export function notFound(): never;
  export function useRouter(): {
    refresh: () => void;
  };
}
