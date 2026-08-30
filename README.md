# Discord Welcome & Invite Tracking Bot

A simple Discord.js v14 bot for welcoming new members and tracking who invited them.

## Features

- Custom welcome embed when a member joins
- Welcome message with member mention and member count
- Custom welcome banner/GIF
- Invite tracking
- Tracks normal joins, fake/new-account invites, and members who leave
- `.invstats` and `.myinvstats` for personal invite statistics
- `.invcheck @user` for staff/admin invite statistics
- `.weltest` to preview the current welcome message
- `/weltest` slash command for the same welcome preview
- `.help` for the command list
- JSON-based local database
- Configuration is loaded from `config.json` when needed, so message/channel changes generally do not require a restart
- Supports Pterodactyl and normal Node.js hosting

---

## Requirements

- Node.js 18 or newer is recommended
- A Discord bot application
- The bot must be added to your Discord server
- Discord.js v14

---

## Project Structure

```text
discord-welcome-bot/
│
├── index.js
├── config.json
├── db.json
├── package.json
└── package-lock.json
```

### File explanation

| File | Purpose |
|---|---|
| `index.js` | Main bot code and all events/commands |
| `config.json` | Bot token, server ID, channels, messages and settings |
| `db.json` | Stores invite/member tracking data |
| `package.json` | Project information and start script |
| `package-lock.json` | Locks dependency versions |

> Do not delete `db.json` while the bot is running. It contains the invite tracking data.

---

# Installation

## 1. Install Node.js

Install Node.js on your machine/server.

Then check:

```bash
node -v
npm -v
```

---

## 2. Install dependencies

Open the bot folder in a terminal and run:

```bash
npm install
```

---

# Discord Bot Setup

Go to the Discord Developer Portal and create a bot application.

After creating the bot:

1. Open the **Bot** section.
2. Copy the bot token.
3. Keep the token private.
4. Enable these **Privileged Gateway Intents**:

- Server Members Intent
- Message Content Intent

The code also uses the Guild Invites intent for invite tracking.

---

# Bot Permissions

The bot needs enough permissions to perform its jobs.

Recommended permissions:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Manage Server

### Why Manage Server?

Invite tracking uses Discord's invite information. The bot needs permission to fetch server invites.

If invite tracking does not work, check that the bot has permission to view/fetch invites and that the required intents are enabled.

---

# Configuration

Open:

```text
config.json
```

You will see settings like:

```json
{
  "token": "your_discord_bot_tocken",
  "guildId": "you discord guild id",
  "prefix": ".",
  "welcomeChannelId": "welcome_channel_id",
  "welcomeMessage": "Your welcome message",
  "welcomeBannerUrl": "https://example.com/banner.gif",
  "joinedChannelId": "your_welcome_channel",
  "leftChannelId": "your_leaves_player_channel_id",
  "joinNoInviteMessage": "**{name}** has joined, I don't know who invited them.",
  "joinWithInviteMessage": "**{name}** has joined, invited by **{invitinguser}**",
  "leaveKnownInviterMessage": "{lefteduser} has left, invited by **{invitinguser}**",
  "leaveUnknownInviterMessage": "{lefteduser} has left, I don't know who invited them.",
  "embedColor": "FF4500",
  "fakeInviteAccountAgeDays": 7,
  "adminRoleIds": []
}
```

## What you need to change

### `token`

Put your Discord bot token here if you are not using the `TOKEN` environment variable.

```json
"token": "YOUR_BOT_TOKEN"
```

**Never publish your real bot token on GitHub.**

The code supports:

```text
TOKEN environment variable
```

and uses it before the token stored in `config.json`.

---

### `guildId`

Put the ID of the Discord server where the bot will operate.

```json
"guildId": "YOUR_SERVER_ID"
```

To copy a server ID, enable Developer Mode in Discord and use **Copy Server ID**.

---

### `prefix`

The default command prefix is:

```json
"prefix": "."
```

That means commands are:

```text
.invstats
.weltest
.help
```

You can change it, for example:

```json
"prefix": "!"
```

Then the commands become:

```text
!invstats
!weltest
!help
```

---

# Channel IDs

You need to set three channel IDs.

## Welcome channel

```json
"welcomeChannelId": "CHANNEL_ID"
```

This is where the main welcome embed is sent.

## Join tracking channel

```json
"joinedChannelId": "CHANNEL_ID"
```

This is where the bot reports who joined and who invited them.

## Leave tracking channel

```json
"leftChannelId": "CHANNEL_ID"
```

This is where the bot reports members who leave.

---

# Welcome Message

The main welcome text is:

```json
"welcomeMessage": "Your welcome message here"
```

You can use these placeholders:

| Placeholder | Meaning |
|---|---|
| `{Name}` | Mentions the new member |
| `{username}` | Discord username |
| `{membercount}` | Current server member count |

Example:

```text
"welcomeMessage": "Welcome {Name}!\nYou are member #{membercount}."
```

---

# Welcome Banner

Change:

```json
"welcomeBannerUrl": "YOUR_IMAGE_OR_GIF_URL"
```

The URL must point directly to an image/GIF that Discord can display.

---

# Join and Leave Messages

### Unknown inviter

```json
"joinNoInviteMessage": "**{name}** joined the server, but I don't know who invited them."
```

### Known inviter

```json
"joinWithInviteMessage": "**{name}** joined the server, invited by **{invitinguser}**."
```

### Known inviter when someone leaves

```json
"leaveKnownInviterMessage": "{lefteduser} has left, invited by **{invitinguser}**."
```

### Unknown inviter when someone leaves

```json
"leaveUnknownInviterMessage": "{lefteduser} has left, I don't know who invited them."
```

Available placeholders:

- `{name}`
- `{invitinguser}`
- `{lefteduser}`

---

# Fake Invite Detection

The bot can classify a new Discord account as a fake/new-account invite.

Setting:

```json
"fakeInviteAccountAgeDays": 7
```

This means an account created less than 7 days ago can be counted as a fake invite when the inviter is known.

For example:

```json
"fakeInviteAccountAgeDays": 3
```

would use 3 days instead.

---

# Admin / Staff Roles

The bot checks for:

1. Discord Administrator permission, or
2. A role listed in `adminRoleIds`

Example:

```json
"adminRoleIds": [
  "123456789012345678",
  "987654321098765432"
]
```

Put your staff/admin role IDs inside this array.

---

# Commands

## Normal User Commands

### `.invstats`

Shows your invite statistics.

```text
.invstats
```

### `.myinvstats`

Alias of `.invstats`.

```text
.myinvstats
```

---

## Admin / Staff Commands

### `.invcheck @user`

Checks another member's invite statistics.

```text
.invcheck @user
```

### `.weltest`

Shows the current welcome embed as a preview.

```text
.weltest
```

### `/weltest`

Slash-command version of the welcome preview.

```text
/weltest
```

### `.help`

Shows the bot's help menu.

```text
.help
```

---

# Invite Statistics

The bot stores invite information in:

```text
db.json
```

It keeps information about:

- Member ID
- Inviter ID
- Whether the invite was classified as fake
- Guild ID
- Normal joins
- Fake invites
- Members who later left

Do not manually edit `db.json` unless you know what you are changing.

---

# Starting the Bot

Run:

```bash
npm start
```

or:

```bash
node index.js
```

If everything is configured correctly, you should see a login message in the console.

---

# Environment Variable Token

For public repositories, using an environment variable is recommended.

Set:

```text
TOKEN=YOUR_DISCORD_BOT_TOKEN
```

The bot uses:

```text
process.env.TOKEN
```

before falling back to the token in `config.json`.

This is safer for hosting platforms such as Pterodactyl.

---

# Pterodactyl Setup

If you are hosting the bot on Pterodactyl:

1. Upload the project files.
2. Install the Node.js egg/environment.
3. Make sure the server uses a supported Node.js version.
4. Install dependencies:

```bash
npm install
```

5. Add an environment variable:

```text
TOKEN
```

6. Put your Discord bot token in that variable.
7. Start the server with:

```bash
npm start
```

You can keep the token out of `config.json` when using the environment variable.

---

# Troubleshooting

## Bot does not start

Check:

- Node.js is installed
- `npm install` completed successfully
- `config.json` is valid JSON
- The bot token is correct
- The bot has been added to the server

---

## Welcome message is not appearing

Check:

- `guildId`
- `welcomeChannelId`
- Bot can view the channel
- Bot can send messages
- Bot can embed links
- Server Members Intent is enabled

---

## Invite tracking is not working

Check:

- Bot has the required server permissions
- Invite-related access is available
- Server Members Intent is enabled
- The bot is actually in the configured server
- `guildId` is correct

Invite tracking can also be unable to identify an inviter in some situations, such as vanity URL joins or when Discord does not provide enough information to determine the invite.

---

## Commands do not work

Check:

- `prefix` in `config.json`
- Message Content Intent is enabled
- Bot can read messages
- You are using the correct server
- For admin commands, your account has Administrator permission or one of the configured admin roles

---

# GitHub Security

If you are making this repository public, **do not upload a real Discord bot token**.

Recommended `.gitignore`:

```gitignore
node_modules/
config.json
.env
```

Instead, upload a safe example configuration such as:

```text
config.example.json
```

with fake/placeholder values.

For example:

```json
{
  "token": "YOUR_BOT_TOKEN",
  "guildId": "YOUR_SERVER_ID"
}
```

Then users can copy it:

```text
config.example.json
        ↓
config.json
```

and fill in their own values.

> If a real bot token is ever accidentally published, immediately regenerate/reset the token in the Discord Developer Portal.

---

# Making the Repository Public

Recommended GitHub repository structure:

```text
discord-welcome-bot/
│
├── index.js
├── config.example.json
├── db.json
├── package.json
├── package-lock.json
├── .gitignore
├── LICENSE
└── README.md
```

GitHub automatically displays `README.md` on the main repository page.

So when someone opens your repository, they can immediately see:

- What the bot does
- Features
- Installation
- Configuration
- Commands
- Project structure
- Hosting instructions
- Troubleshooting
- License

---

# Important Before Publishing

Your current source contains `config.json`.

Before making the repository public:

1. Make sure there is **no real bot token** inside `config.json`.
2. Do not publish private server credentials.
3. Add `config.json` to `.gitignore`.
4. Publish `config.example.json` instead.
5. Keep `db.json` only if you are comfortable publishing the existing invite/member data. For a clean public repository, it is better to publish an empty example database.

The source code itself does not need to be changed just to use this README. These are GitHub/public-repository safety steps.

---

## License

This project is released under the MIT License. See [`LICENSE`](LICENSE) for details.

---

## Credits

Built with [Discord.js](https://discord.js.org/).

Made for Discord server welcome and invite tracking.
