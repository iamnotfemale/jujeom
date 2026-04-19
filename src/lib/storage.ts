import { supabase } from './supabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Validates and uploads an image to Supabase Storage.
 *
 * @param bucket  - Storage bucket name (e.g. 'store-assets')
 * @param file    - The File object to upload
 * @param path    - Directory or fixed path inside the bucket.
 *                  If `uniqueName` is true (default), a timestamp is appended for unique filenames.
 *                  If false, the extension is appended directly, making the URL predictable (good for logos).
 * @param options.uniqueName - When true, generates a unique filename with timestamp (default: true).
 */
export async function uploadImage(
  bucket: string,
  file: File,
  path: string,
  options?: { uniqueName?: boolean },
): Promise<UploadResult> {
  // --- File type validation ---
  if (!file.type.startsWith('image/')) {
    return { url: null, error: '이미지 파일만 업로드할 수 있습니다 (PNG, JPG, WEBP 등)' };
  }

  // --- File size validation ---
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      url: null,
      error: `파일 크기가 너무 큽니다 (${sizeMB}MB). 최대 5MB까지 업로드 가능합니다.`,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const uniqueName = options?.uniqueName ?? true;
  // When uniqueName is true, append a timestamp for unique filenames (menu images etc.).
  // When false, use a fixed path so the URL is predictable (logo, QR).
  const filePath = uniqueName ? `${path}/${Date.now()}.${ext}` : `${path}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('Supabase storage upload failed:', { bucket, filePath, error });

    // Provide user-friendly messages for common errors
    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
      return {
        url: null,
        error: `스토리지 버킷 '${bucket}'을(를) 찾을 수 없습니다. Supabase 대시보드에서 '${bucket}' 버킷을 생성하고 Public 접근을 허용해주세요.`,
      };
    }
    if (error.message?.includes('Payload too large') || error.message?.includes('size')) {
      return { url: null, error: '파일이 너무 큽니다. 더 작은 이미지를 사용해주세요.' };
    }
    if (error.message?.includes('policy') || error.message?.includes('permission') || error.message?.includes('not allowed')) {
      return {
        url: null,
        error: `버킷 '${bucket}'에 업로드 권한이 없습니다. Supabase 대시보드에서 Storage Policy를 확인해주세요.`,
      };
    }

    return { url: null, error: `업로드 실패: ${error.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

/**
 * Build the predictable public URL for an asset uploaded via uploadImage().
 * Appends a cache-buster so the browser fetches the latest version.
 */
export function getAssetPublicUrl(bucket: string, path: string, ext: string = 'png'): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(`${path}.${ext}`);
  return data.publicUrl;
}

export async function deleteImage(bucket: string, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Supabase storage delete failed:', { bucket, path, error });
  }
  return !error;
}
