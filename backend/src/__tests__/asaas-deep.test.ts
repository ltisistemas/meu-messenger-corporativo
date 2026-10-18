import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AsaasGatewayService,
  gerarCpfValidoFallback,
  resolveAsaasBaseUrl,
  resolveAsaasApiKey,
  extrairErroAsaas,
} from '../services/asaas.service';

describe('AsaasGatewayService Deep & Reverse Engineering Compliance', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. Algoritmo de Validação e Fallback de CPF (Modulo 11)', () => {
    it('gerarCpfValidoFallback generates mathematically valid 11-digit CPF with 2 valid check digits', () => {
      for (let i = 0; i < 20; i++) {
        const cpf = gerarCpfValidoFallback();
        expect(cpf).toHaveLength(11);
        expect(/^\d{11}$/.test(cpf)).toBe(true);

        // Verify first check digit (modulo 11)
        const digits = cpf.split('').map(Number);
        const sum1 = digits.slice(0, 9).reduce((acc, val, idx) => acc + val * (10 - idx), 0);
        let d1 = sum1 % 11;
        d1 = d1 < 2 ? 0 : 11 - d1;
        expect(digits[9]).toBe(d1);

        // Verify second check digit (modulo 11)
        const sum2 = digits.slice(0, 10).reduce((acc, val, idx) => acc + val * (11 - idx), 0);
        let d2 = sum2 % 11;
        d2 = d2 < 2 ? 0 : 11 - d2;
        expect(digits[10]).toBe(d2);
      }
    });
  });

  describe('2. Resolução Dinâmica de Credenciais e Ambientes', () => {
    it('resolves production base URL when key starts with $aact_prod_', () => {
      const url = resolveAsaasBaseUrl('$aact_prod_abcdef1234567890');
      expect(url).toBe('https://api.asaas.com/v3');
    });

    it('resolves sandbox base URL when key starts with $aact_hmlg_', () => {
      const url = resolveAsaasBaseUrl('$aact_hmlg_abcdef1234567890');
      expect(url).toBe('https://api-sandbox.asaas.com/v3');
    });

    it('respects priority environment variables ASAAS_BASE_URL_PRODUCAO and ASAAS_BASE_URL_SANDBOX', () => {
      process.env.ASAAS_BASE_URL_PRODUCAO = 'https://custom-prod.asaas.com/v3/';
      process.env.ASAAS_BASE_URL_SANDBOX = 'https://custom-sandbox.asaas.com/v3/';

      expect(resolveAsaasBaseUrl('$aact_prod_123')).toBe('https://custom-prod.asaas.com/v3');
      expect(resolveAsaasBaseUrl('$aact_hmlg_123')).toBe('https://custom-sandbox.asaas.com/v3');
    });

    it('sanitizes quotes and whitespace from API keys', () => {
      expect(resolveAsaasApiKey('" $aact_prod_key123 "')).toBe('$aact_prod_key123');
      expect(resolveAsaasApiKey("'$aact_hmlg_key456'")).toBe('$aact_hmlg_key456');
    });
  });

  describe('3. Extração Unificada de Erros Asaas', () => {
    it('joins multiple error descriptions with semicolons', () => {
      const errorData = {
        errors: [
          { description: 'O CPF informado é inválido.' },
          { description: 'O e-mail é obrigatório.' },
        ],
      };
      const message = extrairErroAsaas(errorData, 'Fallback erro');
      expect(message).toBe('O CPF informado é inválido.; O e-mail é obrigatório.');
    });

    it('falls back to single message or fallback string', () => {
      expect(extrairErroAsaas({ message: 'Token expirado' }, 'Fallback')).toBe('Token expirado');
      expect(extrairErroAsaas({}, 'Fallback')).toBe('Fallback');
    });
  });

  describe('4. Gestão de Clientes e Cascade Lookup', () => {
    it('updates customer document via PUT if existing customer has no CPF', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_key', 'https://api.asaas.com/v3');

      const existingCustomer = {
        id: 'cus_existing1',
        name: 'Cliente Sem CPF',
        email: 'semcpf@teste.com',
        cpfCnpj: null,
      };

      const putUpdatedCustomer = {
        ...existingCustomer,
        cpfCnpj: '11144477735',
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => existingCustomer,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => putUpdatedCustomer,
        } as any);

      const customer = await service.createOrGetCustomer({
        name: 'Cliente Sem CPF',
        email: 'semcpf@teste.com',
        cpfCnpj: '11144477735',
        existingCustomerId: 'cus_existing1',
      });

      expect(customer.id).toBe('cus_existing1');
      expect(customer.cpfCnpj).toBe('11144477735');
    });

    it('searches by document and email before creating when searchBeforeCreate is true', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_key', 'https://api.asaas.com/v3');

      const foundCustomer = {
        id: 'cus_found_doc',
        name: 'Cliente Encontrado',
        email: 'encontrado@teste.com',
        cpfCnpj: '11144477735',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [foundCustomer] }),
      } as any);

      const customer = await service.createOrGetCustomer({
        name: 'Cliente Encontrado',
        email: 'encontrado@teste.com',
        cpfCnpj: '11144477735',
        searchBeforeCreate: true,
      });

      expect(customer.id).toBe('cus_found_doc');
    });
  });

  describe('5. Criação de Assinatura com Backoff Progressivo', () => {
    it('retries when initial payment list is empty until payment appears', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_key', 'https://api.asaas.com/v3');

      const subResponse = {
        id: 'sub_test_backoff',
        customer: 'cus_1',
        billingType: 'PIX',
        value: 79.9,
      };

      const delayedPayment = {
        id: 'pay_delayed_1',
        customer: 'cus_1',
        subscription: 'sub_test_backoff',
        status: 'PENDING',
        value: 79.9,
      };

      const qrResponse = {
        encodedImage:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        payload: 'pixcopypaste123',
        expirationDate: '2026-11-01T00:00:00Z',
      };

      // Call 1: POST /subscriptions
      // Call 2: GET /subscriptions/sub_test_backoff/payments -> empty
      // Call 3: GET /subscriptions/sub_test_backoff/payments -> retry returns payment!
      // Call 4: GET /payments/pay_delayed_1/pixQrCode
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => subResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [delayedPayment] }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => qrResponse,
        } as any);

      const res = await service.createSubscription({
        customerId: 'cus_1',
        billingType: 'PIX',
        value: 79.9,
        nextDueDate: '2026-11-01',
        cycle: 'MONTHLY',
        description: 'NextMsg Pro',
      });

      expect(res.subscription.id).toBe('sub_test_backoff');
      expect(res.initialPayment?.id).toBe('pay_delayed_1');
      expect(res.pixQrCode?.payload).toBe('pixcopypaste123');
      expect(res.pixQrCode?.encodedImage.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  describe('6. devStore e Simulação Sandbox de Pagamento', () => {
    it('simulates payment in memory and reflects CONFIRMED status on getPaymentStatus', async () => {
      const service = new AsaasGatewayService('mock-key');
      const payId = 'pay_simulated_999';

      let status = await service.getPaymentStatus(payId);
      expect(status.status).toBe('PENDING');

      // Simulate confirmation
      service.simulateDevPayment(payId);

      status = await service.getPaymentStatus(payId);
      expect(status.status).toBe('CONFIRMED');
      expect(status.invoiceUrl).toContain(payId);
    });

    it('queries getPaymentStatus over real HTTP when not in test or mock', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_prod_key_123', 'https://api.asaas.com/v3');

      // Success
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pay_live_1', status: 'RECEIVED' }),
      } as any);

      const status = await service.getPaymentStatus('pay_live_1');
      expect(status.status).toBe('RECEIVED');

      // Error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Cobrança não encontrada' }),
      } as any);

      await expect(service.getPaymentStatus('pay_err_404')).rejects.toThrow(
        'Cobrança não encontrada'
      );
    });

    it('getPixQrCode fetches and normalizes raw encodedImage over real HTTP', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_prod_key_123', 'https://api.asaas.com/v3');

      // Success with raw base64 (no data: prefix)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          encodedImage: 'rawbase64stringwithoutprefix',
          payload: 'pixcopypaste',
          expirationDate: '2026-11-01',
        }),
      } as any);

      const qr = await service.getPixQrCode('pay_live_1');
      expect(qr.encodedImage).toBe('data:image/png;base64,rawbase64stringwithoutprefix');

      // Success with already prefixed data: URI
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          encodedImage: 'data:image/png;base64,alreadyprefixed',
          payload: 'pixcopypaste',
          expirationDate: '2026-11-01',
        }),
      } as any);

      const qrPrefixed = await service.getPixQrCode('pay_live_2');
      expect(qrPrefixed.encodedImage).toBe('data:image/png;base64,alreadyprefixed');

      // Error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
      } as any);

      await expect(service.getPixQrCode('pay_invalid')).rejects.toThrow(
        'Erro ao obter QR code Pix no Asaas.'
      );
    });

    it('handles test mode deterministic mocks for getPixQrCode, getPaymentStatus and cancelSubscription', async () => {
      process.env.NODE_ENV = 'test';
      const service = new AsaasGatewayService('mock-key', 'https://api-sandbox.asaas.com/v3');

      const qr = await service.getPixQrCode('pay_mock_1');
      expect(qr.encodedImage).toContain('data:image/png;base64,');
      expect(qr.payload).toContain('pay_mock_1');

      const status = await service.getPaymentStatus('pay_mock_1');
      expect(status.id).toBe('pay_mock_1');
      expect(status.status).toBe('PENDING');

      const canceled = await service.cancelSubscription('sub_mock_1');
      expect(canceled).toBe(true);
    });

    it('cancelSubscription handles API errors in production mode', async () => {
      process.env.NODE_ENV = 'production';
      const service = new AsaasGatewayService('live_prod_key_123', 'https://api.asaas.com/v3');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: [{ description: 'Assinatura já inativada' }] }),
      } as any);

      await expect(service.cancelSubscription('sub_err_1')).rejects.toThrow(
        'Falha ao cancelar assinatura no Asaas: Assinatura já inativada'
      );
    });
  });
});
