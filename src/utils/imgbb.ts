import { env } from "../config/env.js";

interface ImgBBResponse {
  success: boolean;
  data?: {
    url: string;
    display_url: string;
  };
  error?: {
    message: string;
  };
}

export const uploadImageToImgBB = async (
  imageBuffer: Buffer,
): Promise<string> => {
  if (!env.IMGBB_API_KEY) {
    throw new Error("ImgBB API key is not configured.");
  }

  const formData = new FormData();

  formData.append("image", imageBuffer.toString("base64"));

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
    {
      method: "POST",
      body: formData,
    },
  );

  const result = (await response.json()) as ImgBBResponse;

  if (!response.ok || !result.success || !result.data?.url) {
    throw new Error(
      result.error?.message || "Failed to upload image to ImgBB.",
    );
  }

  return result.data.url;
};
