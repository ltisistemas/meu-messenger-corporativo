import { describe, it, expect } from 'vitest';
import {
  can,
  getPlanLimits,
  PLAN_CONFIGS,
  validateUserLimit,
  isOverQuota,
  validateFileAttachment,
} from '../plans.js';

describe('Plan Configuration & Limits (T-03)', () => {
  describe('Plan Features & can() helper', () => {
    it('should enforce Free plan feature gates', () => {
      const free = getPlanLimits('free');
      expect(free.maxUsers).toBe(12);
      expect(free.maxFileSizeMB).toBe(5);
      expect(free.maxFilesPerMessage).toBe(1);
      expect(free.maxTotalSizeMB).toBe(5);
      expect(can('free', 'offline_file_transfer')).toBe(false);
      expect(can('free', 'broadcast_list')).toBe(false);
      expect(can('free', 'polls')).toBe(false);
      expect(can('free', 'electronic_signature')).toBe(false);
      expect(can('free', 'temporary_groups')).toBe(true);
    });

    it('should enforce Pro plan feature gates', () => {
      const pro = getPlanLimits('pro');
      expect(pro.maxUsers).toBe(80);
      expect(pro.maxFileSizeMB).toBe(25);
      expect(pro.maxFilesPerMessage).toBe(5);
      expect(pro.maxTotalSizeMB).toBe(125);
      expect(pro.trialDays).toBe(14);
      expect(can('pro', 'offline_file_transfer')).toBe(true);
      expect(can('pro', 'broadcast_list')).toBe(true);
      expect(can('pro', 'polls')).toBe(true);
      expect(can('pro', 'electronic_signature')).toBe(false);
      expect(can('pro', 'temporary_groups')).toBe(true);
    });

    it('should enforce Enterprise plan feature gates', () => {
      const enterprise = getPlanLimits('enterprise');
      expect(enterprise.maxUsers).toBe(Number.POSITIVE_INFINITY);
      expect(enterprise.maxFileSizeMB).toBe(25);
      expect(enterprise.maxFilesPerMessage).toBe(20);
      expect(enterprise.maxTotalSizeMB).toBe(100);
      expect(can('enterprise', 'offline_file_transfer')).toBe(true);
      expect(can('enterprise', 'broadcast_list')).toBe(true);
      expect(can('enterprise', 'polls')).toBe(true);
      expect(can('enterprise', 'electronic_signature')).toBe(true);
      expect(can('enterprise', 'temporary_groups')).toBe(true);
    });
  });

  describe('User Limit Validation', () => {
    it('should allow adding users below limits', () => {
      expect(validateUserLimit('free', 11).allowed).toBe(true);
      expect(validateUserLimit('pro', 79).allowed).toBe(true);
      expect(validateUserLimit('enterprise', 1000).allowed).toBe(true);
    });

    it('should block adding users when at or above limit', () => {
      expect(validateUserLimit('free', 12).allowed).toBe(false);
      expect(validateUserLimit('pro', 80).allowed).toBe(false);
    });

    it('should identify over_quota status on downgrade', () => {
      expect(isOverQuota('free', 13)).toBe(true);
      expect(isOverQuota('free', 12)).toBe(false);
      expect(isOverQuota('pro', 81)).toBe(true);
      expect(isOverQuota('enterprise', 99999)).toBe(false);
    });
  });

  describe('File Attachment Limits', () => {
    const MB = 1024 * 1024;

    it('should allow valid single file in Free plan', () => {
      const res = validateFileAttachment('free', [{ size: 4 * MB, name: 'doc.pdf' }]);
      expect(res.valid).toBe(true);
    });

    it('should reject more than 1 file in Free plan', () => {
      const res = validateFileAttachment('free', [
        { size: 1 * MB, name: '1.pdf' },
        { size: 1 * MB, name: '2.pdf' },
      ]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('permite no máximo 1 arquivo');
    });

    it('should reject file > 5 MB in Free plan', () => {
      const res = validateFileAttachment('free', [{ size: 6 * MB, name: 'large.pdf' }]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('excede o limite de 5 MB');
    });

    it('should allow up to 5 files totaling up to 125 MB in Pro plan', () => {
      const res = validateFileAttachment('pro', [
        { size: 25 * MB, name: '1.pdf' },
        { size: 25 * MB, name: '2.pdf' },
        { size: 25 * MB, name: '3.pdf' },
        { size: 25 * MB, name: '4.pdf' },
        { size: 25 * MB, name: '5.pdf' },
      ]);
      expect(res.valid).toBe(true);
    });

    it('should reject file > 25 MB in Pro plan', () => {
      const res = validateFileAttachment('pro', [{ size: 26 * MB, name: 'heavy.zip' }]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('excede o limite de 25 MB');
    });

    it('should reject total size > 100 MB in Enterprise plan', () => {
      const files = Array.from({ length: 5 }, (_, i) => ({
        size: 25 * MB,
        name: `file${i}.pdf`,
      })); // total 125 MB > 100 MB ceiling
      const res = validateFileAttachment('enterprise', files);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('excede o teto de 100 MB');
    });
  });
});
