import ts from 'typescript';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve('.sites-runtime/integration-check');await mkdir(root,{recursive:true});
for(const file of ['lib/role-notice.ts','lib/email-notifications.ts','lib/food-weights.ts','lib/order.ts','lib/prices.ts','lib/domain.ts','lib/original.ts','lib/service.ts','lib/local.ts','tests/integration.ts']){const target=resolve(root,file.replace(/\.ts$/,'.js'));await mkdir(dirname(target),{recursive:true});const source=await readFile(file,'utf8');let result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}}).outputText;result=result.replace(/(from ['"])(\.\.?\/[^'"]+)(['"])/g,'$1$2.js$3');await writeFile(target,result)}
const test=spawnSync(process.execPath,[resolve(root,'tests/integration.js')],{stdio:'inherit'});await rm(root,{recursive:true,force:true});process.exitCode=test.status??1;
