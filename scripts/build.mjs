import {cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(await readFile(resolve(root,'data/titles.json'),'utf8'));
if(data.rows.length!==992)throw new Error('Expected the full 992-entry collection.');
const destination=resolve(root,'dist');await mkdir(destination,{recursive:true});
for(const file of ['index.html','assets','data','downloads'])await cp(resolve(root,file),resolve(destination,file),{recursive:true});
await writeFile(resolve(destination,'.nojekyll'),'');
// A real project-site base path is not known until the repository is pushed.
// Relative links and module-relative data URLs support any Pages subpath.
for(const file of ['index.html','assets/app.mjs','data/titles.json','downloads/gfdm-titles-ja-en-zh.xlsx'])await stat(resolve(destination,file));
console.log(`Built dist/: ${data.rows.length} entries, all site resources local.`);
