import { MEDIA_PATH_PREFIX } from "./constants";

export function mediaUrl(r2Key: string) {
    return `${MEDIA_PATH_PREFIX}/${r2Key}`;
}
  