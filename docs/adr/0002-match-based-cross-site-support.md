# Match-Based Cross-Site Support

The first cross-site phase keeps support match-based instead of using a global `https://*/*` userscript match with automatic Discourse detection. The script ships built-in matches for LinuxDO and NodeLoc, lets users add other Discourse forums through their userscript manager, requires a native Discourse sidebar host, and still derives categories and controls from Discourse site data so the LinuxDO static category model can be removed without taking on global activation, in-script enablement, or standalone-host complexity.
