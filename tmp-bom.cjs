const fs=require("fs");
const p="src/content/sources/sanguozhi-liushan-ping.yaml";
let t=fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"");
fs.writeFileSync(p,t,"utf8");
console.log("BOM stripped, first bytes:",Buffer.from(t.slice(0,4)).toString("hex"));
