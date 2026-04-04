declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };

  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}
