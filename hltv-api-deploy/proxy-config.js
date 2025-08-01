// Proxy configuration for bypassing HLTV ban in Turkey
// These are free proxy servers - for production, use paid proxies

const PROXY_LIST = [
  // Free proxy servers (may not work reliably)
  // Add your own proxy servers here
  // Format: 'http://ip:port' or 'http://username:password@ip:port'
  
  // Example proxies (replace with working ones):
  // 'http://185.199.229.156:7492',
  // 'http://185.199.228.220:7492',
  // 'http://185.199.231.45:7492',
  
  // You can find free proxies from:
  // - https://free-proxy-list.net/
  // - https://www.proxynova.com/
  // - https://www.proxy-list.download/
];

// VPN/Proxy services that work well in Turkey:
const RECOMMENDED_SERVICES = [
  {
    name: "NordVPN",
    description: "Fast and reliable VPN service",
    website: "https://nordvpn.com"
  },
  {
    name: "ExpressVPN", 
    description: "Premium VPN with good speeds",
    website: "https://expressvpn.com"
  },
  {
    name: "Surfshark",
    description: "Affordable VPN option",
    website: "https://surfshark.com"
  },
  {
    name: "ProtonVPN",
    description: "Free VPN with limited bandwidth",
    website: "https://protonvpn.com"
  }
];

// Alternative data sources (if HLTV is blocked):
const ALTERNATIVE_SOURCES = [
  {
    name: "Liquipedia",
    url: "https://liquipedia.net/counterstrike/",
    description: "CS:GO tournament and match information"
  },
  {
    name: "ESL",
    url: "https://www.eslgaming.com/",
    description: "ESL tournament schedules and results"
  },
  {
    name: "HLTV Mirror",
    url: "https://hltv.org (via VPN)",
    description: "Original HLTV via VPN"
  }
];

module.exports = {
  PROXY_LIST,
  RECOMMENDED_SERVICES,
  ALTERNATIVE_SOURCES
}; 