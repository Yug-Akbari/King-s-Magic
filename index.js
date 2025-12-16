import { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
});

// Enhanced configuration
const WHITELIST = [
  process.env.OWNER_ID, // Bot owner
  "1314978711254073476", // kingofhell_9
  "764816007470383154", // dracobrantley
]; // Safe users
const actionTracker = new Map();
const guildSettings = new Map(); // Stores settings per guild


// Default thresholds (can be customized per guild)
const DEFAULT_THRESHOLDS = {
  channelDelete: 3,
  roleDelete: 3,
  memberBan: 5,
  memberKick: 7,
  channelCreate: 10,
  roleCreate: 10,
  timeWindow: 30000 // 30 seconds
};

// Enhanced action tracking with timestamps
function recordAction(userId, type, guildId) {
  const key = `${userId}-${guildId}`;
  if (!actionTracker.has(key)) {
    actionTracker.set(key, { actions: {}, timestamps: {} });
  }

  const userTracker = actionTracker.get(key);
  const now = Date.now();

  // Initialize arrays if they don't exist
  if (!userTracker.actions[type]) userTracker.actions[type] = 0;
  if (!userTracker.timestamps[type]) userTracker.timestamps[type] = [];

  // Add current timestamp
  userTracker.timestamps[type].push(now);
  userTracker.actions[type]++;

  // Clean old timestamps (outside time window)
  const settings = guildSettings.get(guildId) || DEFAULT_THRESHOLDS;
  const timeWindow = settings.timeWindow || DEFAULT_THRESHOLDS.timeWindow;

  userTracker.timestamps[type] = userTracker.timestamps[type].filter(
    timestamp => now - timestamp < timeWindow
  );
  userTracker.actions[type] = userTracker.timestamps[type].length;

  actionTracker.set(key, userTracker);
}

// Get current action count for user
function getActionCount(userId, type, guildId) {
  const key = `${userId}-${guildId}`;
  const userTracker = actionTracker.get(key);
  return userTracker?.actions[type] || 0;
}

// Create enhanced embed for logging
function createLogEmbed(action, user, guild, reason, color = 0xff0000) {
  return new EmbedBuilder()
    .setTitle('🚨 Anti-Nuke Alert')
    .setColor(color)
    .addFields(
      { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
      { name: '⚡ Action', value: action, inline: true },
      { name: '🏠 Guild', value: guild.name, inline: true },
      { name: '📝 Reason', value: reason, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'Prayag Anti-Nuke System' });
}

// Enhanced anti-nuke check with multiple punishment levels
async function checkNukeAction(guild, userId, type, targetName = 'Unknown') {
  if (WHITELIST.includes(userId)) return;

  const settings = guildSettings.get(guild.id) || DEFAULT_THRESHOLDS;
  const threshold = settings[type] || DEFAULT_THRESHOLDS[type];
  const actionCount = getActionCount(userId, type, guild.id);

  if (actionCount >= threshold) {
    const member = await guild.members.fetch(userId).catch(() => null);
    const logChannel = settings.logChannelId ? guild.channels.cache.get(settings.logChannelId) : null;

    if (!member) return;

    // Check if bot has higher role than target
    const botMember = guild.members.me;
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      if (logChannel) {
        const embed = createLogEmbed(
          'Permission Denied',
          member.user,
          guild,
          `Cannot punish ${member.user.tag} - they have equal or higher role than bot`,
          0xffa500
        );
        logChannel.send({ embeds: [embed] });
      }
      return;
    }

    try {
      // Progressive punishment system
      let action = 'Unknown';
      let reason = `Anti-nuke: Excessive ${type} (${actionCount}/${threshold})`;

      if (actionCount >= threshold * 2) {
        // Severe: Ban
        await member.ban({ reason, deleteMessageDays: 1 });
        action = 'Banned';
      } else if (actionCount >= threshold * 1.5) {
        // Moderate: Remove all roles and timeout
        await member.roles.set([]);
        await member.timeout(24 * 60 * 60 * 1000, reason); // 24 hour timeout
        action = 'Roles Removed + 24h Timeout';
      } else {
        // Light: Just timeout
        await member.timeout(60 * 60 * 1000, reason); // 1 hour timeout
        action = '1h Timeout';
      }

      if (logChannel) {
        const embed = createLogEmbed(action, member.user, guild, reason);
        embed.addFields(
          { name: '🎯 Target', value: targetName, inline: true },
          { name: '📊 Count', value: `${actionCount}/${threshold}`, inline: true }
        );
        logChannel.send({ embeds: [embed] });
      }

      console.log(`🚨 Anti-nuke triggered: ${member.user.tag} - ${action}`);

    } catch (err) {
      console.error(`Failed to punish ${member.user.tag}:`, err);
      if (logChannel) {
        const embed = createLogEmbed(
          'Punishment Failed',
          member.user,
          guild,
          `Error: ${err.message}`,
          0xffa500
        );
        logChannel.send({ embeds: [embed] });
      }
    }
  } else if (actionCount >= threshold * 0.7) {
    // Warning at 70% of threshold
    const logChannel = settings.logChannelId ? guild.channels.cache.get(settings.logChannelId) : null;
    if (logChannel) {
      const embed = createLogEmbed(
        'Suspicious Activity',
        await client.users.fetch(userId),
        guild,
        `${type} count: ${actionCount}/${threshold} - Monitoring closely`,
        0xffa500
      );
      logChannel.send({ embeds: [embed] });
    }
  }
}

// Monitor channel deletes
client.on("channelDelete", async (channel) => {
  const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
  const entry = audit.entries.first();
  if (!entry || entry.executor.bot) return;

  const executor = entry.executor;
  recordAction(executor.id, "channelDelete", channel.guild.id);
  checkNukeAction(channel.guild, executor.id, "channelDelete", channel.name);
});

// Monitor channel creates (mass channel spam)
client.on("channelCreate", async (channel) => {
  const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
  const entry = audit.entries.first();
  if (!entry || entry.executor.bot) return;

  const executor = entry.executor;
  recordAction(executor.id, "channelCreate", channel.guild.id);
  checkNukeAction(channel.guild, executor.id, "channelCreate", channel.name);
});

// Monitor role deletes
client.on("roleDelete", async (role) => {
  const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
  const entry = audit.entries.first();
  if (!entry || entry.executor.bot) return;

  const executor = entry.executor;
  recordAction(executor.id, "roleDelete", role.guild.id);
  checkNukeAction(role.guild, executor.id, "roleDelete", role.name);
});

// Monitor role creates (mass role spam)
client.on("roleCreate", async (role) => {
  const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
  const entry = audit.entries.first();
  if (!entry || entry.executor.bot) return;

  const executor = entry.executor;
  recordAction(executor.id, "roleCreate", role.guild.id);
  checkNukeAction(role.guild, executor.id, "roleCreate", role.name);
});

// Monitor member bans
client.on("guildBanAdd", async (ban) => {
  const audit = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
  const entry = audit.entries.first();
  if (!entry || entry.executor.bot) return;

  const executor = entry.executor;
  recordAction(executor.id, "memberBan", ban.guild.id);
  checkNukeAction(ban.guild, executor.id, "memberBan", ban.user.tag);
});

// Monitor member kicks
client.on("guildMemberRemove", async (member) => {
  // Wait a bit for audit log to populate
  setTimeout(async () => {
    const audit = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
    const entry = audit.entries.first();

    // Check if this removal was a kick (not a leave)
    if (!entry || entry.executor.bot || entry.target.id !== member.id) return;
    if (Date.now() - entry.createdTimestamp > 5000) return; // Too old

    const executor = entry.executor;
    recordAction(executor.id, "memberKick", member.guild.id);
    checkNukeAction(member.guild, executor.id, "memberKick", member.user.tag);
  }, 1000);
});

// Enhanced command system
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Check admin permissions for most commands
  const isAdmin = message.member.permissions.has("Administrator");
  const isOwner = WHITELIST.includes(message.author.id);

  switch (command) {
    case "setup":
      if (!isAdmin) return message.reply("❌ You need Administrator permissions to use this command.");

      const channelMention = args[0];
      if (!channelMention) {
        const embed = new EmbedBuilder()
          .setTitle("🛠️ Anti-Nuke Setup")
          .setDescription("Setup the anti-nuke system for this server")
          .addFields(
            { name: "Usage", value: "`!setup #channel`", inline: false },
            { name: "Example", value: "`!setup #mod-logs`", inline: false }
          )
          .setColor(0x00ff00);
        return message.reply({ embeds: [embed] });
      }

      const channelId = channelMention.replace(/[<#>]/g, "");
      const channel = message.guild.channels.cache.get(channelId);
      if (!channel) return message.reply("❌ Invalid channel mention.");

      const currentSettings = guildSettings.get(message.guild.id) || { ...DEFAULT_THRESHOLDS };
      currentSettings.logChannelId = channel.id;
      guildSettings.set(message.guild.id, currentSettings);

      const setupEmbed = new EmbedBuilder()
        .setTitle("✅ Anti-Nuke System Configured")
        .setDescription(`Log channel set to ${channel}`)
        .addFields(
          {
            name: "Current Thresholds", value:
              `Channel Delete: ${currentSettings.channelDelete}\n` +
              `Role Delete: ${currentSettings.roleDelete}\n` +
              `Member Ban: ${currentSettings.memberBan}\n` +
              `Member Kick: ${currentSettings.memberKick}\n` +
              `Time Window: ${currentSettings.timeWindow / 1000}s`, inline: true
          },
          {
            name: "Available Commands", value:
              "`!config` - View/modify settings\n" +
              "`!whitelist @user` - Add trusted user\n" +
              "`!status` - View system status", inline: true
          }
        )
        .setColor(0x00ff00);
      message.reply({ embeds: [setupEmbed] });
      break;

    case "config":
      if (!isAdmin) return message.reply("❌ You need Administrator permissions to use this command.");

      if (args.length === 0) {
        // Show current config
        const settings = guildSettings.get(message.guild.id) || DEFAULT_THRESHOLDS;
        const configEmbed = new EmbedBuilder()
          .setTitle("⚙️ Current Configuration")
          .addFields(
            {
              name: "Thresholds", value:
                `Channel Delete: ${settings.channelDelete || DEFAULT_THRESHOLDS.channelDelete}\n` +
                `Role Delete: ${settings.roleDelete || DEFAULT_THRESHOLDS.roleDelete}\n` +
                `Member Ban: ${settings.memberBan || DEFAULT_THRESHOLDS.memberBan}\n` +
                `Member Kick: ${settings.memberKick || DEFAULT_THRESHOLDS.memberKick}\n` +
                `Channel Create: ${settings.channelCreate || DEFAULT_THRESHOLDS.channelCreate}\n` +
                `Role Create: ${settings.roleCreate || DEFAULT_THRESHOLDS.roleCreate}`, inline: true
            },
            {
              name: "Settings", value:
                `Time Window: ${(settings.timeWindow || DEFAULT_THRESHOLDS.timeWindow) / 1000}s\n` +
                `Log Channel: ${settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not set'}`, inline: true
            },
            { name: "Usage", value: "`!config <setting> <value>`\nExample: `!config channelDelete 5`", inline: false }
          )
          .setColor(0x0099ff);
        return message.reply({ embeds: [configEmbed] });
      }

      // Modify config
      const [setting, value] = args;
      const validSettings = ['channelDelete', 'roleDelete', 'memberBan', 'memberKick', 'channelCreate', 'roleCreate', 'timeWindow'];

      if (!validSettings.includes(setting)) {
        return message.reply(`❌ Invalid setting. Valid options: ${validSettings.join(', ')}`);
      }

      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 1) {
        return message.reply("❌ Value must be a positive number.");
      }

      const currentConfig = guildSettings.get(message.guild.id) || { ...DEFAULT_THRESHOLDS };
      currentConfig[setting] = setting === 'timeWindow' ? numValue * 1000 : numValue;
      guildSettings.set(message.guild.id, currentConfig);

      message.reply(`✅ Updated ${setting} to ${numValue}${setting === 'timeWindow' ? ' seconds' : ''}`);
      break;

    case "whitelist":
      if (!isOwner) return message.reply("❌ Only the bot owner can manage the whitelist.");

      const userMention = args[0];
      if (!userMention) return message.reply("❌ Please mention a user: `!whitelist @user`");

      const userId = userMention.replace(/[<@!>]/g, "");
      if (WHITELIST.includes(userId)) {
        return message.reply("❌ User is already whitelisted.");
      }

      WHITELIST.push(userId);
      const user = await client.users.fetch(userId).catch(() => null);
      message.reply(`✅ Added ${user ? user.tag : userId} to whitelist.`);
      break;

    case "status":
      const settings = guildSettings.get(message.guild.id);
      const statusEmbed = new EmbedBuilder()
        .setTitle("📊 Anti-Nuke Status")
        .addFields(
          { name: "System Status", value: settings ? "🟢 Active" : "🔴 Not configured", inline: true },
          { name: "Whitelisted Users", value: WHITELIST.length.toString(), inline: true },
          { name: "Monitored Actions", value: "Channel Delete/Create\nRole Delete/Create\nMember Ban/Kick", inline: true }
        )
        .setColor(settings ? 0x00ff00 : 0xff0000)
        .setFooter({ text: `Prayag Anti-Nuke • Protecting ${client.guilds.cache.size} servers` });

      if (settings?.logChannelId) {
        statusEmbed.addFields({ name: "Log Channel", value: `<#${settings.logChannelId}>`, inline: true });
      }

      message.reply({ embeds: [statusEmbed] });
      break;

    case "help":
      const helpEmbed = new EmbedBuilder()
        .setTitle("🛡️ Prayag Anti-Nuke Commands")
        .setDescription("Advanced Discord server protection system")
        .addFields(
          {
            name: "🛠️ Setup Commands", value:
              "`!setup #channel` - Configure log channel\n" +
              "`!config` - View/modify thresholds\n" +
              "`!config <setting> <value>` - Update setting", inline: false
          },
          {
            name: "👥 Management", value:
              "`!whitelist @user` - Add trusted user (Owner only)\n" +
              "`!status` - View system status", inline: false
          },
          {
            name: "📋 Information", value:
              "`!help` - Show this help menu", inline: false
          },
          {
            name: "🔧 Features", value:
              "• Progressive punishment system\n" +
              "• Configurable thresholds\n" +
              "• Real-time monitoring\n" +
              "• Detailed logging with embeds", inline: false
          }
        )
        .setColor(0x0099ff)
        .setFooter({ text: "Use !setup #channel to get started" });
      message.reply({ embeds: [helpEmbed] });
      break;
  }
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🛡️ Protecting ${client.guilds.cache.size} servers`);
  console.log(`👥 Monitoring ${client.users.cache.size} users`);
  console.log(`📋 Available commands: !help`);

  // Set bot status
  client.user.setActivity(`${client.guilds.cache.size} servers | !help`, { type: 'WATCHING' });
});

client.login(process.env.DISCORD_TOKEN);
