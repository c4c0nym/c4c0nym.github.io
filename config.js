// Everything you are likely to change lives in this file.

const CONFIG = {
  name: "c4c0nym",

  // Left-hand picture. Click it on the page to cycle through these; the choice is remembered.
  gifs: ["vapor.gif", "clouds.gif", "waves.gif", "plane.gif", "bike.gif", "cat.gif", "vaporwave.gif", "rest.webp"],

  // Default search. Anything that looks like a URL is opened directly instead.
  search: "https://duckduckgo.com/?q=",

  // Type "<prefix> <text>" in the search box, e.g. "vt 8.8.8.8" or "att T1059".
  // %s is replaced by the (URL-encoded) text.
  shortcuts: {
    g:     { name: "Google",        url: "https://www.google.com/search?q=%s" },
    gh:    { name: "GitHub",        url: "https://github.com/search?q=%s&type=repositories" },
    yt:    { name: "YouTube",       url: "https://www.youtube.com/results?search_query=%s" },
    r:     { name: "Reddit",        url: "https://www.reddit.com/search/?q=%s" },
    vt:    { name: "VirusTotal",    url: "https://www.virustotal.com/gui/search/%s" },
    sh:    { name: "Shodan",        url: "https://www.shodan.io/search?query=%s" },
    abuse: { name: "AbuseIPDB",     url: "https://www.abuseipdb.com/check/%s" },
    gn:    { name: "GreyNoise",     url: "https://viz.greynoise.io/query?gnql=%s" },
    uh:    { name: "URLhaus",       url: "https://urlhaus.abuse.ch/browse.php?search=%s" },
    crt:   { name: "crt.sh",        url: "https://crt.sh/?q=%s" },
    att:   { name: "MITRE ATT&CK",  url: "https://attack.mitre.org/techniques/%s/" },
    cve:   { name: "NVD",           url: "https://nvd.nist.gov/vuln/detail/%s" },
  },

  bookmarks: [
    {
      title: "daily",
      links: [
        ["gmail", "https://mail.google.com"],
        ["proton", "https://mail.proton.me"],
        ["youtube", "https://youtube.com"],
        ["linkedin", "https://linkedin.com"],
        ["reddit", "https://reddit.com"],
      ],
    },
    {
      title: "intel",
      links: [
        ["virustotal", "https://www.virustotal.com"],
        ["shodan", "https://www.shodan.io"],
        ["att&ck", "https://attack.mitre.org"],
        ["cisa kev", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"],
        ["abuse.ch", "https://abuse.ch"],
      ],
    },
    {
      title: "dev",
      links: [
        ["github", "https://github.com/c4c0nym"],
        ["stackoverflow", "https://stackoverflow.com"],
        ["devdocs", "https://devdocs.io"],
        ["regex101", "https://regex101.com"],
        ["cyberchef", "https://gchq.github.io/CyberChef/"],
      ],
    },
    {
      title: "fun",
      links: [
        ["monkeytype", "https://monkeytype.com"],
        ["twitch", "https://twitch.tv"],
        ["netflix", "https://netflix.com"],
        ["r/unixporn", "https://reddit.com/r/unixporn"],
        ["twitter", "https://twitter.com"],
      ],
    },
  ],
};
