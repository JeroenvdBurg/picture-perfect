const baseUrl = import.meta.env.VITE_IMAGE_AI_BACKEND_URL;

let isLoading = false;

if (!baseUrl) {
  throw new Error("VITE_IMAGE_AI_BACKEND_URL is not set");
}

type ApiResponse =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: string;
    };

const toErr = async (
  res: Response,
  msg: string
): Promise<ApiResponse & { ok: false }> => ({
  ok: false as const,
  error: `${msg} ${res.status} ${res.statusText} - ${await res.text()}`,
});

const callApi = (pathname: string, init: RequestInit): Promise<ApiResponse> => {
  if (isLoading) {
    throw new Error("API is already loading");
  }

  isLoading = true;

  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
    },
  })
    .then(async (response) =>
      response.ok
        ? { ok: true as const, data: await response.json() }
        : toErr(
            response,
            `Failed to call Image AI API at ${baseUrl}${pathname}`
          )
    )
    .finally(() => {
      isLoading = false;
    });
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

type SegmentImageOptions =
  | {
      image: File;
      textPrompt: string;
    }
  | {
      imageUrl: string;
      textPrompt: string;
    };

export const postSegmentImage = async (
  options: SegmentImageOptions
): Promise<ApiResponse> => {
  const body: Record<string, string> = {
    textPrompt: options.textPrompt,
  };

  if ("image" in options) {
    body.image = await toBase64(options.image);
  } else {
    body.imageUrl = options.imageUrl;
  }

  return callApi("/api/segment", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

type BlurImageOptions =
  | {
      image: File;
      maskData: string;
    }
  | {
      imageUrl: string;
      maskData: string;
    };

export const postBlurImage = async (
  options: BlurImageOptions
): Promise<ApiResponse> => {
  const body: Record<string, string> = {
    maskData: options.maskData,
  };

  if ("image" in options) {
    body.image = await toBase64(options.image);
  } else {
    body.imageUrl = options.imageUrl;
  }

  return callApi("/api/blur", {
    method: "POST",
    body: JSON.stringify(body),
  });
};
