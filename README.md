# 🛡️ Prayag Anti-Nuke Bot

Advanced Discord server protection system that prevents server nuking attacks with real-time monitoring and progressive punishment.

## ✨ Features

- **Real-time Monitoring** - Tracks channel/role deletions, mass bans, and spam creation
- **Progressive Punishment** - Escalating consequences from timeout to permanent ban
- **Smart Detection** - Configurable thresholds and time windows
- **Whitelist System** - Protect trusted users from anti-nuke actions
- **Rich Logging** - Detailed embed logs with user info and timestamps
- **Permission Aware** - Respects role hierarchy and bot permissions

## 🚀 Quick Start

### Prerequisites
- Node.js 16.9.0 or higher
- Discord Bot Token
- Discord Application with Message Content Intent enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd prayag-anti-nuke-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your bot token:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   OWNER_ID=your_discord_user_id
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## 🛠️ Setup Commands

### Initial Setup
```
!setup #log-channel    # Configure where alerts are sent
!help                  # View all available commands
!status               # Check system status
```

### Configuration
```
!config                           # View current settings
!config channelDelete 5          # Set channel deletion threshold
!config timeWindow 60            # Set time window to 60 seconds
```

### Management
```
!whitelist @user      # Add trusted user (Owner only)
!status              # View system status and settings
```

## 🔧 Default Thresholds

| Action | Threshold | Time Window |
|--------|-----------|-------------|
| Channel Delete | 3 | 30 seconds |
| Role Delete | 3 | 30 seconds |
| Member Ban | 5 | 30 seconds |
| Member Kick | 7 | 30 seconds |
| Channel Create | 10 | 30 seconds |
| Role Create | 10 | 30 seconds |

## ⚡ Punishment Levels

### Level 1: Light (First offense)
- **1-hour timeout**
- User cannot send messages or join voice

### Level 2: Moderate (1.5x threshold)
- **Remove all roles**
- **24-hour timeout**

### Level 3: Severe (2x threshold)
- **Permanent ban**
- **Delete messages from last 24 hours**

## 🛡️ Protection Examples

### Channel Nuke Prevention
```
❌ User deletes #general
❌ User deletes #announcements  
❌ User deletes #memes
🚨 TRIGGERED: 3 deletions in 30 seconds
⚡ ACTION: 1-hour timeout
```

### Mass Ban Prevention
```
❌ Malicious admin bans 5 members rapidly
🚨 TRIGGERED: 5 bans in 30 seconds
⚡ ACTION: Remove roles + 24h timeout
```

## 📋 Required Bot Permissions

- **Read Messages**
- **Send Messages**
- **Embed Links**
- **View Audit Log**
- **Manage Roles**
- **Ban Members**
- **Moderate Members** (for timeouts)

## 🔒 Security Features

- **Whitelist Protection** - Immune users bypass all checks
- **Role Hierarchy** - Won't punish users with higher roles
- **Bot Filtering** - Ignores actions by other bots
- **Permission Checking** - Validates bot permissions before punishment

## 📊 Monitoring

The bot provides detailed logging with:
- User information and IDs
- Action timestamps
- Threshold counts
- Target information
- Punishment details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This bot is designed for server protection. Use responsibly and ensure proper permissions are configured. The developers are not responsible for any misuse or damage caused by this bot.

## 🆘 Support

If you encounter issues:
1. Check the bot has proper permissions
2. Verify Message Content Intent is enabled
3. Ensure the bot role is positioned correctly
4. Review the setup commands

---

**Made with ❤️ for Discord server security**