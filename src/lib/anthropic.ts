import Anthropic from "@anthropic-ai/sdk";

export function isIAConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropicClient() {
  if (!isIAConfigured()) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
