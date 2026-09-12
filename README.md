# Report Hub

backend API → database → permanent complaint ID → return saved complaint MY REPORTS → fetch real complaints from backend/database → show correct status/details/evidence/location NEARBY → fetch real complaints → display correct map markers based on stored coordinates

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0b380a3d-6820-455d-a8a4-ef460b9a5ee8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## MCD 311 direct submission

The server-side integration is wired to the MCD 311 creation route discovered in the official Android client:

- Base API: `https://capi.everythingcivic.com/api/v1`
- Create route: `/issues/create`
- MCD live complaint channel: `245`
- App ID: `16`
- `fromapp`: `1`
- Authentication: Bearer token from `MCD_AUTH_TOKEN`
- Complaint category/subcategory: selected from the exact MCD category/subcategory dataset captured from the MCD portal; the selected IDs are sent directly in the server-side MCD submission.

Set `MCD_DIRECT_SUBMIT=true` only after configuring the server-side MCD credentials. The token is a runtime user credential and is not present in the APK/source, so it cannot be safely extracted or invented.
