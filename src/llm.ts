import OpenAI from "openai";
import { config } from "./config.js";

export function createLlmClient() {
  if (config.aiProvider === "deepseek") {
    if (!config.deepSeekApiKey) return undefined;

    return new OpenAI({
      apiKey: config.deepSeekApiKey,
      baseURL: config.deepSeekBaseUrl
    });
  }

  if (!config.openAiApiKey) return undefined;

  return new OpenAI({
    apiKey: config.openAiApiKey
  });
}

export function getChatModel() {
  if (config.aiProvider === "deepseek") {
    return config.deepSeekModel;
  }

  return config.openAiModel;
}
