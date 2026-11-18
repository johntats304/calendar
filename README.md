# Smart Calendar Task Board (PH)
Calendar + per-date sticky-note boards, login, and admin user management.
Accounts and boards are stored on Netlify (Functions + Blobs), so every PC sees the same data.

## Deploy (must be Git or CLI — plain drag-and-drop does not install the function's dependency)
1. Push this folder to a GitHub repo, then Netlify > Add new site > Import from Git (no build command, publish dir `.`).
   OR: `npm i -g netlify-cli && npm install && netlify deploy --prod`
2. Open the site and log in with the default admin account, then change its password in Users.
