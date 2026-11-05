import { Client } from '../scripts/deploy/node_modules/ssh2/lib/index.js'
import fs from 'node:fs'
const env = {}
for (const line of fs.readFileSync('scripts/deploy/.env','utf8').split(/\r?\n/)) {
 const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
 if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
}
const command = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n')
const conn = new Client()
conn.on('ready',()=>conn.exec(command,(err,stream)=>{
 if(err){console.error(err.message);conn.end();process.exitCode=1;return}
 stream.on('data',data=>process.stdout.write(data));stream.stderr.on('data',data=>process.stderr.write(data));
 stream.on('close',code=>{process.exitCode=code;conn.end()})
})).on('error',error=>{console.error(error.message);process.exitCode=1}).connect({host:env.DEPLOY_HOST,port:Number(env.DEPLOY_PORT||22),username:env.DEPLOY_USER||'root',password:env.DEPLOY_PASSWORD,readyTimeout:30000})
