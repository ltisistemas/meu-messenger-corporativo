export type PlanType = 'free' | 'pro' | 'enterprise';

export type FeatureKey =
  | 'offline_file_transfer'
  | 'broadcast_list'
  | 'polls'
  | 'electronic_signature'
  | 'temporary_groups';

export interface PlanLimits {
  name: string;
  priceMonthlyCents: number;
  maxUsers: number;
  maxFileSizeMB: number;
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
  maxTotalSizeMB: number;
  maxTotalSizeBytes: number;
  trialDays: number;
  features: Record<FeatureKey, boolean>;
}

export const PLAN_CONFIGS: Record<PlanType, PlanLimits> = {
  free: {
    name: 'Free',
    priceMonthlyCents: 0,
    maxUsers: 12,
    maxFileSizeMB: 5,
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxFilesPerMessage: 1,
    maxTotalSizeMB: 5,
    maxTotalSizeBytes: 5 * 1024 * 1024,
    trialDays: 0,
    features: {
      offline_file_transfer: false,
      broadcast_list: false,
      polls: false,
      electronic_signature: false,
      temporary_groups: true,
    },
  },
  pro: {
    name: 'Pro',
    priceMonthlyCents: 7990,
    maxUsers: 80,
    maxFileSizeMB: 25,
    maxFileSizeBytes: 25 * 1024 * 1024,
    maxFilesPerMessage: 5,
    maxTotalSizeMB: 125,
    maxTotalSizeBytes: 125 * 1024 * 1024,
    trialDays: 14,
    features: {
      offline_file_transfer: true,
      broadcast_list: true,
      polls: true,
      electronic_signature: false,
      temporary_groups: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthlyCents: 25990,
    maxUsers: Number.POSITIVE_INFINITY,
    maxFileSizeMB: 25,
    maxFileSizeBytes: 25 * 1024 * 1024,
    maxFilesPerMessage: 20,
    maxTotalSizeMB: 100,
    maxTotalSizeBytes: 100 * 1024 * 1024,
    trialDays: 0,
    features: {
      offline_file_transfer: true,
      broadcast_list: true,
      polls: true,
      electronic_signature: true,
      temporary_groups: true,
    },
  },
};

/**
 * Checks if a plan allows a specific feature
 */
export function can(plan: PlanType, feature: FeatureKey): boolean {
  const config = PLAN_CONFIGS[plan];
  if (!config) return false;
  return Boolean(config.features[feature]);
}

/**
 * Get the limits for a specific plan
 */
export function getPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_CONFIGS[plan] ?? PLAN_CONFIGS.free;
}

/**
 * Validates if an account with a given plan can invite/add more users
 */
export function validateUserLimit(
  plan: PlanType,
  currentActiveUsers: number
): { allowed: boolean; error?: string } {
  const limits = getPlanLimits(plan);
  if (currentActiveUsers >= limits.maxUsers) {
    return {
      allowed: false,
      error: `Limite de ${limits.maxUsers} usuários atingido para o plano ${limits.name}. Faça upgrade para adicionar mais membros.`,
    };
  }
  return { allowed: true };
}

/**
 * Checks if an account is over quota after a plan downgrade
 */
export function isOverQuota(plan: PlanType, currentActiveUsers: number): boolean {
  const limits = getPlanLimits(plan);
  return currentActiveUsers > limits.maxUsers;
}

/**
 * Validates file attachments for a message against plan limits
 */
export function validateFileAttachment(
  plan: PlanType,
  files: { size: number; name?: string }[]
): { valid: boolean; error?: string } {
  const limits = getPlanLimits(plan);

  if (files.length === 0) {
    return { valid: true };
  }

  if (files.length > limits.maxFilesPerMessage) {
    return {
      valid: false,
      error: `O plano ${limits.name} permite no máximo ${limits.maxFilesPerMessage} arquivo(s) por envio.`,
    };
  }

  let totalSize = 0;
  for (const file of files) {
    if (file.size > limits.maxFileSizeBytes) {
      return {
        valid: false,
        error: `O arquivo ${file.name || ''} excede o limite de ${limits.maxFileSizeMB} MB do plano ${limits.name}.`,
      };
    }
    totalSize += file.size;
  }

  if (totalSize > limits.maxTotalSizeBytes) {
    return {
      valid: false,
      error: `O tamanho total dos arquivos excede o teto de ${limits.maxTotalSizeMB} MB do plano ${limits.name}.`,
    };
  }

  return { valid: true };
}

/**
 * Calculates quota status, excess member count, and max limits for an account
 */
export function getQuotaStatus(
  plan: PlanType,
  activeUsersCount: number
): {
  isOverQuota: boolean;
  maxUsers: number;
  excessUsersCount: number;
  error?: string;
} {
  const limits = getPlanLimits(plan);
  const over = activeUsersCount > limits.maxUsers;
  const excess = over ? activeUsersCount - limits.maxUsers : 0;
  return {
    isOverQuota: over,
    maxUsers: limits.maxUsers,
    excessUsersCount: excess,
    error: over
      ? `Sua conta atingiu o limite de usuários do plano ${limits.name} (${activeUsersCount}/${limits.maxUsers}). Desative ${excess} membro(s) excedente(s) ou faça upgrade para voltar a enviar mensagens e convidar.`
      : undefined,
  };
}
