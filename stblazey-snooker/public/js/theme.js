// Round 102 (Rich): the website is always light. One look means the colours chosen under Admin → Branding never have
// to be worked out twice. (The design system's dark values are kept in tokens.css but nothing switches to them.)
document.documentElement.dataset.theme = "light";
try { localStorage.removeItem("sb-theme"); } catch (e) { /* fine */ }
