import crypto from "node:crypto";
import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { createError } from "../../utils/createError";
import { IUploadPurpose } from "./upload.interface";

/** Where each kind of upload lands in the Cloudinary account. */
const FOLDERS: Record<IUploadPurpose, string> = {
  gear: "gearup/gear",
  avatar: "gearup/avatars",
};

/**
 * Signs one direct browser → Cloudinary upload. Only the signature leaves the
 * server; the API secret never does. The signature covers the folder and a
 * timestamp (Cloudinary rejects it after an hour), so it can't be reused to
 * write elsewhere.
 */
const createSignature = (
  user: { id: string; role: Role },
  purpose: IUploadPurpose,
) => {
  const { cloud_name, api_key, api_secret } = config.cloudinary;
  if (!cloud_name || !api_key || !api_secret) {
    throw createError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Image uploads aren't set up on this server yet. Paste an image URL instead.",
    );
  }
  if (purpose === "gear" && user.role !== Role.PROVIDER) {
    throw createError(httpStatus.FORBIDDEN, "Only providers can upload gear photos");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    folder: FOLDERS[purpose],
    timestamp,
  };
  // Cloudinary: sort params, join as a=b&c=d, append the secret, SHA-1.
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(toSign + api_secret)
    .digest("hex");

  return {
    cloudName: cloud_name,
    apiKey: api_key,
    folder: FOLDERS[purpose],
    timestamp,
    signature,
  };
};

export const uploadService = { createSignature };
