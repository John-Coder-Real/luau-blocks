# Publish RoBlocks Studio with GitHub Pages

This package contains the full source code, a prebuilt copy of the static site,
and a GitHub Actions workflow that rebuilds and publishes the app.

## Upload it

1. Create a new GitHub repository. A public repository works on every GitHub plan.
2. Extract this ZIP and upload **all extracted files and folders** to the repository root.
3. Commit the upload to the `main` branch.
4. Open the repository's **Settings → Pages**.
5. Under **Build and deployment**, choose **GitHub Actions** as the source.
6. Open the **Actions** tab and wait for “Deploy RoBlocks Studio to GitHub Pages” to finish.

GitHub will show the public URL in the completed workflow and in Settings → Pages.
The first deployment can take a few minutes.

## Update it later

Edit the source and push to `main`. The included workflow runs automatically.

For local development:

```bash
npm install
npm run dev:pages
```

For a local production build:

```bash
npm ci
npm run build:pages
```

The generated static files are written to `pages-dist/`. Relative asset paths are
used, so the app works both at a custom domain and under a repository URL such as
`https://username.github.io/repository-name/`.

## Notes

- Projects are saved in the visitor's browser using local storage; no server or database is required.
- Exporting projects and Luau files happens entirely in the browser.
- Clearing browser storage removes locally saved projects unless they were exported first.
