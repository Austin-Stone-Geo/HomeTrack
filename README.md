# HomeTrack

HomeTrack turns your home into a living database. It tracks what you have (pantry, garage, plants, gear, tools, bills) and reminds the household when something needs doing.

- **Product spec and data model:** [HomeTrack: Product Spec & Data Model](https://claude.ai/artifact/6qr2KrrjxR7GeYqWsVBY7W)
- **Runs on:** iPhone, Android and the web, all from this one codebase
- **Built with:** [Expo](https://expo.dev) (React Native + TypeScript) for the app, and [Supabase](https://supabase.com) (a hosted Postgres database) for accounts, data and live sync between household members

## What's in the repo

| Path | What it is |
| --- | --- |
| `src/app/` | The app's screens. Each file is one screen (`index.tsx` is Home, `lists.tsx` is Lists). |
| `src/components/` | Reusable building blocks such as cards, the page frame and the tab bar. |
| `src/lib/supabase.ts` | The connection to the database. |
| `src/lib/types.ts` | The shapes of the database rows, used by the app's code. |
| `supabase/migrations/` | The database setup script: tables, starter spaces and lists, and the security rules that keep each household's data private. |
| `.env.example` | A template for your two Supabase connection values. |

## Run it yourself

You only need to do this once per computer. Everything here is free.

### 1. Install the tools

1. Install **Node.js** (the LTS version) from [nodejs.org](https://nodejs.org).
2. Install the **Expo Go** app on your phone from the App Store or Google Play.
3. Get the code and install its packages. In a terminal, run:

   ```bash
   git clone https://github.com/Austin-Stone-Geo/HomeTrack.git
   cd HomeTrack
   npm install
   ```

### 2. Set up the database (Supabase)

1. Sign in at [supabase.com](https://supabase.com) and click **New project**. Name it `hometrack`, pick a database password (save it in your password manager), choose a US region, and stay on the **Free** plan.
2. When the project is ready, open **SQL Editor**, click **New query**, paste in the whole contents of `supabase/migrations/20261114000000_initial_schema.sql`, and click **Run**. You should see "Success. No rows returned."
3. Open **Project Settings → API** (or the **Connect** button) and copy the **Project URL** and the **publishable** key. Older projects call this key `anon`.
4. In the HomeTrack folder, copy `.env.example` to a new file named `.env` and paste in those two values.

The `.env` file is never committed to GitHub. The publishable key is safe to use inside the app, because the database's security rules decide what each person can see. Never put the **secret** or `service_role` key in the app.

### 3. Start the app

```bash
npx expo start
```

- **On your phone:** scan the QR code with your camera (iPhone) or with the Expo Go app (Android). Your phone and computer need to be on the same Wi-Fi.
- **In a browser:** press `w` in the terminal.

The Home screen shows "Database connected" once your `.env` file is right. If you change `.env`, stop the app with `Ctrl+C` and start it again.

## Useful commands

```bash
npx expo start          # run the app
npx tsc --noEmit        # check the code for type errors
npx expo export -p web  # build the web version into dist/
```

## Roadmap

1. **v1 Inventory:** shared household, spaces and items, barcode scan, custom lists, and a grocery list that fills itself. *This is in progress.*
2. **v2 Tasks:** recurring jobs, chores assigned to members (including kid logins), and push reminders.
3. **v3 Smart help:** meal ideas from the pantry, and plant care based on the weather.
4. **v4 Voice and agents:** Alexa, Google Home and agent access.
