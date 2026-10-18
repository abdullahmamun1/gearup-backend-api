import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type Part,
} from "@google/genai";
import httpStatus from "http-status";
import { z } from "zod";
import config from "../config";
import { createError } from "../utils/createError";

/** Null when GEMINI_API_KEY is missing: the AI endpoints then answer 503. */
export const gemini = config.gemini.api_key
  ? new GoogleGenAI({ apiKey: config.gemini.api_key })
  : null;

const TIMEOUT_MS = 20_000;

/**
 * The JSON schema Gemini is asked to follow, generated from the same Zod
 * schema that validates the reply. Gemini's schema support is a subset of
 * JSON Schema, so drop the keywords it doesn't need.
 */
const toGeminiSchema = (schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
};

type GenerateOptions<T extends z.ZodType> = {
  /** Who the model is and the rules it follows. */
  system: string;
  /** The conversation so far, or a single user prompt. */
  contents: Content[] | string;
  /** Shape of the reply: sent to Gemini and used to validate what comes back. */
  schema: T;
  /** Extra parts on the last user turn, e.g. an inline image. */
  attachments?: Part[];
  temperature?: number;
};

/**
 * One structured call to Gemini. Every failure becomes a friendly HTTP error:
 * missing key 503, quota 429, timeout 504, anything else (including a reply
 * that doesn't match the schema) 502.
 */
export const generateJson = async <T extends z.ZodType>({
  system,
  contents,
  schema,
  attachments,
  temperature = 0.4,
}: GenerateOptions<T>): Promise<z.infer<T>> => {
  if (!gemini) {
    throw createError(
      httpStatus.SERVICE_UNAVAILABLE,
      "The AI assistant isn't set up on this server yet.",
    );
  }

  const turns: Content[] =
    typeof contents === "string"
      ? [{ role: "user", parts: [{ text: contents }] }]
      : contents;
  if (attachments?.length) {
    const last = turns[turns.length - 1];
    if (last) last.parts = [...(last.parts ?? []), ...attachments];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await gemini.models.generateContent({
      model: config.gemini.model,
      contents: turns,
      config: {
        systemInstruction: system,
        temperature,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(schema),
        // Short, grounded answers don't need long reasoning, and every
        // second counts in a chat.
        thinkingConfig: {
          thinkingLevel: config.gemini.thinking as ThinkingLevel,
        },
        abortSignal: controller.signal,
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text ?? "");
    } catch {
      throw createError(
        httpStatus.BAD_GATEWAY,
        "The AI sent back something we couldn't read. Please try again.",
      );
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw createError(
        httpStatus.BAD_GATEWAY,
        "The AI sent back something we couldn't use. Please try again.",
      );
    }
    return result.data;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    if (controller.signal.aborted) {
      throw createError(
        httpStatus.GATEWAY_TIMEOUT,
        "The AI took too long to answer. Please try again.",
      );
    }
    if (error instanceof ApiError && error.status === 429) {
      throw createError(
        httpStatus.TOO_MANY_REQUESTS,
        "The AI is busy right now. Please try again shortly.",
      );
    }
    console.error("[ai] Gemini call failed", error);
    throw createError(
      httpStatus.BAD_GATEWAY,
      "The AI assistant is unavailable right now. Please try again later.",
    );
  } finally {
    clearTimeout(timer);
  }
};
