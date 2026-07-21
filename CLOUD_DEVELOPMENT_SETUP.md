# CloudBase Backend Setup

Repository identity: `ItemLocker / lockmyitem`.

The web app calls `cloudfunctions/lostfound` through the CloudBase Web SDK. This function handles item data, comments, email auth, claim/return flows, match notifications, and Hunyuan image recognition.

## Web Environment Variables

Configure non-sensitive web build values through the deployment platform or copy `web/.env.production.example` to a local production env file:

```env
VITE_CLOUDBASE_FUNCTION_NAME=lostfound
VITE_CLOUDBASE_REGION=ap-shanghai
```

Credential-like values are intentionally omitted from repository examples. Configure them only in CloudBase or deployment-platform secret storage.

## Cloud Function Environment Variables

Configure required model, auth-signing, and email credentials in the CloudBase console for `cloudfunctions/lostfound`. Do not write credential names with sample values into committed docs, and do not place real values in frontend code.

Required groups:

- model service credentials for Tencent Hunyuan image recognition
- auth token signing secret for email login and claim flows
- SMTP credentials when email verification or notification is enabled
- CloudBase Web access policy or anonymous-login policy for browser calls

If multiple Hunyuan credential modes are configured, the cloud function prefers Tencent Cloud signed API calls over the OpenAI-compatible endpoint.

## Deploy

Use the CloudBase project configuration in `cloudbaserc.json` and deploy `cloudfunctions/lostfound` with cloud-side dependency installation. The function configuration is:

```text
runtime: Nodejs16.13
handler: index.main
timeout: 30
memorySize: 512
```

The same timeout and memory settings are also recorded in:

```text
cloudfunctions/lostfound/config.json
```

If the CloudBase console reports `FUNCTIONS_TIME_LIMIT_EXCEEDED`, set the `lostfound` timeout to 30 seconds manually and deploy again.

## Test classifyImage

Cloud function test event:

```json
{
  "action": "classifyImage",
  "imageUrl": "https://example.invalid/direct-test-image.jpg",
  "hint": "雨伞，校园失物招领图片识别测试"
}
```

Replace the image URL with a direct HTTPS image URL that can be downloaded by the cloud function.

Expected shape:

```json
{
  "ok": true,
  "data": {
    "category": "雨伞",
    "aiTags": [],
    "visualDescription": "",
    "yoloObjects": [],
    "semanticTags": [],
    "modelSources": {}
  }
}
```

Do not commit real credentials, tokens, cookies, private keys, or CloudBase publishable credentials.
