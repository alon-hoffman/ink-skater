# Cloud levels setup (Google Sheets)

You do this once. It takes about 5 minutes.

1. Go to https://sheets.google.com and create a new blank spreadsheet. Name it e.g. "InkSkater levels".
2. In the spreadsheet menu click **Extensions > Apps Script**. A code editor opens in a new tab.
3. Delete everything in the editor, then open `cloud/Code.gs` from this project, copy all of it, and paste it in.
4. Click the save icon (or Ctrl+S).
5. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
7. Click **Authorize access** and pick your Google account. If you see "Google hasn't verified this app", click **Advanced > Go to (project name) (unsafe)** and allow. This is your own script.
8. Copy the **Web app URL** (it ends in `/exec`).
9. In the game open **My Levels > Cloud**, paste the URL, then click **Test connection**.
10. Use **Upload** on a level to send it, and **Download from cloud** to fetch levels.

## After you edit the script

Click **Deploy > Manage deployments**, click the pencil (Edit) icon, set **Version: New version**, and click **Deploy**. The URL stays the same. Just saving the code is not enough.

## Who can change a level

There is no password. Everyone can list and download every level. Each device creates a random owner key the first time it uses the cloud (stored in the browser as `inkskater.owner.v1`). The sheet stores only a SHA-256 hash of that key next to each level, and the script refuses to overwrite or delete a level unless the key matches.

- Clearing browser data loses the key, and with it the ability to change your uploaded levels.
- A different device has a different key. Downloading someone else's level gives you your own copy to edit and upload.
- Levels uploaded before this change have no owner; the first device to re-upload one claims it.
- Anyone who gets hold of the key (for example from your browser's developer tools) can act as you.
