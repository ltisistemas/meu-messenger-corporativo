export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
}

export interface AsaasSubscriptionInput {
  customerId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: 'MONTHLY' | 'YEARLY';
  description: string;
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
  cpfCnpj: string;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
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
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // base64 QR code image
  payload: string; // Pix copy and paste
  expirationDate: string;
}

export class AsaasGatewayService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey = process.env.ASAAS_API_KEY || 'mock-asaas-api-key', baseUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Creates or retrieves a customer in Asaas
   */
  async createOrGetCustomer(input: AsaasCustomerInput): Promise<AsaasCustomerResponse> {
    // If running in test or without real API key, return deterministic mock response
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return {
        id: `cus_${crypto.randomUUID()}`,
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0]?.description || 'Erro ao criar cliente no gateway Asaas.');
      }

      return await res.json();
    } catch (err: any) {
      throw new Error(`Falha no Asaas: ${err.message}`);
    }
  }

  /**
   * Creates a subscription in Asaas
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
        bankSlipUrl: input.billingType === 'BOLETO' ? `https://sandbox.asaas.com/b/${payId}` : undefined,
      };

      let pixQrCode: AsaasPixQrCodeResponse | undefined;
      if (input.billingType === 'PIX') {
        pixQrCode = {
          encodedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          payload: `00020101021226580014br.gov.bcb.pix2536asaas.com/qr/stat/${payId}5204000053039865405${input.value.toFixed(2)}5802BR5915NEXTMSG LTDA6009SAO PAULO62070503***6304ABCD`,
          expirationDate: new Date(Date.now() + 86400 * 1000).toISOString(),
        };
      }

      return { subscription, initialPayment, pixQrCode };
    }

    try {
      const res = await fetch(`${this.baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0]?.description || 'Erro ao criar assinatura no gateway Asaas.');
      }

      const subscription: AsaasSubscriptionResponse = await res.json();

      // Get first payment
      const paymentsRes = await fetch(`${this.baseUrl}/subscriptions/${subscription.id}/payments`, {
        headers: { access_token: this.apiKey },
      });
      const paymentsData = await paymentsRes.json();
      const initialPayment: AsaasPaymentResponse | undefined = paymentsData.data?.[0];

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
        headers: { access_token: this.apiKey },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0]?.description || 'Erro ao cancelar assinatura no Asaas.');
      }

      return true;
    } catch (err: any) {
      throw new Error(`Falha ao cancelar assinatura no Asaas: ${err.message}`);
    }
  }

  /**
   * Gets Pix QR Code for a payment in Asaas
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
    if (this.apiKey.startsWith('mock-') || process.env.NODE_ENV === 'test') {
      return {
        encodedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        payload: `00020101021226580014br.gov.bcb.pix2536asaas.com/qr/stat/${paymentId}520400005303986540579.905802BR5915NEXTMSG LTDA6009SAO PAULO62070503***6304ABCD`,
        expirationDate: new Date(Date.now() + 86400 * 1000).toISOString(),
      };
    }

    const res = await fetch(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: { access_token: this.apiKey },
    });
    if (!res.ok) {
      throw new Error('Erro ao obter QR code Pix no Asaas.');
    }
    return await res.json();
  }
}
