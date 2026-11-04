// Deployment settings. Leave leaderboardApiUrl empty to keep the leaderboard on this device only.
// The URL is the Apps Script web app of server/apps-script/Code.gs (see server/apps-script/README.md).
// Do not commit a real URL: forks and clones would then write to your sheet.
// GitHub Pages: set the repository variable LEADERBOARD_API_URL (pages.yml injects it on deploy).
// Local use: edit the value below on your machine only and do not commit it.
window.SUMMING_CONFIG = {
    leaderboardApiUrl: ''
};
