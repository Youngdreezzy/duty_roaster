# Duty Roster (Vibes Lounge + Hotel)

A simple roster system for F&B staff.

- **Staff page** (`/`): staff pick their outlet and department, enter the shared department password, and see the published roster. They can pick their name to highlight their row and see "my week". A link like `/?outlet=hotel` opens with the Hotel already selected.
- **Supervisor page** (`/admin`): fill the weekly grid with dropdowns, save a draft, then publish.
- Plain HTML, CSS and JavaScript, a few small serverless API files, Upstash Redis for storage, hosted on Vercel.

## Who can do what

| Login | Where | Can do |
|---|---|---|
| **Super admin** (password = `ADMIN_PASSWORD` in Vercel) | Supervisor page > "Super admin" | Everything: all outlets, set each outlet's supervisor password, add departments, load sample data |
| **Outlet supervisor** (e.g. "Hotel supervisor") | Supervisor page > "Hotel supervisor" | Fill and publish rosters, edit staff names, shifts/posts, cover places and staff passwords **for their own outlet only** |
| **Staff** | Staff page | View their own department's published roster only |

Passwords: each outlet has one supervisor password (set by the super admin), and each department has one shared staff password (set by the super admin or that outlet's supervisor). Hotel and Vibes Lounge passwords are completely separate.

## Departments set up

- **Vibes Lounge:** Waitress, Supervisors, Kitchen
- **Hotel:** Restaurant, Karaoke Bar, Pool Bar (shifts M, N, OFF; cover places RST, KB, PB, AB)

Names, posts, cover places and shift notes can all be corrected inside the app (Settings tab). The super admin can add more departments there too.

## Deploy / update

1. Upload the contents of this folder to your GitHub repository, replacing the old files. The `api` folder must contain **only** `[action].js`. Delete any other file in `api`.
2. Vercel redeploys automatically. Environment variables needed: `ADMIN_PASSWORD`, `SESSION_SECRET` (16+ random characters), and the Upstash keys (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`). Values must not have quote marks around them.
3. Open `your-site/api/health`. It should say `"ready": true`.

## After updating to this version (one time)

1. Open `your-site/admin`, choose **Super admin**, and log in with `ADMIN_PASSWORD`.
2. Open the **Staff, posts & passwords** tab. For each outlet (switch with the Outlet dropdown on the Roster tab) set the **supervisor password**. Until you do, nobody can log in as that outlet's supervisor.
3. For the Hotel, set the staff password for Restaurant, Karaoke Bar and Pool Bar, and check every name.
4. Your existing Vibes Lounge staff, posts, passwords and rosters are kept. The Hotel is added automatically.

## Day-to-day use (supervisor)
- Choose the department and week, then pick a shift or duty post in each cell. **Fill row...** fills a whole row.
- In the Hotel, the small **cover…** dropdown under a cell marks someone covering at another place (shown as `M·PB`). It is switched off for OFF days.
- **Copy last week** starts from last week's roster. Change only what is different.
- The table under the grid counts who is on each post per day. A name marked "no off day" has no OFF all week.
- **Save draft** keeps it private. **Publish to staff** makes it visible. You can edit and publish again at any time.
- **Print** gives a clean printout for the notice board.

## Security notes
- The database key only lives on the server. The browser never talks to Redis directly.
- Passwords are checked on the server and stored hashed. After 10 wrong passwords from one address, logins pause for 10 minutes.
- A supervisor of one outlet cannot read or change another outlet. A department's staff password opens only that department.

## Run it on your own computer (optional)
```
npm install
npm run dev     # http://localhost:3000, super admin password: admin123
npm test        # runs automated checks
```
Without Upstash keys this uses temporary in-memory storage that resets when you stop it.
