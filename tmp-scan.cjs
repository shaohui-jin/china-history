const fs=require("fs");
const path=require("path");
function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const s=fs.statSync(p);if(s.isDirectory())walk(p);else{const b=fs.readFileSync(p);if(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF)console.log("BOM:",p);}}}
walk("src/content");walk("scripts");walk("docs");
console.log("done");
