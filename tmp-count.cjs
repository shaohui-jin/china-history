const {readdirSync,readFileSync}=require("fs");
const rows=[];
for(const f of readdirSync("src/content/people")){
  const t=readFileSync("src/content/people/"+f,"utf8").replace(/\r\n/g,"\n");
  const m=t.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body=m?m[1].trim():"";
  const c=body.replace(/\[\^[a-z0-9-]+(?:\|[^\]]+)?\]/g,"").replace(/\[\[[a-z]+:([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,(_,i,l)=>l||i).replace(/^#{1,6}\s+/gm,"").replace(/[*_`>]/g,"").replace(/\s/g,"").length;
  rows.push([f.replace(".md",""),c]);
}
rows.sort((a,b)=>a[1]-b[1]);
for(const [id,c] of rows) console.log(String(c).padStart(5),id);
