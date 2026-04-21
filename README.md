# `@hmcts/cui-client`

[![Node.js Package](https://github.com/hmcts/cui-client/actions/workflows/npmpublish.yml/badge.svg?branch=main)](https://github.com/hmcts/cui-client/actions/workflows/npmpublish.yml)

Small TypeScript client for the HMCTS CUI API.

## Install

```bash
npm install @hmcts/cui-client axios
```

## Usage

```ts
import {
  CUIClient,
  type CUIStartJourneyRequest,
  type CUIStartJourneyAuth,
} from '@hmcts/cui-client';

const client = new CUIClient({
  endpoint: 'https://cui-api.internal.hmcts.net',
  hmctsServiceId: 'your-service-id',
  logoutUrl: 'https://your-app/logout',
});

const request: CUIStartJourneyRequest = {
  callbackUrl: 'https://your-app/callback',
  correlationId: 'a-correlation-id',
  language: 'en',
  masterFlagCode: 'RA0042',
  existingFlags: {
    partyName: 'Jane Doe',
    roleOnCase: 'Applicant',
    details: [],
  },
};

const auth: CUIStartJourneyAuth = {
  idamToken: 'idam-access-token',
  serviceToken: 'service-token',
};

const { url } = await client.startJourney(request, auth);
```

```ts
import { CUIClient, type CUIClientAuth } from '@hmcts/cui-client';

const client = new CUIClient({
  endpoint: 'https://cui-api.internal.hmcts.net',
  hmctsServiceId: 'your-service-id',
});

const auth: CUIClientAuth = {
  serviceToken: 'service-token',
};

const journey = await client.getJourneyData('journey-id', auth);
```

## Public API

- `CUIClient`
- `CUIConfigError`
- `CUIRequestError`
- `CUIYesNo`
- `CUIFlagPath`
- `CUIFlag`
- `CUIFlagItem`
- `CUIFlagDetails`
- `CUIStartJourneyRequest`
- `CUIJourneyData`
- `CUIStartJourneyResponse`
- `CUIClientAuth`
- `CUIStartJourneyAuth`
- `CUIClientConfig`

## Development

```bash
npm run build
npm run typecheck
npm test
```

CI and publishing are handled by [`.github/workflows/npmpublish.yml`](./.github/workflows/npmpublish.yml).

## Release Process

1. Update the package version.

```bash
npm version patch
```

Use `minor` or `major` instead of `patch` when appropriate.

2. Push the version commit and tag.

```bash
git push origin main --follow-tags
```

3. Create a GitHub Release from the pushed tag.

If the GitHub Release is marked as a prerelease, the workflow publishes to npm with the `next` dist-tag. Otherwise it publishes with `latest`.

## GitHub And npm Setup

- GitHub Actions must be enabled for this repository.
- npm Trusted Publishing must be configured for this GitHub repository and workflow.
- The npm package `@hmcts/cui-client` must exist in the target npm organisation/account.
- Creating a GitHub Release is the publishing trigger; pushes and pull requests only run validation.
