import type { NextConfig } from "next";

const config: NextConfig = {
  // The webhook route needs the raw request body to verify Meta's HMAC signature.
  // App Router gives us that via request.text(), so no body-parser opt-out is needed.
  output: "standalone",
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
};

export default config;
