const {readdirSync,readFileSync}=require("fs");
const ev=readdirSync("src/content/events").map(f=>readFileSync("src/content/events/"+f,"utf8").replace(/\r\n/g,"\n"));
const people=readdirSync("src/content/people");
const map={};
for(const f of ev){
  const t=f.match(/^---\n([\s\S]*?)\n---/); if(!t) continue;
  const fm=t[1];
  const eid=(fm.match(/^id:\s*(\S+)/m)||[])[1];
  const title=(fm.match(/^title:\s*(.+)$/m)||[])[1];
  const srcs=[...fm.matchAll(/^  - ([a-z0-9-]+)$/gm)].map(m=>m[1]);
  const srcBlock=(fm.match(/^sources:\n((?:  - .*\n)+)/m)||[])[1]||"";
  const list=[...srcBlock.matchAll(/- ([a-z0-9-]+)/g)].map(m=>m[1]);
  for(const f2 of people){
    const pid=f2.replace(".md","");
    // people files reference participants by personId
    if(fm.includes("personId: "+pid)){
      map[pid]=map[pid]||{events:[],sources:new Set()};
      map[pid].events.push(eid);
      list.forEach(s=>map[pid].sources.add(s));
    }
  }
}
for(const k of Object.keys(map).sort()){
  console.log(k+" | "+map[k].events.join(",")+" | "+[...map[k].sources].join(","));
}
