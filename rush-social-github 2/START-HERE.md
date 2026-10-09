# Publish Rush Social from GitHub

This is the complete source. Upload the **contents of this folder**, including `.github` and `.gitignore`, to the root of one GitHub repository. Use the `main` branch. GitHub stores the code; Cloudflare runs the site, database, and photo storage. GitHub Pages alone cannot run this app.

## 1. Create your Cloudflare resources

Create a Cloudflare account at https://dash.cloudflare.com.

- Open **Storage & databases → D1 SQL Database**. Create `rush-social-db`. Copy its **Database ID** (a UUID).
- Open **Storage & databases → R2 object storage**. Enable R2 if prompted, then create a bucket named `rush-social-uploads`. Leave public access disabled. Cloudflare may require billing setup to enable R2; review its pricing during setup.
- Open **Workers & Pages** and finish setting up your Workers subdomain if prompted.

If you choose different resource names, change `databaseName` and `bucketName` in `deploy.config.json`. `workerName` controls the deployed app's name; choose a different one if your account already has a Worker named `rush-social`.

## 2. Put the source on GitHub

The easiest approach is **GitHub Desktop**:

1. Extract the ZIP.
2. In GitHub Desktop choose **File → Add Local Repository**, select the extracted folder, and use **create a repository here** if prompted. Do not initialize a separate parent folder.
3. Commit the files with the message `Initial Rush Social source`.
4. Click **Publish repository**. Choose public or private. Both can deploy.
5. Confirm the default branch is `main`. If needed, rename it in GitHub Desktop before publishing.

When using the GitHub website instead, upload all files and folders at the repository root. Hidden files matter: on a Mac, press **Command + Shift + .** in Finder to reveal `.github`, `.gitignore`, and `.nvmrc`. Do not upload `node_modules`, `dist`, or `.wrangler`.

## 3. Add the deployment settings to GitHub

In your GitHub repository, open **Settings → Secrets and variables → Actions**.

Under **Variables**, add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_D1_DATABASE_ID` | The UUID you copied from your Cloudflare D1 database |

Under **Secrets**, add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID, shown in the dashboard |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token with permission to deploy Workers and access D1 and R2 |

Create the token in Cloudflare **My Profile → API Tokens**. Start with the **Edit Cloudflare Workers** template, restrict it to your account, and include **Account → D1 → Edit** and **Account → Workers R2 Storage → Edit**. Keep the template's Worker deployment permissions. Copy the token into the GitHub secret. Do not put it into any source file.

## 4. Deploy

Open the repository's **Actions** tab, select **Test and deploy Rush Social**, and click **Run workflow** on `main`.

The workflow installs dependencies, checks the code, tests the backend, builds the app, creates the database tables through migrations, and deploys the site. It stops if a step fails. The first push may show a failed deployment before you add the settings; run it again after setup.

When it turns green, open the deployment step's log to find the `https://rush-social.<your-subdomain>.workers.dev` address. You can also find it under your Worker in Cloudflare. Share that address with your friends. Future pushes to `main` deploy updates automatically.

Log in with your existing MarketRush email and password. The app authenticates against the original game's server. It does not create game accounts. Both the game server and your Cloudflare resources must be available.

## If deployment fails

- **Missing/invalid database ID:** check the Actions variable name and UUID, then rerun the workflow.
- **Authentication/permission error:** check the two secrets and the token's account, Worker, D1, and R2 permissions.
- **Bucket/database not found:** match the names in `deploy.config.json` to the resources in Cloudflare.
- **Login fails:** verify those credentials work in the original MarketRush game.

See `README.md` for local development, architecture, and trade-feed limits.
