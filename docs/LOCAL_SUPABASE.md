# Local Supabase Setup

Use local Supabase when the cloud project is unhealthy or when testing auth,
groups, wishlists, messages, affiliate flows, and database changes without
touching production data.

## Local App Origin

For browser testing, use one host consistently:

```text
http://localhost:3000
```

Do not mix `localhost:3000` and `127.0.0.1:3000` during Google sign-in. OAuth
state and session cookies are host-specific, so mixing the two can send the app
back to login on the first attempt.

The local app env should point at local Supabase:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

Keep those values in `.env.local`. Do not commit `.env.local`; it also contains
secrets.

The ignored local Supabase CLI config should use the same browser host:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000",
  "http://localhost:3000/**",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3000/**"
]
```

Keep this in `supabase/config.toml`. That file is ignored because it is local
machine configuration.

## Google OAuth For Local

Google OAuth can work locally when the OAuth client allows:

```text
http://localhost:3000
http://localhost:3000/auth/callback
http://127.0.0.1:54321/auth/v1/callback
```

The local Supabase config should read the Google client values from environment
variables:

```text
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET
```

Do not paste those values into docs, chat, screenshots, or commits.

## Running Local Dev

Start local Supabase:

```bash
npx.cmd supabase start
```

Start the app:

```bash
npm.cmd run dev
```

Open:

```text
http://localhost:3000/login
```

If OAuth gets stuck on an old error URL, navigate back to `/login` instead of
refreshing the error URL.

## Cloud Database Updates

GitHub and Vercel deploy app code only. They do not apply Supabase migrations to
the cloud database.

When the cloud project is healthy again, check migration state before applying
anything:

```bash
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

Only apply the push if the dry run shows the expected pending migration and no
unrelated drift. Local data does not automatically sync to the cloud database.
