# HomeTrack

HomeTrack turns your home into a living database. It tracks what you have (pantry, garage, plants, gear, tools, bills) and reminds the household when something needs doing.

- **Product spec and data model:** [HomeTrack: Product Spec & Data Model](https://claude.ai/artifact/6qr2KrrjxR7GeYqWsVBY7W)
- **Runs on:** iPhone, Android and the web, all from this one codebase
- **Built with:** [Expo](https://expo.dev) (React Native + TypeScript) for the app, and [Supabase](https://supabase.com) (a hosted Postgres database) for accounts, data and live sync between household members

## What's in the repo

| Path | What it is |
| --- | --- |
| `src/app/` | The app's screens. Each file is one screen. The three tabs are in `(tabs)/`, and the pages they open are in `space/`, `item/` and `list/`. |
| `src/components/` | Reusable building blocks such as cards, the page frame and the tab bar. |
| `src/lib/supabase.ts` | The connection to the database. |
| `src/lib/inventory.ts` | Every read and write the app makes to the database. |
| `src/lib/household.tsx` | Tracks who is signed in and which household they belong to. |
| `src/lib/types.ts` | The shapes of the database rows, used by the app's code. |
| `supabase/migrations/` | The database setup scripts: tables, starter spaces and lists, the security rules that keep each household's data private, and the grocery list rules. |
| `supabase/tests/` | Checks for the database rules, which run on a plain local Postgres (`psql -d <test db> -f supabase/tests/inventory_rules_test.sql`). |
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
2. When the project is ready, open **SQL Editor**. For each file in `supabase/migrations/`, oldest first, click **New query**, paste in the whole file, and click **Run**. You should see "Success. No rows returned." each time. There are three files so far:
   1. `20261114000000_initial_schema.sql` (the tables and security rules)
   2. `20261114010000_inventory_rules.sql` (the self-filling grocery list and restocking)
   3. `20261114020000_tasks_and_roles.sql` (recurring tasks, and what kids can and can't change)

   If you already ran the first two, just run the new one.
3. Open **Project Settings → API** (or the **Connect** button) and copy the **Project URL** and the **publishable** key. Older projects call this key `anon`.
4. In the HomeTrack folder, copy `.env.example` to a new file named `.env` and paste in those two values.
5. **Optional, for testing:** Supabase emails a confirmation link to every new account by default. To skip that while you try things out, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. Turn it back on before inviting other people.

The `.env` file is never committed to GitHub. The publishable key is safe to use inside the app, because the database's security rules decide what each person can see. Never put the **secret** or `service_role` key in the app.

### 3. Start the app

```bash
npx expo start
```

- **On your phone:** scan the QR code with your camera (iPhone) or with the Expo Go app (Android). Your phone and computer need to be on the same Wi-Fi.
- **In a browser:** press `w` in the terminal.

If the app says "Database not connected yet", check your `.env` file. If you change `.env`, stop the app with `Ctrl+C` and start it again.

## Using the app

1. **Create an account**, then **start a household** with a name. You get starter spaces (Pantry, Fridge and Freezer, Garage, Houseplants, Gear, Tools, Bills) and two lists (Groceries, To-do).
2. **Add items** from Home or from inside a space. On a phone, **Scan barcode** fills in the product name for food items, using the free [Open Food Facts](https://world.openfoodfacts.org) database.
3. Use **−**, **+** and **Out** as things get used up. When an item runs out, or drops to the "add to groceries when it drops to" number, it goes onto **Groceries** by itself.
4. Tick something off **Groceries** after shopping, and it's added back to your stock.
5. Make more lists on the **Lists** tab, such as to-dos, chores or a Costco run. On to-do and chore lists you can say who each entry is for.
6. To share, open **Household** and send someone the invite code. They create an account and pick **Join with a code**. Everyone sees changes live.
7. On the **Tasks** tab, tap a **Quick add** idea (trash, furnace filter, oil change, waxing the skis…) or **Add task** to set your own schedule, who does it and a reminder time. Tap **Done** and a repeating task moves to its next date. Home shows your tasks due today or tomorrow.
8. The household owner can make a member a **Kid** on the **Household** tab. Kids can see everything, tick off lists and tasks, and add to lists, but can't change items, tasks or spaces.

**Reminders:** on a phone, HomeTrack asks to send notifications and then reminds you on the due date at the time you picked, for tasks assigned to you or to anyone. These are scheduled on the phone itself, so they work in Expo Go with no server. They aren't sent on the web. Reminders that reach every phone when someone else changes a task need a custom app build, which comes later.

Known gap on the web: refreshing the browser on the Lists or Household tab takes you back to Home.

## Useful commands

```bash
npx expo start          # run the app
npx tsc --noEmit        # check the code for type errors
npx expo export -p web  # build the web version into dist/
```

## Roadmap

1. **v1 Inventory:** shared household, spaces and items, barcode scan, custom lists, and a grocery list that fills itself. *Built.*
2. **v2 Tasks:** recurring jobs, chores assigned to members, kid roles, and on-phone reminders. *Built, being tested.* Server push reminders come with the first custom build.
3. **v3 Smart help:** meal ideas from the pantry, and plant care based on the weather.
4. **v4 Voice and agents:** Alexa, Google Home and agent access.
