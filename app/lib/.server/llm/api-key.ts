import { env } from 'node:process';

export function getAPIKey(
  cloudflareEnv: Env,
  provider: 'anthropic' | 'openai' = 'anthropic',
) {
  /**
   * The `cloudflareEnv` is only used when deployed or when previewing locally.
   * In development the environment variables are available through `env`.
   */
  const varName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
  return (env as Record<string, string | undefined>)[varName] ||
    (cloudflareEnv as Record<string, string | undefined>)[varName];
}
