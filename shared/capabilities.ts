/**
 * Pluggable authoring-capability contract.
 *
 * Two features write into content/ at runtime: the Content Manager uploader
 * (POST /api/content/upload) and the AI mock expander (POST /api/chapter/
 * :subject/:chapter/expand). Both work locally, and neither survives a
 * free-tier / serverless deploy — those disks are ephemeral, so writes appear
 * to succeed and then vanish on the next restart.
 *
 * Rather than deleting that code, both sit behind this capability flag. The
 * server enforces it and the client reads it, and because both derive their
 * answer from resolveCapabilities() below they can never disagree.
 *
 * Zero framework dependencies (no React, no DOM, no Node built-ins) so it can
 * be imported unmodified by both the Vite-bundled browser client (src/) and
 * the esbuild-bundled Express server (server.ts) — same rule as shared/exams.ts.
 */

export interface AppCapabilities {
  /** POST /api/content/upload — writes a new chapter pack into content/. */
  contentUpload: boolean;
  /** POST /api/chapter/:subjectSlug/:chapterId/expand — AI-generates questions. */
  aiExpand: boolean;
}

/**
 * What a client assumes when it cannot reach a server that answers
 * /api/capabilities — including a fully static deploy where no server exists.
 */
export const NO_CAPABILITIES: AppCapabilities = {
  contentUpload: false,
  aiExpand: false,
};

export interface CapabilityEnv {
  NODE_ENV?: string;
  /** "true" forces authoring on, "false" forces it off, unset means "auto". */
  ENABLE_AUTHORING?: string;
  GEMINI_API_KEY?: string;
}

/**
 * Resolve authoring capabilities from the environment.
 *
 * - ENABLE_AUTHORING=true  -> on, regardless of NODE_ENV
 * - ENABLE_AUTHORING=false -> off, regardless of NODE_ENV
 * - unset                  -> on outside production, off in production
 *
 * The auto rule is what keeps `npm run dev` working with no config at all
 * while making a deployment safe by default.
 *
 * aiExpand additionally requires a key, since the route cannot do anything
 * useful without one.
 */
export function resolveCapabilities(env: CapabilityEnv): AppCapabilities {
  const flag = env.ENABLE_AUTHORING?.trim().toLowerCase();

  let authoring: boolean;
  if (flag === "false" || flag === "0") authoring = false;
  else authoring = true;

  const hasKey = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim());

  return {
    contentUpload: authoring,
    aiExpand: authoring && hasKey,
  };
}

/** Message shown when a gated route is called while its capability is off. */
export function capabilityDisabledMessage(capability: keyof AppCapabilities): string {
  const feature =
    capability === "contentUpload" ? "Content pack upload" : "AI question expansion";
  return (
    `${feature} is disabled on this deployment. It writes into the content/ ` +
    `folder, which is not persistent on free hosting tiers. Run the app locally, ` +
    `or set ENABLE_AUTHORING=true` +
    (capability === "aiExpand" ? " and provide GEMINI_API_KEY" : "") +
    ` to enable it.`
  );
}
