export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  public getBaseUrl(): string {
    const raw =
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
      '/api';

    const trimmed = raw.replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private getTokens(): { accessToken: string | null; refreshToken: string | null } {
    try {
      if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
      const authData = localStorage.getItem('corpchat_auth');
      if (!authData) return { accessToken: null, refreshToken: null };
      const parsed = JSON.parse(authData);
      return {
        accessToken: parsed.state?.accessToken || null,
        refreshToken: parsed.state?.refreshToken || null,
      };
    } catch {
      return { accessToken: null, refreshToken: null };
    }
  }

  public async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;

    const base = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const normalizedEndpoint =
      base.endsWith('/api') && cleanEndpoint.startsWith('/api/')
        ? cleanEndpoint.replace(/^\/api/, '')
        : cleanEndpoint;

    let url = `${base}${normalizedEndpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const { accessToken } = this.getTokens();

    const config: RequestInit = {
      ...customConfig,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: any) {
      throw new ApiError(err.message || 'Falha na conexão de rede com o servidor.', 0);
    }

    // Attempt token refresh on 401 if refreshToken exists
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      const { refreshToken } = this.getTokens();
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${this.getBaseUrl()}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            // Update stored tokens
            const authData = localStorage.getItem('corpchat_auth');
            if (authData) {
              const parsed = JSON.parse(authData);
              parsed.state.accessToken = refreshData.accessToken;
              parsed.state.refreshToken = refreshData.refreshToken;
              localStorage.setItem('corpchat_auth', JSON.stringify(parsed));
            }

            // Retry original request with new token
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${refreshData.accessToken}`,
            };
            response = await fetch(url, config);
          }
        } catch {
          // If refresh fails, proceed with original 401 error
        }
      }
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg =
        (typeof data === 'object' && data?.message) ||
        `Erro HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMsg, response.status, data);
    }

    return data as T;
  }

  public get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
