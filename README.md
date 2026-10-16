# Duty Roster (Vibes Lounge)

A simple roster system for F&B staff.

- **Supervisor page** (`/admin`): pick department and week, fill the grid with dropdowns, save a draft, then publish.
- **Staff page** (`/`): staff pick their department, enter the shared department password, and see the published roster. They can pick their name to highlight their own row and see "my week".
- Built with plain HTML, CSS and JavaScript, a few small serverless API files, and Upstash Redis for storage. Hosted on Vercel.

Departments set up: **Waitress, Supervisors, Kitchen** (Vibes Lounge). Names and duty posts come from the handwritten sheet and can be corrected inside the app (Settings tab). The Hotel outlet will be added later.

## Deploy (about 15 minutes)

### 1. Put the project on GitHub
Create a new GitHub repository and upload this whole folder (do not upload `node_modules`).

### 2. Create the Upstash Redis database
1. Sign up at upstash.com (free).
2. Create a **Redis** database, pick the region closest to you, and choose the free plan.
3. On the database page, find the **REST API** section and copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

(If you use the Upstash integration from the Vercel Marketplace instead, Vercel adds these for you, as `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The app accepts either pair of names.)

### 3. Create the Vercel project
1. Sign up at vercel.com and choose **Add New > Project**, then import your GitHub repository.
2. Leave the framework as "Other". Before pressing Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
| `ADMIN_PASSWORD` | the supervisor password you choose |
| `SESSION_SECRET` | a long random text, at least 16 characters (smash the keyboard, 40+ characters) |

3. Press **Deploy**. When it finishes, you get a link like `your-project.vercel.app`.

### 4. First-time setup in the app
1. Open `your-project.vercel.app/admin` and log in with `ADMIN_PASSWORD`.
2. Go to **Staff, posts & passwords**. Check the spelling of every name (some handwriting was hard to read) and the duty posts.
3. Set a **password for each department**. Staff cannot log in to a department until you do.
4. Optional: press **Load sample week** to fill 12-18 Oct as a draft and try things out.
5. Go to **Roster**, choose the week, fill it in, and press **Publish to staff**.
6. Share the main link (`your-project.vercel.app`) with staff, plus their department password.

## Day-to-day use (supervisor)
- Choose the department and week, then pick a duty post in each cell. Use **Fill row...** for someone who works the same post all week.
- **Copy last week** starts from last week's roster; change only what is different.
- The table under the grid counts how many people are on each post each day. A name marked "no off day" has no Off all week.
- **Save draft** keeps it private. **Publish to staff** makes it visible. You can edit and publish again at any time.
- **Print** gives a clean printout for the notice board.

## Security notes
- The database token only lives on the server (Vercel). The browser never talks to Redis directly.
- Department and supervisor passwords are checked on the server. Department passwords are stored hashed.
- After 10 wrong passwords from the same address, logins are paused for 10 minutes.
- One department's password cannot open another department's roster.
- Staff who log in stay logged in on that phone for 30 days. Changing a department password does not log out people who are already in.

## Run it on your own computer (optional)
```
npm install
npm run dev     # http://localhost:3000, supervisor password: admin123
npm test        # runs automated checks
```
Without Upstash keys this uses temporary in-memory storage that resets when you stop it.

## Adding the Hotel outlet later
Send the Hotel sample sheet and the next update will add it. The pages already show an Outlet dropdown as soon as there is more than one outlet, and each outlet keeps its own staff, posts, passwords and rosters.
