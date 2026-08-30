const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  PermissionsBitField,
} = require('discord.js');

const configPath = path.join(__dirname, 'config.json');
const dbPath = path.join(__dirname, 'db.json');

// ---------------------------------------------------------------------------
// CONFIG HELPERS
// ---------------------------------------------------------------------------

// Reads config.json fresh every time — so editing messages/channels takes
// effect immediately, no bot restart needed.
function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

// token/guildId etc only needed once at startup
const startupConfig = loadConfig();

function embedColor(cfg) {
  const hex = (cfg.embedColor || 'FF4500').replace('#', '');
  return parseInt(hex, 16);
}

// ---------------------------------------------------------------------------
// SIMPLE JSON "DATABASE"
// Structure:
// {
//   "members": { "<memberId>": { "inviterId": "<id>|null", "isFake": bool, "guildId": "<id>" } },
//   "stats":   { "<inviterId>": { "joins": 0, "fake": 0, "left": 0 } }
// }
// ---------------------------------------------------------------------------

function loadDB() {
  if (!fs.existsSync(dbPath)) {
    const empty = { members: {}, stats: {} };
    fs.writeFileSync(dbPath, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    console.error('❌ db.json was corrupted, resetting it.', err);
    const empty = { members: {}, stats: {} };
    fs.writeFileSync(dbPath, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function saveDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function getStats(db, userId) {
  if (!db.stats[userId]) {
    db.stats[userId] = { joins: 0, fake: 0, left: 0 };
  }
  return db.stats[userId];
}

// ---------------------------------------------------------------------------
// INVITE CACHE (in-memory) — guildId -> Map(code -> { uses, inviterId })
// ---------------------------------------------------------------------------

const inviteCache = new Map();

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach((inv) => {
      map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter ? inv.inviter.id : null });
    });
    inviteCache.set(guild.id, map);
  } catch (err) {
    console.error('❌ Could not fetch/cache invites (bot needs "Manage Server" permission):', err.message);
  }
}

// Figures out which invite was used by comparing the live invite list
// against our cached snapshot. Returns the inviter's user id, or null if it
// can't be determined (e.g. vanity URL, or invite expired/deleted instantly).
async function resolveUsedInvite(guild) {
  const before = inviteCache.get(guild.id) || new Map();
  let after;
  try {
    after = await guild.invites.fetch();
  } catch (err) {
    console.error('❌ Could not fetch invites on join:', err.message);
    return null;
  }

  let inviterId = null;

  after.forEach((inv) => {
    const prev = before.get(inv.code);
    const prevUses = prev ? prev.uses : 0;
    if ((inv.uses || 0) > prevUses) {
      inviterId = inv.inviter ? inv.inviter.id : null;
    }
  });

  // Check vanity URL usage as a fallback (community servers only)
  if (!inviterId && guild.features.includes('VANITY_URL')) {
    try {
      const vanity = await guild.fetchVanityData();
      const prevVanityUses = before.get('VANITY') ? before.get('VANITY').uses : 0;
      if (vanity.uses > prevVanityUses) {
        inviterId = 'VANITY'; // no single inviter for vanity links
      }
      const map = inviteCache.get(guild.id) || new Map();
      map.set('VANITY', { uses: vanity.uses, inviterId: null });
    } catch (err) {
      // ignore — bot may lack permission
    }
  }

  // refresh cache to the new snapshot
  const map = new Map();
  after.forEach((inv) => {
    map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter ? inv.inviter.id : null });
  });
  inviteCache.set(guild.id, map);

  return inviterId === 'VANITY' ? null : inviterId;
}

// ---------------------------------------------------------------------------
// PERMISSIONS
// ---------------------------------------------------------------------------

function isAdmin(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  const adminRoleIds = cfg.adminRoleIds || [];
  return adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function denyAccess(message) {
  await message.reply("❌ You **don't have access** to do that.");
}

// ---------------------------------------------------------------------------
// PLACEHOLDER REPLACEMENT
// ---------------------------------------------------------------------------

function fillTemplate(template, replacements) {
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    const re = new RegExp(`\\{${key}\\}`, 'gi');
    out = out.replace(re, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// EMBED BUILDERS
// ---------------------------------------------------------------------------

function buildWelcomeEmbed(member) {
  const cfg = loadConfig();

  const description = fillTemplate(cfg.welcomeMessage, {
    Name: `${member}`,
    username: member.user.username,
    membercount: member.guild.memberCount,
  });

  const embed = new EmbedBuilder()
    .setColor(embedColor(cfg))
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  if (cfg.welcomeBannerUrl && !cfg.welcomeBannerUrl.startsWith('PUT_')) {
    embed.setImage(cfg.welcomeBannerUrl);
  }

  return embed;
}

function buildJoinTrackerEmbed({ member, inviterId, isFake }) {
  const cfg = loadConfig();
  let text;

  if (inviterId) {
    text = fillTemplate(cfg.joinWithInviteMessage, {
      name: `${member}`,
      invitinguser: `<@${inviterId}>`,
    });
  } else {
    text = fillTemplate(cfg.joinNoInviteMessage, {
      name: `${member}`,
    });
  }

  if (isFake) {
    text += '\n*(⚠️ counted as a fake invite — new account)*';
  }

  return new EmbedBuilder()
    .setColor(embedColor(cfg))
    .setDescription(text)
    .setTimestamp();
}

function buildLeaveEmbed({ member, inviterId }) {
  const cfg = loadConfig();
  let text;

  if (inviterId) {
    text = fillTemplate(cfg.leaveKnownInviterMessage, {
      lefteduser: member.user ? `**${member.user.tag}**` : `${member}`,
      invitinguser: `<@${inviterId}>`,
    });
  } else {
    text = fillTemplate(cfg.leaveUnknownInviterMessage, {
      lefteduser: member.user ? `**${member.user.tag}**` : `${member}`,
    });
  }

  return new EmbedBuilder()
    .setColor(embedColor(cfg))
    .setDescription(text)
    .setTimestamp();
}

function buildStatsEmbed({ title, targetLabel, stats }) {
  const cfg = loadConfig();
  const net = stats.joins - stats.left;

  return new EmbedBuilder()
    .setColor(embedColor(cfg))
    .setTitle(title)
    .setDescription(
      `*${targetLabel}* invites **${net}**\n` +
      `*${targetLabel}* fake invite **${stats.fake}**\n` +
      `*${targetLabel}* leaved invite player **${stats.left}**`
    )
    .setTimestamp();
}

function buildHelpEmbed(cfg) {
  return new EmbedBuilder()
    .setColor(embedColor(cfg))
    .setTitle('📖 SODAMC BOT — HELP MENU')
    .setDescription('Here are all the available commands, grouped by access level.')
    .addFields(
      {
        name: '🙋 Normal User Commands',
        value:
          `\`${cfg.prefix}invstats\` — Check your own invite stats\n` +
          `\`${cfg.prefix}myinvstats\` — Same as above (alias)`,
      },
      {
        name: '🛡️ Admin / Staff Only Commands',
        value:
          `\`${cfg.prefix}invcheck @user\` — Check another user's invite stats\n` +
          `\`${cfg.prefix}weltest\` — Preview the welcome embed\n` +
          `\`${cfg.prefix}help\` / \`${cfg.prefix}help admin\` — Show this menu`,
      }
    )
    .setFooter({ text: 'SodaMC Invite System' })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// CLIENT SETUP
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // privileged — enable in Dev Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — enable in Dev Portal
    GatewayIntentBits.GuildInvites,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  try {
    const guild = c.guilds.cache.get(startupConfig.guildId);
    if (guild) {
      await guild.commands.create({
        name: 'weltest',
        description: 'Preview the current welcome message (admin only)',
      });
      console.log('✅ /weltest slash command registered');
      await cacheGuildInvites(guild);
      console.log('✅ Invite cache primed');
    } else {
      console.log('❌ Could not find guild. Check guildId in config.json (and make sure the bot is in that server)');
    }
  } catch (err) {
    console.error('Error during startup:', err);
  }
});

// Keep the invite cache fresh in real time
client.on(Events.InviteCreate, async (invite) => {
  const map = inviteCache.get(invite.guild.id) || new Map();
  map.set(invite.code, { uses: invite.uses || 0, inviterId: invite.inviter ? invite.inviter.id : null });
  inviteCache.set(invite.guild.id, map);
});

client.on(Events.InviteDelete, async (invite) => {
  const map = inviteCache.get(invite.guild.id);
  if (map) map.delete(invite.code);
});

// ---------------------------------------------------------------------------
// MEMBER JOIN
// ---------------------------------------------------------------------------

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (member.guild.id !== startupConfig.guildId) return;
    const cfg = loadConfig();
    const db = loadDB();

    // 1) fancy welcome embed (unchanged existing feature)
    const welcomeChannel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (welcomeChannel) {
      await welcomeChannel.send({ embeds: [buildWelcomeEmbed(member)] });
    }

    // 2) figure out who invited them
    const inviterId = await resolveUsedInvite(member.guild);

    // 3) fake invite check — very new Discord account
    const ageDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const isFake = inviterId ? ageDays < (cfg.fakeInviteAccountAgeDays || 7) : false;

    // 4) persist
    db.members[member.id] = {
      inviterId: inviterId || null,
      isFake,
      guildId: member.guild.id,
    };
    if (inviterId) {
      const stats = getStats(db, inviterId);
      if (isFake) stats.fake += 1;
      else stats.joins += 1;
    }
    saveDB(db);

    // 5) send join-tracker message
    const joinChannel = member.guild.channels.cache.get(cfg.joinedChannelId);
    if (joinChannel) {
      await joinChannel.send({ embeds: [buildJoinTrackerEmbed({ member, inviterId, isFake })] });
    } else {
      console.log('❌ joinedChannelId not found. Check config.json');
    }

    console.log(`👋 ${member.user.tag} joined — inviter: ${inviterId || 'unknown'}${isFake ? ' (fake)' : ''}`);
  } catch (err) {
    console.error('Error handling GuildMemberAdd:', err);
  }
});

// ---------------------------------------------------------------------------
// MEMBER LEAVE
// ---------------------------------------------------------------------------

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    if (member.guild.id !== startupConfig.guildId) return;
    const cfg = loadConfig();
    const db = loadDB();

    const record = db.members[member.id];
    const inviterId = record ? record.inviterId : null;

    if (inviterId) {
      const stats = getStats(db, inviterId);
      stats.left += 1;
      saveDB(db);
    }

    const leftChannel = member.guild.channels.cache.get(cfg.leftChannelId);
    if (leftChannel) {
      await leftChannel.send({ embeds: [buildLeaveEmbed({ member, inviterId })] });
    } else {
      console.log('❌ leftChannelId not found. Check config.json');
    }

    console.log(`👋 ${member.user?.tag || member.id} left — original inviter: ${inviterId || 'unknown'}`);
  } catch (err) {
    console.error('Error handling GuildMemberRemove:', err);
  }
});

// ---------------------------------------------------------------------------
// SLASH COMMAND: /weltest (admin only)
// ---------------------------------------------------------------------------

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'weltest') return;

  try {
    const cfg = loadConfig();
    if (!isAdmin(interaction.member, cfg)) {
      await interaction.reply({ content: "❌ You **don't have access** to do that.", ephemeral: true });
      return;
    }
    const embed = buildWelcomeEmbed(interaction.member);
    await interaction.reply({ embeds: [embed] });
    console.log(`🧪 /weltest used by ${interaction.user.tag}`);
  } catch (err) {
    console.error('Error handling /weltest:', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Something went wrong showing the welcome preview.', ephemeral: true });
    }
  }
});

// ---------------------------------------------------------------------------
// PREFIX COMMANDS: .invstats / .myinvstats / .invcheck / .weltest / .help
// ---------------------------------------------------------------------------

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.guild.id !== startupConfig.guildId) return;

  const cfg = loadConfig();
  const prefix = cfg.prefix || '.';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ---- .invstats / .myinvstats (everyone) ----
  if (command === 'invstats' || command === 'myinvstats') {
    const db = loadDB();
    const stats = getStats(db, message.author.id);
    const embed = buildStatsEmbed({ title: 'SODAMC INVITES', targetLabel: 'Your', stats });
    await message.reply({ embeds: [embed] });
    return;
  }

  // ---- .invcheck @user (admin only) ----
  if (command === 'invcheck') {
    if (!isAdmin(message.member, cfg)) return denyAccess(message);

    const target =
      message.mentions.members?.first() ||
      (args[0] ? message.guild.members.cache.get(args[0].replace(/[<@!>]/g, '')) : null);

    if (!target) {
      await message.reply(`⚠️ Usage: \`${prefix}invcheck @user\``);
      return;
    }

    const db = loadDB();
    const stats = getStats(db, target.id);
    const embed = buildStatsEmbed({
      title: 'SODAMC INVITES',
      targetLabel: `${target.user.username}'s`,
      stats,
    });
    await message.reply({ embeds: [embed] });
    return;
  }

  // ---- .weltest (admin only) ----
  if (command === 'weltest') {
    if (!isAdmin(message.member, cfg)) return denyAccess(message);
    const embed = buildWelcomeEmbed(message.member);
    await message.reply({ embeds: [embed] });
    return;
  }

  // ---- .help / .help admin (admin only) ----
  if (command === 'help') {
    if (!isAdmin(message.member, cfg)) return denyAccess(message);
    const embed = buildHelpEmbed(cfg);
    await message.reply({ embeds: [embed] });
    return;
  }
});

// Prefer an environment variable (set it in Pterodactyl's "Startup" / Variables tab)
// Falls back to config.json if no env var is set
client.login(process.env.TOKEN || startupConfig.token);
