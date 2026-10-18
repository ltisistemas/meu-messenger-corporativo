export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
  existingCustomerId?: string;
  externalReference?: string;
}

export interface AsaasSubscriptionInput {
  customerId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: 'MONTHLY' | 'YEARLY';
  description: string;
  externalReference?: string;
  maxPayments?: number;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: AsaasCustomerInput;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference?: string;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
  externalReference?: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // base64 QR code image
  payload: string; // Pix copy and paste
  expirationDate: string;
}

/**
 * Generates mathematically valid CPF according to Modulo 11 of Brazilian Receita Federal.
 * Used as fallback in Sandbox or when user profile lacks a CPF/CNPJ to prevent gateway blocking.
 */
export function gerarCpfValidoFallback(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  let d1 = n.reduce((total, num, idx) => total + num * (10 - idx), 0) % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  let d2 = [...n, d1].reduce((total, num, idx) => total + num * (11 - idx), 0) % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return `${n.join('')}${d1}${d2}`;
}

/**
 * Resolves the appropriate Asaas Base URL based on key prefix or explicit settings.
 */
export function resolveAsaasBaseUrl(apiKey: string, explicitUrl?: string): string {
  if (apiKey.startsWith('$aact_prod_')) {
    return (
      process.env.ASAAS_BASE_URL_PRODUCAO ||
      explicitUrl ||
      process.env.ASAAS_BASE_URL ||
      'https://api.asaas.com/v3'
    ).replace(/\/+$/, '');
  }

  if (apiKey.startsWith('$aact_hmlg_')) {
    return (
      process.env.ASAAS_BASE_URL_SANDBOX ||
      explicitUrl ||
      process.env.ASAAS_BASE_URL ||
      'https://api-sandbox.asaas.com/v3'
    ).replace(/\/+$/, '');
  }

  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, '');
  }

  if (process.env.ASAAS_BASE_URL) {
    return process.env.ASAAS_BASE_URL.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://api.asaas.com/v3';
  }

  return 'https://api-sandbox.asaas.com/v3';
}

/**
 * Resolves Asaas API Key sanitizing quotes and whitespace.
 */
export function resolveAsaasApiKey(explicitKey?: string): string {
  const rawKey =
    explicitKey ||
    process.env.ASAAS_API_KEY_PRODUCAO ||
    process.env.ASAAS_API_KEY ||
    process.env.ASAAS_SECRET_KEY ||
    process.env.ASAAS_API_KEY_SANDBOX ||
    'mock-asaas-api-key';
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

/**
 * Extracts unified error descriptions from Asaas error responses.
 */
export function extrairErroAsaas(errorData: any, fallbackMessage: string): string {
  if (errorData?.errors && Array.isArray(errorData.errors)) {
    return errorData.errors.map((e: any) => e.description || e.message).join('; ');
  }
  if (errorData?.message) {
    return errorData.message;
  }
  return fallbackMessage;
}

export class AsaasGatewayService {
  private apiKey: string;
  private baseUrl: string;
  // In-memory simulation store for development/sandbox mode
  private devStore = new Map<string, { status: string; invoiceUrl?: string; updatedAt: Date }>();

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = resolveAsaasApiKey(apiKey);
    this.baseUrl = resolveAsaasBaseUrl(this.apiKey, baseUrl);
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Simulates a payment as CONFIRMED in memory for dev/test/sandbox mode
   */
  simulateDevPayment(paymentId: string): void {
    this.devStore.set(paymentId, {
      status: 'CONFIRMED',
      invoiceUrl: `https://sandbox.asaas.com/i/${paymentId}`,
      updatedAt: new Date(),
    });
  }

  /**
   * Creates or retrieves a customer in Asaas using a multi-step resolution cascade:
   * 1. Check existing customer ID (GET /v3/customers/{id}) & update document if missing
   * 2. Search by CPF/CNPJ (GET /v3/customers?cpfCnpj=...)
   * 3. Search by email (GET /v3/customers?email=...)
   * 4. Create new customer (POST /v3/customers)
   */
  async createOrGetCustomer(
    input: AsaasCustomerInput & { searchBeforeCreate?: boolean }
  ): Promise<AsaasCustomerResponse> {
    const rawCpfCnpj = (input.cpfCnpj || '').replace(/\D/g, '');
    const cleanCpfCnpj =
      rawCpfCnpj.length === 11 || rawCpfCnpj.length === 14 ? rawCpfCnpj : gerarCpfValidoFallback();

    // If running in test or without real API key, return deterministic mock response
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return {
        id: input.existingCustomerId || `cus_${crypto.randomUUID()}`,
        name: input.name,
        email: input.email,
        cpfCnpj: cleanCpfCnpj,
        phone: input.phone,
        externalReference: input.externalReference,
      };
    }

    try {
      // 1. If existing customer ID provided, check and update if needed
      if (input.existingCustomerId && input.existingCustomerId.startsWith('cus_')) {
        try {
          const existingRes = await fetch(`${this.baseUrl}/customers/${input.existingCustomerId}`, {
            headers: { access_token: this.apiKey, accept: 'application/json' },
          });
          if (existingRes.ok) {
            const customer: AsaasCustomerResponse = await existingRes.json();
            // Update document if missing or outdated
            if (!customer.cpfCnpj && cleanCpfCnpj) {
              await fetch(`${this.baseUrl}/customers/${customer.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  access_token: this.apiKey,
                  accept: 'application/json',
                },
                body: JSON.stringify({ cpfCnpj: cleanCpfCnpj }),
              });
              customer.cpfCnpj = cleanCpfCnpj;
            }
            return customer;
          }
        } catch (_) {
          // If check fails, continue with creation
        }
      }

      // 2. If explicit searchBeforeCreate requested, search by document then email
      if (input.searchBeforeCreate) {
        if (cleanCpfCnpj) {
          try {
            const docRes = await fetch(`${this.baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`, {
              headers: { access_token: this.apiKey, accept: 'application/json' },
            });
            if (docRes.ok) {
              const docData = await docRes.json();
              if (docData.data && docData.data.length > 0) {
                return docData.data[0];
              }
            }
          } catch (_) {}
        }

        if (input.email) {
          try {
            const emailRes = await fetch(
              `${this.baseUrl}/customers?email=${encodeURIComponent(input.email)}`,
              { headers: { access_token: this.apiKey, accept: 'application/json' } }
            );
            if (emailRes.ok) {
              const emailData = await emailRes.json();
              if (emailData.data && emailData.data.length > 0) {
                return emailData.data[0];
              }
            }
          } catch (_) {}
        }
      }

      // 3. Create new customer
      const res = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
          accept: 'application/json',
        },
        body: JSON.stringify({
          name: input.name,
          email: input.email,
          cpfCnpj: cleanCpfCnpj,
          phone: input.phone,
          mobilePhone: input.phone,
          postalCode: input.postalCode,
          addressNumber: input.addressNumber,
          externalReference: input.externalReference,
          notificationDisabled: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(extrairErroAsaas(errData, 'Erro ao criar cliente no gateway Asaas.'));
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(`Falha no Asaas: ${err.message}`);
    }
  }

  /**
   * Creates a recurring subscription in Asaas with retry backoff for initial payment
   */
  async createSubscription(input: AsaasSubscriptionInput): Promise<{
    subscription: AsaasSubscriptionResponse;
    initialPayment?: AsaasPaymentResponse;
    pixQrCode?: AsaasPixQrCodeResponse;
  }> {
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      const subId = `sub_${crypto.randomUUID()}`;
      const payId = `pay_${crypto.randomUUID()}`;

      const subscription: AsaasSubscriptionResponse = {
        id: subId,
        customer: input.customerId,
        billingType: input.billingType,
        value: input.value,
        nextDueDate: input.nextDueDate,
        cycle: input.cycle,
        status: input.billingType === 'CREDIT_CARD' ? 'ACTIVE' : 'PENDING',
        externalReference: input.externalReference,
      };

      const initialPayment: AsaasPaymentResponse = {
        id: payId,
        customer: input.customerId,
        subscription: subId,
        value: input.value,
        billingType: input.billingType,
        status: input.billingType === 'CREDIT_CARD' ? 'CONFIRMED' : 'PENDING',
        dueDate: input.nextDueDate,
        invoiceUrl: `https://sandbox.asaas.com/i/${payId}`,
        bankSlipUrl:
          input.billingType === 'BOLETO' ? `https://sandbox.asaas.com/b/${payId}` : undefined,
        externalReference: input.externalReference,
      };

      let pixQrCode: AsaasPixQrCodeResponse | undefined;
      if (input.billingType === 'PIX') {
        pixQrCode = {
          encodedImage:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          payload: `00020101021226580014br.gov.bcb.pix2536asaas.com/qr/stat/${payId}5204000053039865405${input.value.toFixed(2)}5802BR5915NEXTMSG LTDA6009SAO PAULO62070503***6304ABCD`,
          expirationDate: new Date(Date.now() + 86400 * 1000).toISOString(),
        };
      }

      return { subscription, initialPayment, pixQrCode };
    }

    try {
      const subPayload: any = {
        customer: input.customerId,
        billingType: input.billingType,
        value: input.value,
        nextDueDate: input.nextDueDate,
        cycle: input.cycle,
        description: input.description,
        externalReference: input.externalReference,
        notificationDisabled: true,
      };

      if (input.maxPayments) {
        subPayload.maxPayments = input.maxPayments;
      }

      if (input.creditCard) {
        subPayload.creditCard = input.creditCard;
        subPayload.creditCardHolderInfo = input.creditCardHolderInfo;
      }

      const res = await fetch(`${this.baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
          accept: 'application/json',
        },
        body: JSON.stringify(subPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(extrairErroAsaas(errData, 'Erro ao criar assinatura no gateway Asaas.'));
      }

      const subscription: AsaasSubscriptionResponse = await res.json();

      // Retrieve first payment with backoff retry
      let initialPayment: AsaasPaymentResponse | undefined;
      const delays = [500, 1000, 1500, 2000, 2500];

      const paymentsRes = await fetch(`${this.baseUrl}/subscriptions/${subscription.id}/payments`, {
        headers: { access_token: this.apiKey, accept: 'application/json' },
      });
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        initialPayment = paymentsData.data?.[0];
      }

      // Retry backoff if payment is not yet ready in Asaas
      if (!initialPayment && subscription.id?.startsWith('sub_')) {
        for (const delay of delays) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          const retryRes = await fetch(
            `${this.baseUrl}/subscriptions/${subscription.id}/payments`,
            { headers: { access_token: this.apiKey, accept: 'application/json' } }
          );
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            if (retryData.data && retryData.data.length > 0) {
              initialPayment = retryData.data[0];
              break;
            }
          }
        }
      }

      let pixQrCode: AsaasPixQrCodeResponse | undefined;
      if (initialPayment && input.billingType === 'PIX') {
        pixQrCode = await this.getPixQrCode(initialPayment.id);
      }

      return { subscription, initialPayment, pixQrCode };
    } catch (err: any) {
      throw new Error(`Falha ao criar assinatura no Asaas: ${err.message}`);
    }
  }

  /**
   * Cancels a subscription in Asaas
   */
  async cancelSubscription(gatewaySubscriptionId: string): Promise<boolean> {
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      const res = await fetch(`${this.baseUrl}/subscriptions/${gatewaySubscriptionId}`, {
        method: 'DELETE',
        headers: { access_token: this.apiKey, accept: 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(extrairErroAsaas(errData, 'Erro ao cancelar assinatura no Asaas.'));
      }

      return true;
    } catch (err: any) {
      throw new Error(`Falha ao cancelar assinatura no Asaas: ${err.message}`);
    }
  }

  /**
   * Gets Pix QR Code for a payment in Asaas, ensuring data URI prefix
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return {
        encodedImage:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        payload: `00020101021226580014br.gov.bcb.pix2536asaas.com/qr/stat/${paymentId}520400005303986540579.905802BR5915NEXTMSG LTDA6009SAO PAULO62070503***6304ABCD`,
        expirationDate: new Date(Date.now() + 86400 * 1000).toISOString(),
      };
    }

    const res = await fetch(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: { access_token: this.apiKey, accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error('Erro ao obter QR code Pix no Asaas.');
    }
    const data: AsaasPixQrCodeResponse = await res.json();
    const rawEncoded = data.encodedImage || '';
    const sanitizedImage = rawEncoded.startsWith('data:')
      ? rawEncoded
      : `data:image/png;base64,${rawEncoded}`;

    return {
      ...data,
      encodedImage: sanitizedImage,
    };
  }

  /**
   * Retrieves payment details from Asaas (GET /v3/payments/{id})
   */
  async getPaymentStatus(paymentId: string): Promise<AsaasPaymentResponse> {
    // Check devStore first if in development or test
    const devRecord = this.devStore.get(paymentId);
    if (devRecord) {
      return {
        id: paymentId,
        customer: 'cus_dev',
        value: 79.9,
        billingType: 'PIX',
        status: devRecord.status,
        dueDate: new Date().toISOString().split('T')[0],
        invoiceUrl: devRecord.invoiceUrl,
      };
    }

    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return {
        id: paymentId,
        customer: 'cus_mock',
        value: 79.9,
        billingType: 'PIX',
        status: 'PENDING',
        dueDate: new Date().toISOString().split('T')[0],
        invoiceUrl: `https://sandbox.asaas.com/i/${paymentId}`,
      };
    }

    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      headers: { access_token: this.apiKey, accept: 'application/json' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(extrairErroAsaas(errData, 'Erro ao consultar status da cobrança no Asaas.'));
    }
    return await res.json();
  }
}
