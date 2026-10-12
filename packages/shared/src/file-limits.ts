import { can, getPlanLimits, PlanType } from './plans.js';

export const BYTES_IN_KB = 1024;
export const BYTES_IN_MB = 1024 * 1024;
export const MAX_SYSTEM_SINGLE_FILE_SIZE_BYTES = 25 * BYTES_IN_MB; // 25 MB

export const CLOUD_SHARE_SUGGESTION_MESSAGE =
  'Esse arquivo passa de 25 MB. Compartilhe pelo Google Drive e cole o link aqui.';

export type FileValidationErrorCode =
  | 'NO_FILES'
  | 'INVALID_FILE_SIZE'
  | 'TOO_MANY_FILES'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'OFFLINE_RECIPIENT_NOT_ALLOWED';

export interface FileMetadataInput {
  name?: string;
  size: number;
  mimeType?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  code?: FileValidationErrorCode;
  suggestCloudShare?: boolean;
  details?: {
    fileName?: string;
    fileSize?: number;
    maxAllowedSize?: number;
    filesCount?: number;
    maxAllowedFiles?: number;
    totalSize?: number;
    maxAllowedTotalSize?: number;
    plan: PlanType;
  };
}

export interface OfflineRecipientValidationResult {
  allowed: boolean;
  error?: string;
  code?: 'OFFLINE_RECIPIENT_NOT_ALLOWED';
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);

  const formatted = (bytes / Math.pow(k, idx)).toFixed(dm);
  // remove trailing .0 if integer
  const cleanNumber = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${cleanNumber} ${sizes[idx]}`;
}

/**
 * Checks if a file size exceeds the 25MB system boundary where cloud link sharing is recommended
 */
export function shouldSuggestCloudShare(fileSize: number): boolean {
  return fileSize > MAX_SYSTEM_SINGLE_FILE_SIZE_BYTES;
}

/**
 * Validates a batch of file attachments against account plan limits
 */
export function validateFileLimits(
  plan: PlanType,
  files: FileMetadataInput[],
  options: { requireFiles?: boolean; allowZeroByte?: boolean } = {}
): FileValidationResult {
  const { requireFiles = false, allowZeroByte = true } = options;
  const limits = getPlanLimits(plan);

  if (!files || files.length === 0) {
    if (requireFiles) {
      return {
        valid: false,
        code: 'NO_FILES',
        error: 'Nenhum arquivo informado para envio.',
      };
    }
    return { valid: true };
  }

  // Check file count limit
  if (files.length > limits.maxFilesPerMessage) {
    return {
      valid: false,
      code: 'TOO_MANY_FILES',
      error: `O plano ${limits.name} permite no máximo ${limits.maxFilesPerMessage} arquivo(s) por envio. Você selecionou ${files.length}.`,
      details: {
        filesCount: files.length,
        maxAllowedFiles: limits.maxFilesPerMessage,
        plan,
      },
    };
  }

  let totalSize = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const fileName = file.name?.trim() || `Arquivo ${index + 1}`;

    // Validate valid number
    if (
      typeof file.size !== 'number' ||
      !Number.isFinite(file.size) ||
      file.size < 0 ||
      (!allowZeroByte && file.size === 0)
    ) {
      return {
        valid: false,
        code: 'INVALID_FILE_SIZE',
        error: `O arquivo "${fileName}" possui tamanho inválido (${file.size}).`,
        details: {
          fileName,
          fileSize: file.size,
          plan,
        },
      };
    }

    // Check single file size limit
    if (file.size > limits.maxFileSizeBytes) {
      const isCloudSuggested = shouldSuggestCloudShare(file.size);
      const formattedSize = formatBytes(file.size);
      const formattedLimit = `${limits.maxFileSizeMB} MB`;

      const errorMsg = isCloudSuggested
        ? `O arquivo "${fileName}" (${formattedSize}) excede 25 MB. ${CLOUD_SHARE_SUGGESTION_MESSAGE}`
        : `O arquivo "${fileName}" (${formattedSize}) excede o limite de ${formattedLimit} do plano ${limits.name}.`;

      return {
        valid: false,
        code: 'FILE_TOO_LARGE',
        suggestCloudShare: isCloudSuggested,
        error: errorMsg,
        details: {
          fileName,
          fileSize: file.size,
          maxAllowedSize: limits.maxFileSizeBytes,
          plan,
        },
      };
    }

    totalSize += file.size;
  }

  // Check total batch size limit
  if (totalSize > limits.maxTotalSizeBytes) {
    const formattedTotal = formatBytes(totalSize);
    const formattedTotalLimit = `${limits.maxTotalSizeMB} MB`;

    return {
      valid: false,
      code: 'TOTAL_SIZE_EXCEEDED',
      error: `O tamanho total dos arquivos (${formattedTotal}) excede o teto de ${formattedTotalLimit} por envio no plano ${limits.name}.`,
      details: {
        totalSize,
        maxAllowedTotalSize: limits.maxTotalSizeBytes,
        filesCount: files.length,
        plan,
      },
    };
  }

  return { valid: true };
}

/**
 * Validates whether file transfer is permitted given the recipient's online presence and account plan
 */
export function validateOfflineRecipient(
  plan: PlanType,
  isRecipientOnline: boolean,
  recipientName?: string
): OfflineRecipientValidationResult {
  const allowsOfflineTransfer = can(plan, 'offline_file_transfer');

  if (!allowsOfflineTransfer && !isRecipientOnline) {
    const target = recipientName?.trim() || 'O destinatário';
    return {
      allowed: false,
      code: 'OFFLINE_RECIPIENT_NOT_ALLOWED',
      error: `${target} está offline. No plano Free, arquivos só são enviados para quem está online.`,
    };
  }

  return { allowed: true };
}
