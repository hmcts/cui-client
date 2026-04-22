import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  CUIClient,
  CUIConfigError,
  CUIRequestError,
  CUIYesNo,
  type CUIJourneyData,
  type CUIStartJourneyResponse,
} from '..';

type HttpClient = Pick<typeof import('axios'), 'get' | 'post'>;

const request = {
  callbackUrl: 'https://consumer.example/callback',
  correlationId: 'corr-123',
  language: 'en',
  masterFlagCode: 'RA0042',
  existingFlags: {
    partyName: 'Jane Doe',
    roleOnCase: 'Applicant',
    details: [
      {
        id: 'flag-1',
        value: {
          name: 'Reasonable adjustment',
          name_cy: 'Addasiad rhesymol',
          dateTimeCreated: '2026-04-21T12:00:00.000Z',
          path: [{ name: 'Level 1' }],
          hearingRelevant: CUIYesNo.YES,
          flagCode: 'RA0042',
          availableExternally: CUIYesNo.NO,
        },
      },
    ],
  },
};

const startJourneyResponse = (url: string): AxiosResponse<CUIStartJourneyResponse> => ({
  config: {} as AxiosRequestConfig,
  data: { url },
  headers: {},
  status: 200,
  statusText: 'OK',
});

const journeyDataResponse = (data: CUIJourneyData): AxiosResponse<CUIJourneyData> => ({
  config: {} as AxiosRequestConfig,
  data,
  headers: {},
  status: 200,
  statusText: 'OK',
});

describe('CUIClient', () => {
  it('starts a journey with the expected payload and headers', async () => {
    const post = vi.fn().mockResolvedValue(startJourneyResponse('https://cui.example/journey/123'));
    const get = vi.fn();
    const client = new CUIClient(
      {
        endpoint: 'https://cui.example/',
        hmctsServiceId: 'ccd',
        logoutUrl: 'https://consumer.example/logout',
      },
      { httpClient: { get, post } as unknown as HttpClient }
    );

    const result = await client.startJourney(request, {
      idamToken: 'idam-token',
      serviceToken: 'service-token',
    });

    expect(result.url).toBe('https://cui.example/journey/123');
    expect(post).toHaveBeenCalledWith(
      'https://cui.example/api/payload',
      {
        ...request,
        hmctsServiceId: 'ccd',
        logoutUrl: 'https://consumer.example/logout',
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'idam-token': 'Bearer idam-token',
          'service-token': 'service-token',
        },
      }
    );
  });

  it('gets journey data with the expected headers', async () => {
    const post = vi.fn();
    const get = vi.fn().mockResolvedValue(
      journeyDataResponse({
        action: 'submit',
        correlationId: 'corr-123',
      })
    );
    const client = new CUIClient(
      {
        endpoint: 'https://cui.example',
        hmctsServiceId: 'ccd',
      },
      { httpClient: { get, post } as unknown as HttpClient }
    );

    const result = await client.getJourneyData('journey/123', {
      serviceToken: 'service-token',
    });

    expect(result).toEqual({
      action: 'submit',
      correlationId: 'corr-123',
    });
    expect(get).toHaveBeenCalledWith('https://cui.example/api/payload/journey%2F123', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'service-token': 'service-token',
      },
    });
  });

  it('fails fast on invalid config', () => {
    expect(() => {
      new CUIClient({
        endpoint: '',
        hmctsServiceId: 'ccd',
      });
    }).toThrow(CUIConfigError);
  });

  it('passes axios config through to requests when using the default client', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue(startJourneyResponse('https://cui.example/journey/123'));

    const client = new CUIClient({
      endpoint: 'https://cui.example',
      hmctsServiceId: 'ccd',
    }, {
      axiosConfig: {
        timeout: 10000,
        httpsAgent: {
          rejectUnauthorized: false,
        } as never,
        headers: {
          'x-correlation-source': 'consumer-app',
        },
      },
    });

    await client.startJourney(request, {
      idamToken: 'idam-token',
      serviceToken: 'service-token',
    });

    expect(post).toHaveBeenCalledWith(
      'https://cui.example/api/payload',
      expect.any(Object),
      expect.objectContaining({
        timeout: 10000,
        httpsAgent: {
          rejectUnauthorized: false,
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'idam-token': 'Bearer idam-token',
          'service-token': 'service-token',
          'x-correlation-source': 'consumer-app',
        },
      })
    );

    post.mockRestore();
  });

  it('passes axios config through to requests when using a custom http client', async () => {
    const post = vi.fn().mockResolvedValue(startJourneyResponse('https://cui.example/journey/123'));
    const get = vi.fn();
    const client = new CUIClient(
      {
        endpoint: 'https://cui.example',
        hmctsServiceId: 'ccd',
      },
      {
        axiosConfig: {
          timeout: 10000,
          headers: {
            'x-correlation-source': 'consumer-app',
          },
        },
        httpClient: { get, post } as unknown as HttpClient,
      }
    );

    await client.startJourney(request, {
      idamToken: 'idam-token',
      serviceToken: 'service-token',
    });

    expect(post).toHaveBeenCalledWith(
      'https://cui.example/api/payload',
      expect.any(Object),
      {
        timeout: 10000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'idam-token': 'Bearer idam-token',
          'service-token': 'service-token',
          'x-correlation-source': 'consumer-app',
        },
      }
    );
  });

  it('wraps downstream errors with request context', async () => {
    const post = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const get = vi.fn();
    const client = new CUIClient(
      {
        endpoint: 'https://cui.example',
        hmctsServiceId: 'ccd',
      },
      { httpClient: { get, post } as unknown as HttpClient }
    );

    await expect(
      client.startJourney(request, {
        idamToken: 'idam-token',
        serviceToken: 'service-token',
      })
    ).rejects.toThrow(CUIRequestError);

    await expect(
      client.startJourney(request, {
        idamToken: 'idam-token',
        serviceToken: 'service-token',
      })
    ).rejects.toThrow('Error starting CUI journey: network unavailable [action=startJourney | correlationId=corr-123]');
  });

  it('serializes structured axios error responses instead of showing object object', async () => {
    const post = vi.fn().mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: {
        data: {
          error: {
            message: 'Invalid payload',
            reason: 'masterFlagCode missing',
          },
        },
      },
    } as AxiosError);
    const get = vi.fn();
    const client = new CUIClient(
      {
        endpoint: 'https://cui.example',
        hmctsServiceId: 'ccd',
      },
      { httpClient: { get, post } as unknown as HttpClient }
    );

    await expect(
      client.startJourney(request, {
        idamToken: 'idam-token',
        serviceToken: 'service-token',
      })
    ).rejects.toThrow(
      'Error starting CUI journey: Request failed with status code 400, {"message":"Invalid payload","reason":"masterFlagCode missing"} [action=startJourney | correlationId=corr-123]'
    );
  });
});
