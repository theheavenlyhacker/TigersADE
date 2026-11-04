Tigers ADE: Documentation
Access Data Environment (ADE) for Tigers café. A frontend prototype with an owner dashboard and a branch manager dashboard, built with Next.js. All data is sample data, and there is no backend yet.
1. Overview
Tigers café runs three branches: Tigers cafe Main, Tigers cafe Annex and Tigers cafe Pacol. ADE gives the owner (Roy Fabay) one connected view of all branches, and gives each branch manager a view of their own branch only. Currency is the Philippine peso (₱).
2. Tech stack
Next.js 14 (App Router) and React 18
TypeScript
Tailwind CSS 3
Node.js 18 or newer
3. Running the project
Unzip Tigers\_ADE\_.zip.
Open a terminal in the folder.
Run npm install.
Run npm run dev, then open http://localhost:3000.
The first page load in dev mode can take 10 to 30 seconds because pages compile on first visit. For a faster demo, run npm run build and then npm start.
4. Logging in
This is a demo login. Any email and password work. The Log in as dropdown chooses the account. The demo buttons below the form log in directly.
Account
Role
Branch access
Roy Fabay (roy@tigerscafe.ph)
Owner
All branches
Mika Santos (main@tigerscafe.ph)
Branch manager
Tigers cafe Main
Paolo Reyes (annex@tigerscafe.ph)
Branch manager
Tigers cafe Annex
Liza Cruz (pacol@tigerscafe.ph)
Branch manager
Tigers cafe Pacol

Typing one of the emails above logs you in as that person, whatever the dropdown says.
5. Owner vs. branch manager
Feature
Owner
Branch manager
Dashboard title
Executive dashboard
Branch name
Branch filter and sidebar switching
Yes
No, fixed to own branch
Branch performance comparison
Yes
No
Ask AI and Export report buttons
Yes
No
Daily target progress
No
Yes
End-of-day cash close
No
Yes
Sales, Inventory, Products, Expenses, Staff tabs
All branches
Own branch only

6. Screens
Executive dashboard: summary cards, revenue overview chart, branch comparison (owner), best-selling products, expense tracking, and attention cards.
Sales &amp; revenue: Daily, Weekly and Monthly trend toggle and a per-branch sales table.
Inventory: stock levels per item, a low-stock filter and a Reorder button.
Products: search and category filters, with price, units, revenue and margin.
Expenses: month-to-date total, spending by category and expenses as a share of sales.
Staff &amp; activity: roster with shifts and an activity log (price changes, voids, stock adjustments).
Ask AI panel: a side panel on the owner dashboard. It has suggested questions, a text box, and a "How this was calculated" note on each answer. It pushes the dashboard aside on desktop and covers the screen on phones.
7. Project structure
Tigers\_ADE\_/
  app/
    page.tsx            Login page
    layout.tsx          Root layout
    globals.css         Styles
    (app)/              Pages shown after login
      layout.tsx        Wraps pages in the sidebar shell
      dashboard/ sales/ inventory/ products/ expenses/ staff/
  components/
    Auth.tsx            Login state, branch scope, Ask AI open state
    Shell.tsx           Sidebar, navigation, route protection
    AskAI.tsx           Ask AI side panel
    ui.tsx              Page header, stat card, progress bar, line chart
  lib/data.ts           All sample data and the peso formatter
8. Data layer
Every number comes from lib/data.ts. It holds branches, users, products, inventory, expense categories, staff and activity. The peso() function formats amounts as ₱.
To connect a real backend later, replace these exports with API or database calls and keep the pages the same. Branch access is already handled in one place: Auth.tsx provides a list of branches the logged-in user is allowed to see, and every page reads from it.
9. Customizing
Names, branches and amounts: edit lib/data.ts.
Brand colors: edit tailwind.config.js (brand, mint, sage, paper, ink).
Ask AI answers: edit the answer function in components/AskAI.tsx.
10. Known limitations
Sample data only. Nothing is saved: a reorder or cash close resets on refresh.
Login is a demo and has no real authentication. The session is kept in the browser's local storage.
Ask AI uses keyword matching on sample data. The real version should convert questions to database queries (text-to-SQL), with defined metrics and permissions.
The forecast is a simple daily average with a ±8% range, not a seasonal model.
Export report is a placeholder.
Not built yet: POS, what-if tool, inter-branch transfers, offline mode, alerts and daily summaries, and extra roles (area manager, cashier, accountant).
11. Suggested next steps
Build the POS and inventory per branch.
Replace sample data with a real database and authentication.
Add alerts and daily summaries by SMS, email or Viber.
Connect the AI chat to real queries.
Add forecasting once there are 1 to 2 years of sales history.
12. Troubleshooting
Old screen after an update: stop the server, delete the .next folder, run npm run dev and hard refresh with Ctrl + Shift + R.
"No account with that email": this is the old login code. Update to the latest zip.
Slow first load: normal in dev mode. Use npm run build then npm start.
Port already in use: run npm run dev -- -p 3001.
