import axios, { type AxiosInstance } from 'axios';
import { axiosErrorDetails } from './AxiosErrorAdapter';

export enum CUIYesNo {
  YES = 'Yes',
  NO = 'No',
}

export interface CUIFlagPath {
  id?: string;
  name: string;
}

export interface CUIFlag {
  name: string;
  name_cy: string;
  subTypeValue?: string;
  subTypeValue_cy?: string;
  subTypeKey?: string;
  otherDescription?: string;
  otherDescription_cy?: string;
  flagComment?: string;
  flagComment_cy?: string;
  flagUpdateComment?: string;
  dateTimeModified?: string;
  dateTimeCreated: string;
  path: CUIFlagPath[];
  hearingRelevant: CUIYesNo;
  flagCode: string;
  status?: string;
  availableExternally: CUIYesNo;
}

export interface CUIFlagItem {
  id: string;
  value: CUIFlag;
}

export interface CUIFlagDetails {
  partyName: string;
  roleOnCase: string;
  details: CUIFlagItem[];
}

export interface CUIStartJourneyRequest {
  callbackUrl: string;
  existingFlags: CUIFlagDetails;
  correlationId: string;
  language: string;
  masterFlagCode: string;
}

interface CUIStartJourneyPayload extends Omit<CUIStartJourneyRequest, 'masterFlagCode'> {
  logoutUrl?: string;
  hmctsServiceId: string;
  masterFlagCode: string;
}

export interface CUIJourneyData {
  action: string;
  correlationId: string;
  flagsAsSupplied?: CUIFlagDetails;
  replacementFlags?: CUIFlagDetails;
  error?: string;
}

export interface CUIStartJourneyResponse {
  url: string;
}

export interface CUIClientAuth {
  serviceToken: string;
}

export interface CUIStartJourneyAuth extends CUIClientAuth {
  idamToken: string;
}

export interface CUIClientConfig {
  endpoint: string;
  hmctsServiceId: string;
  logoutUrl?: string;
}

type CUIHttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export class CUIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CUIConfigError';
  }
}

export class CUIRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CUIRequestError';
  }
}

export class CUIClient {
  private readonly endpoint: string;
  private readonly httpClient: CUIHttpClient;

  constructor(private readonly config: CUIClientConfig, httpClient: CUIHttpClient = axios) {
    this.validateConfig(config);
    this.endpoint = this.config.endpoint.replace(/\/+$/, '');
    this.httpClient = httpClient;
  }

  public async startJourney(
    request: CUIStartJourneyRequest,
    auth: CUIStartJourneyAuth
  ): Promise<CUIStartJourneyResponse> {
    this.validateStartJourneyRequest(request);
    this.validateStartJourneyAuth(auth);

    try {
      const response = await this.httpClient.post<CUIStartJourneyResponse>(
        this.getStartJourneyUrl(),
        this.toInboundPayload(request),
        {
          headers: this.getStartJourneyHeaders(auth),
        }
      );

      if (!response.data?.url) {
        throw new CUIRequestError('CUI start journey response did not contain a url');
      }

      return response.data;
    } catch (error) {
      throw new CUIRequestError(
        'Error starting CUI journey: ' +
          axiosErrorDetails(error, {
            action: 'startJourney',
            correlationId: request.correlationId,
          })
      );
    }
  }

  public async getJourneyData(id: string, auth: CUIClientAuth): Promise<CUIJourneyData> {
    this.validateJourneyId(id);
    this.validateServiceAuth(auth);

    try {
      const response = await this.httpClient.get<CUIJourneyData>(this.getJourneyDataUrl(id), {
        headers: this.getServiceHeaders(auth),
      });

      return response.data;
    } catch (error) {
      throw new CUIRequestError(
        'Error getting CUI journey data: ' +
          axiosErrorDetails(error, {
            action: 'getJourneyData',
            id,
          })
      );
    }
  }

  private toInboundPayload(request: CUIStartJourneyRequest): CUIStartJourneyPayload {
    return {
      ...request,
      logoutUrl: this.config.logoutUrl,
      hmctsServiceId: this.config.hmctsServiceId,
    };
  }

  private getStartJourneyHeaders(auth: CUIStartJourneyAuth): Record<string, string> {
    return {
      ...this.getServiceHeaders(auth),
      Authorization: `Bearer ${auth.idamToken}`,
    };
  }

  private getServiceHeaders(auth: CUIClientAuth): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ServiceAuthorization: auth.serviceToken,
    };
  }

  private getStartJourneyUrl(): string {
    return `${this.endpoint}/api/payload`;
  }

  private getJourneyDataUrl(id: string): string {
    return `${this.endpoint}/api/payload/${encodeURIComponent(id)}`;
  }

  private validateConfig(config: CUIClientConfig): void {
    if (!config.endpoint?.trim()) {
      throw new CUIConfigError('CUI config endpoint is required');
    }

    if (!config.hmctsServiceId?.trim()) {
      throw new CUIConfigError('CUI config hmctsServiceId is required');
    }

    if (config.logoutUrl !== undefined && !config.logoutUrl.trim()) {
      throw new CUIConfigError('CUI config logoutUrl must not be empty when provided');
    }
  }

  private validateStartJourneyRequest(request: CUIStartJourneyRequest): void {
    if (!request.callbackUrl?.trim()) {
      throw new CUIRequestError('CUI start journey callbackUrl is required');
    }

    if (!request.correlationId?.trim()) {
      throw new CUIRequestError('CUI start journey correlationId is required');
    }

    if (!request.language?.trim()) {
      throw new CUIRequestError('CUI start journey language is required');
    }

    if (!request.masterFlagCode?.trim()) {
      throw new CUIRequestError('CUI start journey masterFlagCode is required');
    }
  }

  private validateStartJourneyAuth(auth: CUIStartJourneyAuth): void {
    this.validateServiceAuth(auth);

    if (!auth.idamToken?.trim()) {
      throw new CUIRequestError('CUI start journey idamToken is required');
    }
  }

  private validateServiceAuth(auth: CUIClientAuth): void {
    if (!auth.serviceToken?.trim()) {
      throw new CUIRequestError('CUI serviceToken is required');
    }
  }

  private validateJourneyId(id: string): void {
    if (!id?.trim()) {
      throw new CUIRequestError('CUI journey id is required');
    }
  }
}
