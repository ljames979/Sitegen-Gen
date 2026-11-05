function(root,SG){SG=SG||{};
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CH=' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$,.-:';
    const WID=SG.wid||[18,9];const SC={};const SETS=SG.sets||[[]];
    const rows=[...root.querySelectorAll('.sf-board .sf-row:not(.sf-th)')], page=root.querySelector('.sf-page');
    const cells=[];rows.forEach((r,ri)=>[...r.querySelectorAll('.sf-col')].forEach((col,ci)=>[...col.querySelectorAll('.sf-c')].forEach((c,k)=>cells.push({el:c,t:c.querySelector('.t i'),b:c.querySelector('.b i'),f:c.querySelector('.f'),fi:c.querySelector('.f i'),cur:0,tgt:0,ri,ci,k,col}))));
    let set=0,timer=0,tick=0,last=0;
    function target(s){cells.forEach(c=>{const txt=(SETS[s][c.ri][c.ci]||'').padEnd(WID[c.ci],' ');const ch=txt[c.k]||' ';c.tgt=Math.max(0,CH.indexOf(ch));if(c.ci===4&&c.k===0)c.col.style.setProperty('--sc',SC[SETS[s][c.ri][4]]||'#F3F1EC');});page.textContent=(s+1)+' / '+SETS.length;}
    function show(c,i){const ch=CH[i];c.t.textContent=ch;c.b.textContent=ch;c.fi.textContent=ch;}
    function stepAll(now){if(now-last>=65){last=now;let moving=false;
      cells.forEach(c=>{if(c.cur===c.tgt)return;moving=true;const old=CH[c.cur];c.cur=(c.cur+1)%CH.length;const nw=CH[c.cur];c.fi.textContent=old;c.t.textContent=nw;c.f.classList.remove('go');void c.f.offsetWidth;c.f.classList.add('go');setTimeout(()=>{c.b.textContent=nw;},60);});}
      tick=requestAnimationFrame(stepAll);}
    function start(s){set=s;target(s);if(reduce){cells.forEach(c=>{c.cur=c.tgt;show(c,c.cur);});}}
    cells.forEach(c=>{c.cur=Math.floor(Math.random()*CH.length);show(c,c.cur);});
    start(0);
    if(!reduce)tick=requestAnimationFrame(stepAll);
    timer=setInterval(()=>start((set+1)%SETS.length),8000);
    return ()=>{cancelAnimationFrame(tick);clearInterval(timer);};
  }
