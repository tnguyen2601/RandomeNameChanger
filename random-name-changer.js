const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const config = {
    token: process.env.BOT_TOKEN,
    serverId: process.env.GUILD_ID,
    userId: process.env.USER_ID,
    intervalMinutes: parseInt(process.env.INTERVAL_MINUTES) || 60,
    nicknames: process.env.NICKNAMES
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
        // Removed GuildMembers intent to avoid privileged intent requirement
    ]
});

let nicknameInterval = null;
let countdownInterval = null;
let nextChangeTime = null;

function formatTimeRemaining(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function startCountdown() {
    // Clear any existing countdown
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    nextChangeTime = Date.now() + (config.intervalMinutes * 60 * 1000);
    
    countdownInterval = setInterval(() => {
        const timeRemaining = nextChangeTime - Date.now();
        
        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            return;
        }
        process.stdout.write('\r⏰ Next nickname change in: ' + formatTimeRemaining(timeRemaining));
    }, 1000);
}
function getRandomNickname() {
    const randomIndex = Math.floor(Math.random() * config.nicknames.length);
    return config.nicknames[randomIndex];
}

async function changeNickname() {
    try {
        const guild = client.guilds.cache.get(config.serverId);
        if (!guild) {
            console.error('Guild not found');
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(config.userId);
        } catch (fetchError) {
            try {
                const response = await client.rest.patch(
                    `/guilds/${config.serverId}/members/${config.userId}`,
                    { body: { nick: getRandomNickname() } }
                );
                console.log(`✅ Changed to: "${getRandomNickname()}"`);
                console.log('');
                startCountdown();
                return;
            } catch (restError) {
                console.error('Cannot access member');
                return;
            }
        }

        const newNickname = getRandomNickname();
        await member.setNickname(newNickname);
        
        console.log(`✅ Changed to: "${newNickname}"`);
        console.log('');
        startCountdown();
        
    } catch (error) {
        console.error('Error:', error.message);
        
        if (error.code === 50013) {
            console.error('Permission/hierarchy issue');
        } else if (error.code === 50035) {
            console.error('Invalid nickname');
        }
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🚀 Bot ready: ${client.user.tag}`);
    console.log(`⏱️ Interval: ${config.intervalMinutes}min`);
    console.log(`📝 Nicknames: ${config.nicknames.length}`);
    
    const guild = client.guilds.cache.get(config.serverId);
    if (!guild) {
        console.error('Setup error: Cannot access server');
        return;
    }
    
    const member = await guild.members.fetch(config.userId).catch(() => null);
    if (!member) {
        console.error('Setup error: Cannot find user');
        return;
    }
    
    console.log('✅ Setup verified');
    await changeNickname();
    nicknameInterval = setInterval(changeNickname, config.intervalMinutes * 60 * 1000);
});

// Error event handling
client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    if (nicknameInterval) {
        clearInterval(nicknameInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    if (nicknameInterval) {
        clearInterval(nicknameInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    client.destroy();
    process.exit(0);
});

// Login to Discord
console.log('🔑 Logging in...');
client.login(config.token).catch(error => {
    console.error('Failed to login:', error.message);
    if (error.message.includes('TOKEN_INVALID')) {
        console.error('Invalid bot token');
    }
    process.exit(1);
});