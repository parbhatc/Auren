import { build } from 'esbuild'
import http from 'node:http'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Isolated UI fixture. No provider connection or account/order APIs are imported.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const built = await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalTradeLayout } from './src/components/trading/Trading/tradingRenderer/TerminalTradeLayout';
import { MobileAutoModeBar } from './src/components/trading/shared/mobile/MobileAutoModeBar';
import { requestChartAutoTrade } from './src/components/common/aurenTradeContextMenu';
localStorage.setItem('auren.tradeRiskSettings.v1', JSON.stringify({riskPerTrade:100,riskBuffer:0,sizingBasis:'stop_loss',stopLossMode:'soft'}));
function Fixture() {
  const [,forceUpdate] = useState(0);
  const [sheet,setSheet] = useState(false);
  const [online,setOnline] = useState(true);
  const [quantity,setQuantity] = useState('1');
  const [armed,setArmed] = useState(false);
  const [orders,setOrders] = useState([]);
  const [preview,setPreview] = useState('');
  const pick = useRef(null);
  const appearance = useRef(null);
  const context = {paneIndex:0,symbol:'NQ',resolution:'30S'};
  const select = price => { if (appearance.current) setPreview(appearance.current(price,context).label); pick.current?.(price,context) };
  const props = {isDark:true,mode:'practice',marketDataLive:online,markPrice:28790,tickSize:.25,tickValue:.5,chartSymbol:"CME:MNQ",accountId:'isolated',quantity,
    chartProductRoot:'NQ',tradeProductRoot:'MNQ',riskExecutionProductRoot:'MNQ',autoRiskContractRouting:true,
    getMaxQuantityForSymbol:()=>20,getActiveChartResolution:()=> '30S',
    onQuantityInputChange:setQuantity,onQuantityUpdate:n=>setQuantity(String(n)),onQuantityChange:()=>{},onQuantityBlur:()=>{},
    onBuy:()=>{throw Error('Unexpected direct buy')},onSell:()=>{throw Error('Unexpected direct sell')},
    onClose:()=>{},onReverse:()=>{},onFlatten:()=>{},
    getAutoOrderSizingContext:()=>({entry:28790,executionSymbol:'MNQ',tickSize:.25,tickValue:.5,maxQuantity:20}),
    pickChartPriceOnce:callback=>{pick.current=callback;setArmed(true);return ()=>{pick.current=null;setArmed(false)}},
    showAutoPositionPreview:options=>{appearance.current=options.appearanceAt;return ()=>{appearance.current=null}},
    onSubmitOrder:(side,brackets,order)=>setOrders(values=>[...values,{side,quantity,brackets,order}]),
  };
  return <><h1>Isolated Auto entry test</h1><p>No real accounts or trading APIs.</p>
    <p data-testid="armed">Armed: {String(armed)}</p><p data-testid="orders">Orders: {orders.length}</p>
    <pre data-testid="order-data">{JSON.stringify(orders)}</pre><p data-testid="preview">{preview}</p>
    <button onClick={()=>select(28700.5)}>Choose oversized stop</button>
    <button onClick={()=>select(28780)}>Choose valid long stop</button>
    <button onClick={()=>select(28800)}>Choose valid short stop</button>
    <button onClick={()=>setSheet(true)}>Open order sheet</button><button onClick={()=>setOnline(v=>!v)}>Toggle connection</button>
    <div style={{height:520,display:'flex',flexDirection:'column'}}><TerminalTradeLayout padSessionId="isolated" padProps={props} practiceMaxQty={20} isDark showMobileNav={false}
      mobileOrderOpen={sheet} onCloseMobileOrder={()=>setSheet(false)} mobileSettingsOpen={false} onCloseMobileSettings={()=>{}} onForceUpdate={()=>forceUpdate(n=>n+1)}
      chartElement={<div style={{flex:1,minHeight:0,display:'grid',placeItems:'center',border:'1px solid #27272a',color:'#71717a'}}>Isolated chart area</div>}/></div></>;

}
createRoot(document.getElementById('root')).render(<Fixture />);
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' } })
const assets = await fs.readdir(new URL('../../../dist/assets/', import.meta.url))
const cssFile = assets.find(name => /^index-.*\.css$/.test(name))
const css = cssFile ? await fs.readFile(new URL(`../../../dist/assets/${cssFile}`, import.meta.url), 'utf8') : ''
const server = http.createServer((req,res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type','text/javascript'); res.end(built.outputFiles[0].text); return }
  res.setHeader('Content-Type','text/html'); res.end('<html class="dark"><head><style>'+css+'body{padding:20px;background:#09090b;color:white}body>button,button{cursor:pointer}#root>button{border:1px solid #444;padding:8px;margin:5px}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
})
server.listen(4188,'127.0.0.1',()=>console.log('Isolated mobile Auto fixture ready: http://127.0.0.1:4188'))
