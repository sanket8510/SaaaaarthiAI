
/* ===== CONSTANTS ===== */
const API='http://127.0.0.1:2024',AID='deep_researcher';
// Load history from localStorage on startup
let hist=[],totalW=0,busy=false;
try{
  const saved=localStorage.getItem('saarthi-history');
  if(saved){hist=JSON.parse(saved);totalW=hist.reduce((s,h)=>s+(h.words||0),0);}
}catch(e){hist=[];}

/* ===== NAVIGATION ===== */
const PAGES={
  home:{icon:'🏠',title:'Home',sub:'Welcome to Saarthi AI'},
  research:{icon:'🔍',title:'Research',sub:'Ask a question, get a full report'},
  history:{icon:'📚',title:'History',sub:'Reports from this session'},
  about:{icon:'ℹ️',title:'About Saarthi AI',sub:'Technology stack & FAQ'},
  settings:{icon:'⚙️',title:'Settings',sub:'Configure models and preferences'},
};
function nav(p){
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(e=>e.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.ni').forEach(e=>{if(e.textContent.trim().toLowerCase().startsWith(p))e.classList.add('active');});
  document.getElementById('tb-icon').textContent=PAGES[p].icon;
  document.getElementById('tb-title').textContent=PAGES[p].title;
  document.getElementById('tb-sub').textContent=PAGES[p].sub;
  const ta=document.querySelector('.tb-actions');
  if(p==='research')ta.innerHTML='<button class="btn btn-gh" onclick="clearChat()" style="font-size:.78rem">🗑 Clear Chat</button>';
  else ta.innerHTML='<button class="btn btn-p" onclick="nav(\'research\')">🔍 New Research</button>';
  if(p==='history')renderHist();
}

/* ===== THEME ===== */
function setTheme(t){document.documentElement.setAttribute('data-theme',t);document.getElementById('tchk').checked=(t==='light');localStorage.setItem('saarthi-theme',t);}
setTheme(localStorage.getItem('saarthi-theme')||'dark');

// Init badge + stats from loaded history
setTimeout(()=>{updateBadge();updateStats();},0);

/* ===== SERVER STATUS ===== */
async function chkSrv(){
  const dot=document.getElementById('dot'),st=document.getElementById('stxt');
  try{const r=await fetch(`${API}/ok`,{signal:AbortSignal.timeout(3000)});dot.className='dot'+(r.ok?'':' red');st.textContent=r.ok?'Connected':'Server error';}
  catch{dot.className='dot red';st.textContent='Offline';}
}
chkSrv();setInterval(chkSrv,12000);

/* ===== TOAST ===== */
function toast(m='✓ Done!'){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

/* ===== TEXTAREA ===== */
document.getElementById('qinp').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,130)+'px';});
document.getElementById('qinp').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQ();}});

/* ===== HELPERS ===== */
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function ts(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function wc(t){return t.trim().split(/\s+/).filter(Boolean).length;}
function copyT(txt,btn){navigator.clipboard.writeText(txt).then(()=>{toast('📋 Copied!');if(btn){const o=btn.innerHTML;btn.classList.add('copied');btn.innerHTML='✓ Copied';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML=o;},2000);}});}
function dlMd(txt,title){const sl=(title||'report').slice(0,40).replace(/\s+/g,'-').replace(/[^a-z0-9-]/gi,'');const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([txt],{type:'text/markdown'})),download:`${sl||'saarthi-report'}.md`});a.click();URL.revokeObjectURL(a.href);toast('⬇ Downloaded!');}

/* ===== MARKDOWN RENDERER (HTML) ===== */
function renderMd(raw){
  if(!raw)return'';
  let h=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>`<pre><code>${c.trim()}</code></pre>`)
    .replace(/^#### (.+)$/gm,'<h4>$1</h4>').replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^---+$/gm,'<hr>')
    .replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g,(_,hr,body)=>{
      const ths=hr.split('|').filter(c=>c.trim()).map(c=>`<th>${c.trim()}</th>`).join('');
      const trs=body.trim().split('\n').map(r=>`<tr>${r.split('|').filter(c=>c.trim()).map(c=>`<td>${c.trim()}</td>`).join('')}</tr>`).join('');
      return`<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    })
    .replace(/((?:^[-*] .+\n?)+)/gm,m=>`<ul>${m.trim().split('\n').map(l=>`<li>${l.replace(/^[-*] /,'')}</li>`).join('')}</ul>`)
    .replace(/((?:^\d+\. .+\n?)+)/gm,m=>`<ol>${m.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\. /,'')}</li>`).join('')}</ol>`)
    .replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>');
  return`<p>${h}</p>`;
}

/* ===== PDF GENERATOR ===== */
async function generatePDF(rawText,title,question){
  if(!window.jspdf){toast('⚠ jsPDF not loaded yet. Try again.');return;}
  toast('⏳ Generating PDF…');
  await new Promise(r=>setTimeout(r,100));
  try{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=210,PH=297,M=20,CW=PW-M*2;
    // Color palette
    const P=[108,99,255],P2=[67,56,202],T=[6,182,212],O=[249,115,22],
          W=[255,255,255],DK=[30,30,50],G=[100,100,140],
          LG=[248,248,255],MG=[210,210,230],BG=[240,240,255];

    /* ============ COVER PAGE ============ */
    for(let i=0;i<=PH;i++){
      const r=Math.round(P[0]+(T[0]-P[0])*i/PH);
      const g=Math.round(P[1]+(T[1]-P[1])*i/PH);
      const b=Math.round(P[2]+(T[2]-P[2])*i/PH);
      doc.setFillColor(r,g,b);doc.rect(0,i,PW,1.5,'F');
    }
    doc.setDrawColor(255,255,255);doc.setLineWidth(0.4);
    doc.circle(185,38,55,'S');doc.circle(28,265,65,'S');doc.circle(PW/2,PH/2,90,'S');
    // Logo
    doc.setFillColor(...W);doc.circle(PW/2,65,24,'F');
    doc.setFontSize(22);doc.setFont('helvetica','bold');doc.setTextColor(...P);
    doc.text('SA',PW/2,72,{align:'center'});
    // Brand
    doc.setFontSize(32);doc.setFont('helvetica','bold');doc.setTextColor(...W);
    doc.text('SAARTHI AI',PW/2,103,{align:'center'});
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(215,215,255);
    doc.text('Autonomous Multi-Agent Research & Report Generation System',PW/2,113,{align:'center'});
    doc.setDrawColor(...W);doc.setLineWidth(0.5);doc.line(M+25,121,PW-M-25,121);
    // Report title box
    const tLines=doc.splitTextToSize(title||'Research Report',CW-20);
    const tBoxH=tLines.length*10+14;
    doc.setFillColor(255,255,255);doc.setDrawColor(255,255,255);
    // white translucent box — draw manually with opacity trick via light color
    doc.setFillColor(130,120,255);
    doc.roundedRect(M+4,127,CW-8,tBoxH,4,4,'F');
    doc.setFontSize(15);doc.setFont('helvetica','bold');doc.setTextColor(...W);
    tLines.forEach((l,i)=>doc.text(l,PW/2,141+i*10,{align:'center'}));
    // Question subtitle
    if(question){
      const qY=129+tBoxH+6;
      doc.setFontSize(10);doc.setFont('helvetica','italic');doc.setTextColor(200,225,255);
      const qLines=doc.splitTextToSize(`"${question}"`,CW-16);
      qLines.forEach((l,i)=>doc.text(l,PW/2,qY+i*6,{align:'center'}));
    }
    // Meta footer text
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(190,200,240);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`,PW/2,PH-30,{align:'center'});
    doc.text('Powered by Groq LLM  •  Tavily Web Search  •  LangGraph Agents',PW/2,PH-23,{align:'center'});
    // Footer bar
    doc.setFillColor(...O);doc.rect(0,PH-14,PW,14,'F');
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(...W);
    doc.text('SAARTHI AI  •  Autonomous Research System',PW/2,PH-6,{align:'center'});

    /* ============ CONTENT PAGES ============ */
    const lines=rawText.split('\n');
    const BODY_FONT=10.5;   // comfortable reading size
    const BODY_LH=6.5;      // line height for body
    const HEAD1_FONT=15;
    const HEAD2_FONT=12.5;
    const HEAD3_FONT=11;
    const HEAD4_FONT=10;
    const HEADER_H=14;
    const FOOTER_H=11;
    const TOP_PAD=22;       // y after header
    const BOT_LIMIT=PH-FOOTER_H-4;

    let y=0,pg=0;

    const addPage=()=>{
      doc.addPage();pg++;
      // Purple gradient header
      doc.setFillColor(...P2);doc.rect(0,0,PW,HEADER_H,'F');
      doc.setFillColor(...P);doc.rect(0,0,PW*0.55,HEADER_H,'F');
      // Accent stripe
      doc.setFillColor(...T);doc.rect(0,HEADER_H,PW,1.2,'F');
      doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(...W);
      doc.text('SAARTHI AI  •  Research Report',M,HEADER_H-4);
      doc.text(`Page ${pg}`,PW-M,HEADER_H-4,{align:'right'});
      // Orange footer
      doc.setFillColor(...O);doc.rect(0,PH-FOOTER_H,PW,FOOTER_H,'F');
      doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.setTextColor(...W);
      doc.text('Saarthi AI — Autonomous Multi-Agent Research System',PW/2,PH-4,{align:'center'});
      y=TOP_PAD;
    };
    addPage();

    const chkY=(need)=>{if(y+need>BOT_LIMIT)addPage();};
    const stripMd=(s)=>s
      .replace(/\*\*(.*?)\*\*/g,'$1')
      .replace(/\*(.*?)\*/g,'$1')
      .replace(/`([^`]+)`/g,'$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
      .replace(/^#+\s*/,'')
      .trim();

    // Always start content with correct font
    doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);

    let i=0;
    while(i<lines.length){
      const line=lines[i];

      /* ── TABLE ── */
      if(line.trim().startsWith('|')&&i+1<lines.length&&/^\|[-| :]+\|/.test(lines[i+1].trim())){
        const headCells=line.split('|').filter(c=>c.trim()).map(c=>stripMd(c.trim()));
        i+=2;
        const bodyRows=[];
        while(i<lines.length&&lines[i].trim().startsWith('|')){
          bodyRows.push(lines[i].split('|').filter(c=>c.trim()).map(c=>stripMd(c.trim())));
          i++;
        }
        chkY(14+bodyRows.length*9);
        doc.autoTable({
          startY:y,
          head:[headCells],
          body:bodyRows,
          margin:{left:M,right:M},
          theme:'grid',
          styles:{
            fontSize:9,
            font:'helvetica',
            cellPadding:{top:3.5,bottom:3.5,left:5,right:5},
            overflow:'linebreak',
            textColor:DK,
            lineColor:MG,
            lineWidth:0.25
          },
          headStyles:{fillColor:P,textColor:W,fontStyle:'bold',fontSize:9.5,cellPadding:{top:4.5,bottom:4.5,left:5,right:5}},
          alternateRowStyles:{fillColor:BG},
          columnStyles:{0:{fontStyle:'bold'}},
        });
        // IMPORTANT: reset font after autoTable (it changes font state)
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        y=doc.lastAutoTable.finalY+9;
        continue;
      }

      /* ── H1 ── */
      if(/^# /.test(line)){
        const txt=stripMd(line);
        doc.setFontSize(HEAD1_FONT);doc.setFont('helvetica','bold');
        const h1Lines=doc.splitTextToSize(txt,CW-6);
        const h1H=h1Lines.length*9+10;
        chkY(h1H+8);
        y+=5;
        doc.setFillColor(...BG);doc.rect(M-2,y-6,CW+4,h1H,'F');
        doc.setFillColor(...P);doc.rect(M-2,y-6,3.5,h1H,'F');
        doc.setTextColor(...P);
        h1Lines.forEach(l=>{doc.text(l,M+5,y);y+=9;});
        doc.setDrawColor(...O);doc.setLineWidth(1);doc.line(M-2,y,M+CW+2,y);
        y+=7;
        // reset
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── H2 ── */
      if(/^## /.test(line)){
        const txt=stripMd(line);
        doc.setFontSize(HEAD2_FONT);doc.setFont('helvetica','bold');doc.setTextColor(...T);
        const h2Lines=doc.splitTextToSize(txt,CW);
        chkY(h2Lines.length*8+12);
        y+=6;
        h2Lines.forEach(l=>{doc.text(l,M,y);y+=8;});
        doc.setDrawColor(...T);doc.setLineWidth(0.5);doc.line(M,y,M+55,y);
        y+=5;
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── H3 ── */
      if(/^### /.test(line)){
        const txt=stripMd(line);
        doc.setFontSize(HEAD3_FONT);doc.setFont('helvetica','bold');doc.setTextColor(...O);
        const h3Lines=doc.splitTextToSize(txt,CW);
        chkY(h3Lines.length*7+8);
        y+=4;
        h3Lines.forEach(l=>{doc.text(l,M,y);y+=7;});
        y+=3;
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── H4 ── */
      if(/^#### /.test(line)){
        const txt=stripMd(line);
        doc.setFontSize(HEAD4_FONT);doc.setFont('helvetica','bold');doc.setTextColor(...G);
        const h4Lines=doc.splitTextToSize(txt,CW);
        chkY(h4Lines.length*6+6);
        y+=2;
        h4Lines.forEach(l=>{doc.text(l,M,y);y+=6;});
        y+=2;
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── HR ── */
      if(/^---+$/.test(line.trim())){
        chkY(8);y+=4;
        doc.setDrawColor(...MG);doc.setLineWidth(0.25);doc.line(M,y,PW-M,y);
        y+=5;i++;continue;
      }

      /* ── BLOCKQUOTE ── */
      if(/^>/.test(line.trim())){
        const txt=stripMd(line.replace(/^>\s*/,''));
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','italic');
        const bqLines=doc.splitTextToSize(txt,CW-10);
        const bqH=bqLines.length*BODY_LH+8;
        chkY(bqH+2);
        doc.setFillColor(...BG);doc.rect(M,y-4,CW,bqH,'F');
        doc.setFillColor(...P);doc.rect(M,y-4,3.5,bqH,'F');
        doc.setTextColor(...G);
        bqLines.forEach(l=>{doc.text(l,M+7,y);y+=BODY_LH;});
        y+=6;
        doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── BULLET LIST ── */
      if(/^[-*+]\s/.test(line.trim())){
        const txt=stripMd(line.trim().replace(/^[-*+]\s+/,''));
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        const bLines=doc.splitTextToSize(txt,CW-9);
        const bH=bLines.length*BODY_LH+2;
        chkY(bH+1);
        doc.setFillColor(...O);doc.circle(M+2.5,y-1.5,1.5,'F');
        bLines.forEach(l=>{
          chkY(BODY_LH);
          doc.text(l,M+7,y);
          y+=BODY_LH;
        });
        y+=2;i++;continue;
      }

      /* ── NUMBERED LIST ── */
      if(/^\d+\.\s/.test(line.trim())){
        const m=line.trim().match(/^(\d+)\.\s+(.*)/);
        if(m){
          doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
          const nLines=doc.splitTextToSize(stripMd(m[2]),CW-11);
          const nH=nLines.length*BODY_LH+2;
          chkY(nH+1);
          // number badge
          doc.setFillColor(...P);doc.circle(M+3.5,y-2,3.5,'F');
          doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(...W);
          doc.text(m[1],M+3.5,y-0.5,{align:'center'});
          // text
          doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
          nLines.forEach(l=>{
            chkY(BODY_LH);
            doc.text(l,M+10,y);
            y+=BODY_LH;
          });
          y+=2;
        }
        i++;continue;
      }

      /* ── EMPTY LINE ── */
      if(line.trim()===''){y=Math.min(y+3,BOT_LIMIT-2);i++;continue;}

      /* ── CODE BLOCK (``` fences) ── */
      if(line.trim().startsWith('```')){
        i++;
        const codeLines=[];
        while(i<lines.length&&!lines[i].trim().startsWith('```')){codeLines.push(lines[i]);i++;}
        if(codeLines.length){
          // Set courier font first for correct split metrics
          doc.setFontSize(8.5);doc.setFont('courier','normal');
          const cH=codeLines.length*(BODY_LH-0.5)+10;
          chkY(cH);
          doc.setFillColor(28,28,45);doc.rect(M,y-3,CW,cH,'F');
          doc.setTextColor(180,255,180);
          codeLines.forEach(cl=>{
            const cWrapped=doc.splitTextToSize(cl||' ',CW-8);
            cWrapped.forEach(cw=>{chkY(BODY_LH);doc.text(cw,M+4,y);y+=BODY_LH-0.5;});
          });
          y+=5;
        }
        // CRITICAL: always reset font after code block
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        i++;continue;
      }

      /* ── PARAGRAPH ── */
      const txt=stripMd(line);
      if(txt){
        // Set font FIRST, then split — ensures correct line-break metrics
        doc.setFontSize(BODY_FONT);doc.setFont('helvetica','normal');doc.setTextColor(...DK);
        const pLines=doc.splitTextToSize(txt,CW);
        chkY(pLines.length*BODY_LH+3);
        pLines.forEach(l=>{chkY(BODY_LH);doc.text(l,M,y);y+=BODY_LH;});
        y+=3;
      }
      i++;
    }

    const slug=(title||'report').slice(0,40).replace(/\s+/g,'-').replace(/[^a-z0-9-]/gi,'').toLowerCase();
    doc.save(`saarthi-ai-${slug||'report'}.pdf`);
    toast('📄 PDF downloaded!');
  }catch(e){console.error(e);toast('⚠ PDF error: '+e.message);}
}

/* ===== PROGRESS ===== */
const STEPS=[{id:'plan',l:'Planning research strategy…'},{id:'srch',l:'Searching web with Tavily…'},{id:'read',l:'Reading & summarising sources…'},{id:'comp',l:'Compressing research notes…'},{id:'writ',l:'Writing final report…'}];
function mkProg(){
  const wrap=document.createElement('div');wrap.className='prog';let cur=0;
  STEPS.forEach((s,i)=>{const d=document.createElement('div');d.className='ps'+(i===0?' ac':'');d.id='ps-'+s.id;d.innerHTML=`<span style="width:16px;display:inline-block;text-align:center">${i===0?'<div class="sp"></div>':'○'}</span> ${s.l}`;wrap.appendChild(d);});
  function adv(){if(cur<STEPS.length-1){const c=wrap.querySelector('#ps-'+STEPS[cur].id);c.className='ps dn';c.querySelector('span').innerHTML='✓';cur++;const n=wrap.querySelector('#ps-'+STEPS[cur].id);n.className='ps ac';n.querySelector('span').innerHTML='<div class="sp"></div>';}}
  function fin(){wrap.querySelectorAll('.ps').forEach(e=>{e.className='ps dn';e.querySelector('span').innerHTML='✓';});}
  return{el:wrap,adv,fin};
}

/* ===== EXTRACT REPORT ===== */
function extractRep(state){
  if(!state)return'';
  // The graph returns the final answer in final_report. Depending on the
  // LangGraph stream mode/version, it may also be present in values or messages.
  for(const value of [state.final_report,state.values?.final_report,state.data?.final_report]){
    if(typeof value==='string'&&value.trim().length>0)return value.trim();
  }
  const messages=Array.isArray(state)?state:(state.messages||state.values?.messages||state.data?.messages);
  if(!Array.isArray(messages))return'';
  for(let i=messages.length-1;i>=0;i--){
    const m=messages[i];const role=m.role||m.type;
    if(role==='assistant'||role==='ai'){
      if(typeof m.content==='string'&&m.content.length>80)return m.content;
      if(Array.isArray(m.content)){const t=m.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');if(t.length>80)return t;}
    }
  }
  return'';
}

/* ===== SEND QUESTION ===== */
async function sendQ(){
  const q=document.getElementById('qinp').value.trim();
  if(!q||busy)return;
  busy=true;
  document.getElementById('qinp').value='';document.getElementById('qinp').style.height='auto';
  const sbtn=document.getElementById('sbtn');
  sbtn.disabled=true;sbtn.innerHTML='<div class="sp" style="border-color:#555;border-top-color:#fff;width:12px;height:12px"></div> Researching…';
  const chat=document.getElementById('chat');
  // User bubble
  const ub=document.createElement('div');ub.className='msg user';
  ub.innerHTML=`<div class="msg-meta"><span class="mlbl">🧑 You</span><span class="mtime">${ts()}</span></div><div>${esc(q)}</div>`;
  chat.appendChild(ub);chat.scrollTop=chat.scrollHeight;
  // AI bubble
  const ab=document.createElement('div');ab.className='msg ai';
  const meta=document.createElement('div');meta.className='msg-meta';
  meta.innerHTML=`<span class="mlbl">🤖 Saarthi AI</span><span class="mtime">${ts()}</span>`;
  ab.appendChild(meta);
  const prog=mkProg();ab.appendChild(prog.el);
  chat.appendChild(ab);chat.scrollTop=chat.scrollHeight;
  const timers=[setTimeout(()=>prog.adv(),6000),setTimeout(()=>prog.adv(),30000),setTimeout(()=>prog.adv(),80000),setTimeout(()=>prog.adv(),140000)];
  const cfg={configurable:{research_model:document.getElementById('rm').value,compression_model:document.getElementById('rm').value,final_report_model:document.getElementById('rm').value,summarization_model:document.getElementById('sm').value,search_api:'tavily',max_concurrent_research_units:parseInt(document.getElementById('cu').value)||1,allow_clarification:false}};
  let rawText='',runError='';
  try{
    const tr=await fetch(`${API}/threads`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(!tr.ok)throw new Error(`Thread failed (${tr.status}): ${await tr.text()}`);
    const th=await tr.json();if(!th.thread_id)throw new Error('No thread_id: '+JSON.stringify(th));
    const rr=await fetch(`${API}/threads/${th.thread_id}/runs/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assistant_id:AID,input:{messages:[{role:'human',content:q}]},config:cfg,stream_mode:'values'})});
    if(!rr.ok)throw new Error(`Run failed (${rr.status}): ${await rr.text()}`);
    const reader=rr.body.getReader(),dec=new TextDecoder();let buf='';
    function consumeSSELine(line){
      const trimmed=line.trim();if(!trimmed.startsWith('data:'))return;
      const raw=trimmed.slice(5).trim();if(!raw||raw==='[DONE]')return;
      try{const obj=JSON.parse(raw);if(obj?.error){const e=obj.error;runError=typeof e==='string'?e:(e.message||JSON.stringify(e));}const rep=extractRep(obj);if(rep&&rep.length>rawText.length)rawText=rep;}catch{}
    }
    while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split(/\r?\n/);buf=ls.pop()??'';for(const l of ls)consumeSSELine(l);}
    if(buf)consumeSSELine(buf);
    // Fallback poll
    if(!rawText){
      prog.adv();
      const rd=document.createElement('div');rd.className='rp';rd.innerHTML='<p style="color:var(--text2)">⏳ Research running — polling for results…</p>';ab.appendChild(rd);
      for(let at=0;at<22;at++){
        await new Promise(r=>setTimeout(r,8000));
        try{const sr=await fetch(`${API}/threads/${th.thread_id}/state`);if(sr.ok){const s=await sr.json();const rep=extractRep(s)||'';if(rep&&rep.length>80){rawText=rep;rd.remove();break;}const taskError=s?.tasks?.find(t=>t.error)?.error;if(taskError){runError=typeof taskError==='string'?taskError:JSON.stringify(taskError);rd.remove();break;}}}catch{}
      }
      if(!rawText){const sr2=await fetch(`${API}/threads/${th.thread_id}/state`);if(sr2.ok){const s2=await sr2.json();rawText=extractRep(s2)||'';const taskError=s2?.tasks?.find(t=>t.error)?.error;if(taskError)runError=typeof taskError==='string'?taskError:JSON.stringify(taskError);}}
    }
    if(!rawText&&runError)throw new Error(`Research run failed: ${runError}`);
    timers.forEach(clearTimeout);prog.fin();await new Promise(r=>setTimeout(r,300));prog.el.remove();
    if(rawText){
      const words=wc(rawText);totalW+=words;
      const firstLine=rawText.split('\n')[0].replace(/^#+\s*/,'').trim();
      const rid=Date.now();
      meta.innerHTML=`<span class="mlbl">🤖 Saarthi AI</span><span class="wc">~${words} words</span>
        <div class="macts">
          <button class="bsm" onclick="copyT(this.dataset.raw,this)" data-raw="${esc(rawText)}">📋 Copy</button>
          <button class="bsm" onclick="dlMd(this.dataset.raw,this.dataset.title)" data-raw="${esc(rawText)}" data-title="${esc(firstLine)}">⬇ .md</button>
          <button class="bsm pdf-btn" onclick="generatePDF(this.dataset.raw,this.dataset.title,this.dataset.q)" data-raw="${esc(rawText)}" data-title="${esc(firstLine)}" data-q="${esc(q)}">📄 PDF</button>
        </div>
        <span class="mtime">${ts()}</span>`;
      const rd=document.createElement('div');rd.className='rp';rd.innerHTML=renderMd(rawText);ab.appendChild(rd);
      hist.unshift({q,report:rawText,time:ts(),words});saveHist();updateBadge();updateStats();
    }else{
      const nd=document.createElement('div');nd.className='rp';nd.textContent='Research complete but no report returned. Please wait a minute and try again.';ab.appendChild(nd);
    }
  }catch(e){timers.forEach(clearTimeout);prog.el.remove();const ed=document.createElement('div');ed.className='msg err';ed.innerHTML=`<strong>⚠ Error</strong><br>${esc(e.message)}`;chat.appendChild(ed);console.error(e);}
  sbtn.disabled=false;sbtn.innerHTML='🔍 Research';busy=false;chat.scrollTop=chat.scrollHeight;
}

/* ===== HISTORY ===== */
function saveHist(){try{localStorage.setItem('saarthi-history',JSON.stringify(hist.slice(0,50)));}catch(e){}}
function updateBadge(){const b=document.getElementById('hbadge');if(hist.length){b.style.display='';b.textContent=hist.length;}else b.style.display='none';}
function renderHist(){
  const l=document.getElementById('hlist');
  if(!hist.length){l.innerHTML='<div class="hempty"><span style="font-size:2.5rem;opacity:.3">📭</span><strong>No history yet</strong><span style="font-size:.8rem">Reports appear here after research</span></div>';return;}
  l.innerHTML='<div class="hgrid">'+hist.map((h,i)=>`<div class="hi" onclick="viewHist(${i})"><span style="font-size:1.3rem;flex-shrink:0">📄</span><div style="flex:1;min-width:0"><div class="hiq">${esc(h.q)}</div><div class="hip">${esc(h.report.slice(0,200))}</div><div style="display:flex;gap:8px;margin-top:5px"><span class="hitag">🕐 ${h.time}</span><span class="hitag">~${h.words} words</span></div></div><button class="delbtn" onclick="delHist(event,${i})">🗑</button></div>`).join('')+'</div>';
}
function viewHist(i){const h=hist[i];nav('research');const chat=document.getElementById('chat');const ab=document.createElement('div');ab.className='msg ai';const fl=h.report.split('\n')[0].replace(/^#+\s*/,'').trim();ab.innerHTML=`<div class="msg-meta"><span class="mlbl">🤖 Saarthi AI</span><span class="wc">~${h.words} words</span><div class="macts"><button class="bsm" onclick="copyT(this.dataset.raw,this)" data-raw="${esc(h.report)}">📋 Copy</button><button class="bsm" onclick="dlMd(this.dataset.raw,this.dataset.title)" data-raw="${esc(h.report)}" data-title="${esc(fl)}">⬇ .md</button><button class="bsm pdf-btn" onclick="generatePDF(this.dataset.raw,this.dataset.title,this.dataset.q)" data-raw="${esc(h.report)}" data-title="${esc(fl)}" data-q="${esc(h.q)}">📄 PDF</button></div><span class="mtime">${h.time} (history)</span></div><div class="rp">${renderMd(h.report)}</div>`;chat.appendChild(ab);chat.scrollTop=chat.scrollHeight;}
function delHist(e,i){e.stopPropagation();hist.splice(i,1);saveHist();updateBadge();renderHist();}
function clrHist(){hist=[];totalW=0;saveHist();updateBadge();renderHist();updateStats();toast('History cleared');}
function clearChat(){document.getElementById('chat').innerHTML='<div class="msg ai"><div class="msg-meta"><span class="mlbl">🤖 Saarthi AI</span></div><div class="rp"><p>Chat cleared. Ask a new research question!</p></div></div>';}

/* ===== STATS ===== */
function updateStats(){
  totalW=hist.reduce((s,h)=>s+(h.words||0),0);
  document.getElementById('st-reps').textContent=hist.length;
  const tw=totalW;
  document.getElementById('st-words').textContent=tw>999?(tw/1000).toFixed(1)+'k':tw;
}

/* ===== SETTINGS SYNC ===== */
function syncS(){document.getElementById('rm').value=document.getElementById('s-rm').value;document.getElementById('sm').value=document.getElementById('s-sm').value;document.getElementById('cu').value=document.getElementById('s-cu').value;toast('✓ Settings saved!');}

/* ===== FAQ ===== */
function tfaq(el){const fi=el.closest('.fi');const op=fi.classList.contains('open');document.querySelectorAll('.fi').forEach(f=>f.classList.remove('open'));if(!op)fi.classList.add('open');}

function setQuery(q){
  nav('research');
  const el = document.getElementById('qinp');
  if(el){
    el.value = q;
    el.focus();
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
    toast('Prompt ready! Press Research or Enter');
  }
}
