import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  CUIActions,
  CUIClient,
  CUIConfigError,
  CUIFlagStatus,
  CUIRequestError,
  CUIYesNo,
  mergeCUIFlagItems,
  type CUIFlag,
  type CUIFlagItem,
  type CUIJourneyData,
  type CUIStartJourneyResponse,
} from '..';

type HttpClient = Pick<typeof import('axios'), 'get' | 'post'>;

const createFlag = (flagCode: string): CUIFlag => ({
  name: `Flag ${flagCode}`,
  name_cy: `Flag ${flagCode} cy`,
  dateTimeCreated: '2026-04-21T12:00:00.000Z',
  path: [{ name: 'Level 1' }],
  hearingRelevant: CUIYesNo.YES,
  flagCode,
  status: CUIFlagStatus.ACTIVE,
  availableExternally: CUIYesNo.NO,
});

const createFlagItem = (id?: string, flagCode = id ?? 'new-flag'): CUIFlagItem => {
  const item = {
    value: createFlag(flagCode),
  };

  return id === undefined ? item : { ...item, id };
};

const cloneFlagItem = (item: CUIFlagItem): CUIFlagItem => ({
  ...(item.id === undefined ? {} : { id: item.id }),
  value: {
    ...item.value,
    path: item.value.path.map((path) => ({ ...path })),
  },
});

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
          status: CUIFlagStatus.ACTIVE,
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
        action: CUIActions.SUBMIT,
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
      action: CUIActions.SUBMIT,
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

describe('mergeCUIFlagItems', () => {
  it('returns a copy of existing flags when replacement flags are empty', () => {
    const existingFlags = [createFlagItem('flag-1')];

    const result = mergeCUIFlagItems(existingFlags);

    expect(result).toEqual(existingFlags);
    expect(result).not.toBe(existingFlags);
  });

  it('returns a copy of replacement flags when existing flags are empty', () => {
    const replacementFlags = [createFlagItem('flag-1')];

    const result = mergeCUIFlagItems([], replacementFlags);

    expect(result).toEqual(replacementFlags);
    expect(result).not.toBe(replacementFlags);
  });

  it('appends a replacement item without an id', () => {
    const existingFlags = [createFlagItem('flag-1')];
    const newFlag = createFlagItem(undefined, 'new-flag');

    const result = mergeCUIFlagItems(existingFlags, [newFlag]);

    expect(result).toEqual([...existingFlags, newFlag]);
  });

  it('appends a replacement item with a new id', () => {
    const existingFlags = [createFlagItem('flag-1')];
    const newFlag = createFlagItem('flag-2');

    const result = mergeCUIFlagItems(existingFlags, [newFlag]);

    expect(result).toEqual([...existingFlags, newFlag]);
  });

  it('replaces an existing item with a matching id at the same position', () => {
    const existingFlag = createFlagItem('flag-1', 'old-flag');
    const unchangedFlag = createFlagItem('flag-2');
    const replacementFlag = createFlagItem('flag-1', 'replacement-flag');

    const result = mergeCUIFlagItems([existingFlag, unchangedFlag], [replacementFlag]);

    expect(result).toEqual([replacementFlag, unchangedFlag]);
  });

  it('handles multiple replacements in order', () => {
    const existingFlag = createFlagItem('flag-1', 'old-flag-1');
    const secondExistingFlag = createFlagItem('flag-2', 'old-flag-2');
    const newFlagWithoutId = createFlagItem(undefined, 'new-flag');
    const replacementForSecondFlag = createFlagItem('flag-2', 'replacement-flag-2');
    const firstReplacementForNewId = createFlagItem('flag-3', 'first-new-id-flag');
    const secondReplacementForNewId = createFlagItem('flag-3', 'second-new-id-flag');
    const replacementForExistingFlag = createFlagItem('flag-1', 'replacement-flag-1');

    const result = mergeCUIFlagItems(
      [existingFlag, secondExistingFlag],
      [
        newFlagWithoutId,
        replacementForSecondFlag,
        firstReplacementForNewId,
        secondReplacementForNewId,
        replacementForExistingFlag,
      ]
    );

    expect(result).toEqual([
      replacementForExistingFlag,
      replacementForSecondFlag,
      newFlagWithoutId,
      secondReplacementForNewId,
    ]);
  });

  it('does not mutate input arrays or items', () => {
    const existingFlag = createFlagItem('flag-1', 'old-flag');
    const replacementFlag = createFlagItem('flag-1', 'replacement-flag');
    const existingFlags = [existingFlag];
    const replacementFlags = [replacementFlag];
    const existingFlagsBefore = existingFlags.map(cloneFlagItem);
    const replacementFlagsBefore = replacementFlags.map(cloneFlagItem);

    mergeCUIFlagItems(existingFlags, replacementFlags);

    expect(existingFlags).toEqual(existingFlagsBefore);
    expect(replacementFlags).toEqual(replacementFlagsBefore);
    expect(existingFlags[0]).toBe(existingFlag);
    expect(replacementFlags[0]).toBe(replacementFlag);
  });

  it('returns a new array', () => {
    const existingFlags = [createFlagItem('flag-1')];
    const replacementFlags = [createFlagItem('flag-2')];

    const result = mergeCUIFlagItems(existingFlags, replacementFlags);

    expect(result).not.toBe(existingFlags);
    expect(result).not.toBe(replacementFlags);
  });
});
