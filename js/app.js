(()=>{
    const cv=document.getElementById('c'),
    g=cv.getContext('2d'),
    $=id=>document.getElementById(id);
    const lerp=(a,b,t)=> a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
    const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
    const mix=(a,b,t)=>{const p=rgb(a),q=rgb(b); return 'rgb('+p.map((v,i)=>Math.round(lerp(v,q[i],t))).join(',')+')';};
    const load=(k,d)=>{
        try {const v=localStorage.getItem(k); return v===null?d:JSON.parse(v);
        }catch(e){return d;}};
    const save=(k,v) => {try{
        localStorage.setItem(k,JSON.stringify(v));
    }catch(e){} };
    const px=cfg.px,
    AY=0.62,
    HAND=70;
        let W,H,cam=150, t=0, kScale=1;
    const sx=x=>W/2+x*kScale,sy=y=>H*AY-(y-cam);
    function size(){const d=Math.min(devicePixelRatio || 1,2);
        W=innerWidth;
        H=innerHeight;
        kScale=Math.min(1,(W-24)/680);
        cv.width=W*d;
        cv.height= H*d;
        g.setTransform(d,0,0,d,0,0);
    }
    addEventListener('resize',size);
    size();
    let st,p,hold,tgt,grip,flow,lastGrab,parts,anchor,maxAlt,chalk,pit,buff,aim,down,ended,hangT,noHold,noT,wind=0,runT=0,paused=false,shake=0,lives,rocks=[],warnings=[],rockTimer=0;
    let lb=load(cfg.keys.lb,[]),best=load(cfg.keys.best,0),ghost=load(cfg.keys.ghost,null),rec=[],recT=0,curSeed=0,forceRand=false;
    const L={};
    function reset(){
        curSeed=(forceRand || !ghost || typeof ghost.seed!=='number')?(1+Math.floor(Math.random()*9999)):ghost.seed;
        forceRand=false;
        wall.reset(curSeed);
        rec=[];
        recT=0;
        hold=wall.holds[0];
        p={
            x:hold.x,
            y:hold.y-HAND,
            vx:0,
            vy:0
        };
        st='hang';
        grip=cfg.gripMax;
        flow=0;
        lastGrab=-9;
        parts=[];
        anchor={
            x:0,
            y:0
        };
        maxAlt=0;
        lives=cfg.catches;
        rocks=[];
        warnings=[];
        rockTimer=0;
        chalk={
            n:cfg.chalk.n,
            cd:0
        };
        pit={
            n:cfg.piton.n,
            cd:0
        };
        buff=0;
        aim=null;
        down=null;
        ended= false;
        runT=0;
        hangT=0;
        noHold=null;
        noT=0;
        cam=150;
        $('end').hidden=true;
        for(const k of ['hl','hr','fl','fr']) L[k]={x:hold.x,y:hold.y};
    }
    function puff(x,y,n,c,sp){
        for(let i=0;i<n;i++){
            const a=Math.random()*6.28, 
            s=Math.random()*sp;
            parts.push({x,y,vx:Math.cos(a)*s,
                vy:Math.sin(a)*s +40,
                l:0.5+Math.random()*0.5,
                c,
                r:2+Math.random()*2});}
    }
    function grab(h){
        st='hang';
        hold=h;
        hangT=0;
        p.vx=p.vy=0;
        flow=t-lastGrab<cfg.flowWin ? flow+1:0;
        lastGrab=t;
        if(h.t==='crumble') h.on=true;
        snd.grab();
        if(wall.pickups){
            for(let i=wall.pickups.length-1;i>=0;i--){
                const u=wall.pickups[i];
                if(!u.taken && Math.hypot(u.x-h.x,u.y-h.y)<=40){
                    u.taken=true;
                    if(u.t==='chalk') chalk.n=Math.min(cfg.chalk.n,chalk.n+1);
                    else if(u.t==='piton') pit.n=Math.min(cfg.piton.n,pit.n+1);
                    else if(u.t==='rope') lives=Math.min(cfg.catches,lives+1);
                    snd.clip();
                    puff(u.x,u.y,8,u.t==='chalk'?'#f3efe6':u.t==='piton'?'#e04f16':'#1f7a4c',80);
                    wall.pickups.splice(i,1);
                }
            }
        }
    }
    function release(){
        st='fly';
        p.vx=p.vy=0;
        noHold=hold;
        noT=0.3;
        flow=0;
    }
    function crumble(h){
        h.gone=true;
        h.on=false;
        puff(h.x,h.y,14,'#9c7a55',120);
        snd.crumble();
        if(st==='hang' && hold===h) release();
        else if(st==='reach' && tgt===h){
            st='fly';
            p.vx=p.vy=0;
            noHold=null;}
    }
    function caught(){
        lives--;
        if(lives<0) return end('fell');
        shake=0.4;
        grip=Math.max(8,grip-cfg.catchCost);
        snd.clip();
        let b=null,bd=1e9;
        const qx=p.x,qy=anchor.y-cfg.slack*0.6;
        for(const h of wall.holds) if(!h.gone && h.y<=anchor.y) {const d=Math.hypot(h.x-qx,h.y-qy);
            if(d<bd){bd=d;b=h;}}
        if(!b){
            for(const h of wall.holds) if(!h.gone) {const d=Math.hypot(h.x-qx,h.y-qy);
                if(d<bd){bd=d;b=h;}}
        }
        if(!b) return end('fell');
        p.x=b.x;
        p.y=b.y-HAND-20;
        p.vx=p.vy=0;
        for(const k of ['hl','hr']) L[k]={x:b.x,y:b.y};
        for(const k of ['fl','fr']) L[k]={x:b.x,y:b.y-HAND-20};
        tgt=b;
        st='reach';
    }
    function end(res){
        if(ended) return;
        ended=true;
        st='dead';
        const m=Math.floor(maxAlt/px);
        lb.push({
            m,
            r:res,
            d:Date.now(),
            s:Math.round(runT)
        });
        lb.sort((a,b)=>b.m-a.m);
        lb=lb.slice(0,10);
        save(cfg.keys.lb,lb);
        if(m>best) {
            best=m; save(cfg.keys.best,m);
            ghost={seed:curSeed,pts:rec};
            save(cfg.keys.ghost,ghost);
        }
        if (res==='summit') snd.chime();
        $('et').textContent=res==='summit' ? 'Summit reached' : 'Off the wall';
        $('ep').textContent='Highest point: '+m+'m · Time: '+fmt(runT);
        $('end').hidden=false;
        drawLb();
    }
    function stepParts(dt){
        for(const q of parts){
            q.vy-=600*dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            q.l-=dt;
        }
        parts=parts.filter(q=>q.l>0);
    }
    function update(dt){
        t+=dt;
        runT+=dt;
        recT+=dt;
        if(recT>=0.1 && runT<=900){
            recT-=0.1;
            rec.push([Math.round(p.x),Math.round(p.y)]);}
        chalk.cd=Math.max(0,chalk.cd-dt);
        pit.cd=Math.max(0,pit.cd-dt); 
        buff=Math.max(0,buff-dt);
        noT-=dt;
        wall.gen(p.y+1800);
        const alt=(p.y+HAND)/px;
        wind=alt>cfg.wind.from?Math.sin(t*0.9)*Math.sin(t*0.37+1)*cfg.wind.max*clamp((alt-cfg.wind.from)/60,0,1):0;
        for (const h of wall.holds) if (h.on && !h.gone){
            h.life+=dt;
            if(h.life>cfg.crumble)
                crumble(h);}
            if(st==='hang'){
                hangT+= dt;
                let dr =cfg.drain[hold.t];
                if(dr>0) dr*=(1-Math.min(flow,5)*0.1)*(buff>0?0.5:1);
                grip=clamp(grip-dr*dt,0,cfg.gripMax);
                if(grip<20 && Math.floor(t*3)!==Math.floor((t-dt)*3)) snd.tone(300,0.08,'square',0.04);
                p.x=hold.x;
                p.y=hold.y-HAND-(hold.t==='ice'?Math.min(hangT*6,26):0);
                if(grip<=0) release();
            }else if(st==='reach'){
                const gx=tgt.x,
                gy=tgt.y-HAND,
                dx=gx-p.x,
                dy=gy-p.y,
                d=Math.hypot(dx,dy),
                sp=(tgt.t==='ice' ? 260 : 520 )*dt;
                if(d<=sp) grab(tgt);
                else{
                    p.x+=dx/d*sp;
                    p.y+=dy/d*sp;
                }
            }
            else if(st==='fly'){
                p.vy-=cfg.grav*dt;
                p.vx+=wind*dt;
                p.x=clamp(p.x+p.vx*dt,-cfg.half,cfg.half);
                p.y+=p.vy*dt;
            
            for(const h of wall.holds){
                if(h.gone || (noT>0 && noHold && Math.hypot(h.x-noHold.x,h.y-noHold.y)<cfg.grab*2)) continue;
                if(Math.hypot(h.x-p.x,h.y-p.y-HAND)< cfg.grab){grab(h); break;}
            }
            if(st==='fly'){
                if(anchor.y<=0 && p.y<0) end('fell');
                else if(p.y+HAND< anchor.y-cfg.slack) caught();
            }
            }
    
    if(!ended){
        for(const b of wall.bolts) if(!b.on && p.y+HAND>b.y){
            b.on=true;
            if(b.y>anchor.y) anchor=b;
            snd.clip();
            puff(b.x,b.y,8,'#e04f16',90);}
            maxAlt=Math.max(maxAlt,p.y+HAND);
            if(maxAlt>=cfg.summit*px) end('summit');
            if(alt>cfg.wind.from){
                rockTimer-=dt;
                if(rockTimer<=0){
                    const f=1+(alt-cfg.wind.from)/200;
                    rockTimer=cfg.rock.rate/f;
                    warnings.push({x:(Math.random()*2-1)*(cfg.half-30),t:1});
                }
            }
    }
        for(let i=warnings.length-1;i>=0;i--){
            const w=warnings[i];
            w.t-=dt;
            if(w.t<=0){
                rocks.push({x:w.x,y:cam+H*AY+30,r:10});
                warnings.splice(i,1);
            }
        }
        for(let i=rocks.length-1;i>=0;i--){
            const rk=rocks[i];
            rk.y-=cfg.rock.speed*dt;
            if(sy(rk.y)>H+30){
                rocks.splice(i,1);
                continue;
            }
            if(!ended && (st==='hang'||st==='reach'||st==='fly') && Math.hypot(rk.x-p.x,rk.y-(p.y+30))<22){
                rocks.splice(i,1);
                puff(rk.x,rk.y,10,'#9aa0a8',80);
                snd.crumble();
                st='fly';
                p.vx=(Math.random()-0.5)*100;
                p.vy=-80;
                if(anchor.y>0) caught();
                else end('fell');
                break;
            }
        }
    
        stepParts(dt);
        cam+=(Math.max(150,p.y+110)-cam)*Math.min(1,dt*4);
        snd.wind(Math.abs(wind)/cfg.wind.max*0.16)}
    function doChalk(){
        if(ended || st!=='hang' || chalk.n<=0 || chalk.cd>0) return;
        chalk.n--;
        chalk.cd=cfg.chalk.cd;
        grip=Math.min(cfg.gripMax,grip+cfg.chalk.boost);
        buff=cfg.chalk.buff;
        puff(p.x,p.y+HAND,20,'#f3efe6',110);
        snd.chalk();
    }
    function doPit(){
        if(ended || st!=='hang' || pit.n <=0 || pit.cd>0) return;
        pit.n--;
        pit.cd=cfg.piton.cd;
        const b={x:p.x+20,y:p.y+HAND,on:true};
        wall.bolts.push(b);
        wall.bolts.sort((a,c)=>a.y-c.y);
        if(b.y>anchor.y) anchor=b;
        snd.clip(); puff(b.x,b.y,10,'#e04f16',100);
    }
    function aimvel(){
        let vx=((down.x-aim.x)/kScale)*cfg.launchK,vy=(aim.y-down.y)*cfg.launchK;
        const m=Math.hypot(vx,vy);
        if (m>cfg.launchMax){ vx*=cfg.launchMax/m; vy*=cfg.launchMax/m;}
        return {vx,vy};
    }
    cv.addEventListener('pointerdown',e=>{snd.init();
        if(ended) return;
        if($('drawer').classList.contains('open')){
            $('drawer').classList.remove('open');
            return;
        }
        if(paused){
            paused=false;
            $('bPause').textContent='Pause';
            return;
        }
        down={x:e.clientX,y:e.clientY};
        aim=null;
    });
    cv.addEventListener('pointermove',e=>{
        if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>14) aim={x:e.clientX,y:e.clientY};
    });
    cv.addEventListener('pointerup',e=>{
        if(!down) return;
        if(aim && st=='hang'){
            const v=aimvel();
            st='fly';
            p.vx=v.vx;
            p.vy=v.vy;
            noHold=hold;
            noT=0.25;
            grip=Math.max(1,grip-cfg.launchCost);
            snd.grab();
        }else if(!aim && st==='hang'){
            const wx=(e.clientX-W/2)/kScale,
            wy=cam+(H*AY-e.clientY);
            let b=null,
            bd=Math.max(30,26/kScale);
            for(const h of wall.holds){
                if(h.gone || h===hold) continue;
                const d=Math.hypot(h.x-wx,h.y-wy);
                if(d<bd && Math.hypot(h.x-p.x,h.y-(p.y+HAND))<=cfg.reach){bd=d;b=h}
            }
            if(b){tgt=b;st='reach';}
        }
        down=null;
        aim=null;
    });
    cv.addEventListener('pointercancel',()=>{down=null;aim=null;});
    addEventListener('keydown',e=>{
        snd.init();
        if(e.code==='Space') {e.preventDefault();doChalk();}
        else if (e.code==='KeyE') doPit();
        else if(e.code==='KeyP' || e.code==='Escape') {
            paused=!paused;
            $('bPause').textContent=paused?'Resume':'Pause';
        }
        else if(e.code==='KeyR' && ended) reset();
    });
    addEventListener('blur',()=>{paused=true;$('bPause').textContent='Resume';});
    $('bChalk').onclick=()=>{snd.init();doChalk();};
    $('bpit').onclick=()=>{snd.init();doPit();};
    $('bPause').onclick=()=>{
        paused=!paused;
        $('bPause').textContent=paused?'Resume':'Pause';
    };
    $('again').onclick=reset;
    $('bRand').onclick=()=>{forceRand=true;reset();};
    $('bLog').onclick=()=>{drawLb();$('drawer').classList.toggle('open');};
    $('bClose').onclick=()=>$('drawer').classList.remove('open');
    $('bSfx').onclick=()=>{snd.init(); $('bSfx').textContent=snd.toggle()? 'SFX off': 'SFX on';};
    function drawLb(){
        $('lb').innerHTML=lb.length ? lb.map(e=>'<li>' +e.m+'m'+(e.r==='summit' ? ' summit '+fmt(e.s||0) : '')+
        '<span class="sm">' +new Date(e.d).toLocaleDateString()+ '</span></li>')
        .join(''):'<li>No climbs logged yet</li>';
    }
    const biome=m=>{
        let i=0;
        while(i<cfg.biomes.length-1 && m>=cfg.biomes[i+1].at) i++; return i;
    };
    function limb(ax,ay,bx,by,l,dir){
        const dx=bx-ax,dy=by-ay,d=Math.min(Math.hypot(dx,dy),2*l-0.5),a=Math.atan2(dy,dx),n=a+dir*Math.acos(d/(2*l));
        g.beginPath();
        g.moveTo(ax,ay);
        g.lineTo(ax+Math.cos(n)*l,ay+Math.sin(n)*l);
        g.lineTo(bx,by);
        g.stroke();
    }
    function climber(dt){
        const k=Math.min(1,dt*16),
        hs=st==='hang'? hold : st==='reach' ? tgt:null;
        const T=hs?{hl:[hs.x-9,hs.y],
            hr:[hs.x+9,hs.y],fl:[p.x-15,p.y-50],
        fr:[p.x +15, p.y-50]}
        :{hl:[
            p.x-10,
            p.y+60],
        hr:[p.x+10,p.y+66],
        fl:[p.x-12,p.y-56],
        fr:[p.x+12,p.y-52]};
        for(const n in T){
            L[n].x+=(T[n][0]-L[n].x)*k;
            L[n].y+=(T[n][1]-L[n].y)*k}
            const hx=sx(p.x),
            hy=sy(p.y),
            shy=sy(p.y+32);
            g.lineCap = g.lineJoin='round';
            g.strokeStyle= '#f3efe6';
            g.lineWidth=8;
            limb(hx-5,hy,sx(L.fl.x),sy(L.fl.y),32,1);
            limb(hx+5,hy,sx(L.fr.x),sy(L.fr.y),32,-1);
            limb(hx-6,shy,sx(L.hl.x),sy(L.hl.y),26,-1);
            limb(hx+6,shy,sx(L.hr.x),sy(L.hr.y),26,1);
            g.lineWidth=15;g.beginPath();
            g.moveTo(hx,hy);g.lineTo(hx,shy);g.stroke();
            g.strokeStyle='#e04f16';g.lineWidth=10;g.beginPath();
            g.moveTo(hx,hy);g.lineTo(hx,shy);g.stroke();
            g.fillStyle= '#f3efe6';g.strokeStyle= '#18181b';g.lineWidth=1.5;
            g.beginPath();g.arc(hx,shy-13,8,0,7);g.fill();
            g.stroke();g.fillStyle='#e04f16';g.beginPath();
            g.arc(hx,shy-13,8,Math.PI,0);g.fill();g.stroke();
            }
            function hud(){
                const alt=Math.max(0,Math.floor((p.y+HAND)/px));
                $('alt').textContent=alt+'m';
                $('tag').textContent=cfg.biomes[biome(alt)].n+' · '+Math.max(0,lives)+(lives===1?' rope left':' ropes left');
                $('best').textContent=Math.max(best,Math.floor(maxAlt/px))+'m';
                $('flow').textContent='x'+Math.min(flow,5);
                $('time').textContent=fmt(runT);
                $('hud').style.borderColor=grip<20 && Math.floor(t*4)%2 ? '#e04f16' : '#18181b';
                const n=Math.ceil(grip/10),
                gp=$('grip');
                gp.classList.toggle('low',grip<30);
                if (gp.children.length!==10){gp.innerHTML='<span></span>'.repeat(10);}
                for (let i=0;i<10;i++) gp.children[i].classList.toggle('on',i<n);
                const w=$('wind');
                w.hidden=alt<cfg.wind.from;
                if(!w.hidden){const s=Math.round(Math.abs(wind)/cfg.wind.max*10); w.textContent=s ?(wind>0? 'WIND >> ' : '<< WIND ')+s:'WIND calm';}
                $('bChalk').querySelector('b').textContent=chalk.n;
                $('bpit').querySelector('b').textContent=pit.n;
                $('bChalk').querySelector('u').style.width=(100*(1-chalk.cd/cfg.chalk.cd))+'%'
                $('bpit').querySelector('u').style.width=(100*(1-pit.cd/cfg.piton.cd))+'%';
            }
            function draw(dt){
                g.save();
                if(shake>0) g.translate((Math.random()-0.5)*shake*24,(Math.random()-0.5)*shake*24);
                const m=cam/px, f=clamp(m/cfg.summit,0,1);
                const gr=g.createLinearGradient(0,0,0,H);
                gr.addColorStop(0,mix(cfg.sky[0],cfg.sky[1],f));
                gr.addColorStop(1,mix(cfg.sky[0],cfg.sky[1],clamp(f+0.2,0,1)));
                g.fillStyle=gr;
                g.fillRect(0,0,W,H);
                const bs=cfg.biomes,bi=biome(m),bj=Math.min(bi+1,bs.length-1);
                const L0=sx(-340), R0=sx(340);
                g.fillStyle= mix(bs[bi].rock, bs[bj].rock,bj===bi ? 0: clamp((m-(bs[bj].at-40))/40,0,1));
                g.fillRect(L0,0,R0-L0,H);
                g.strokeStyle= 'rgba(243,239,230,0.07)';
                g.lineWidth=1;
                for(let y=Math.ceil((cam-H*(1-AY))/46) * 46; y<cam+H*AY;y+=46){
                    g.beginPath();
                    g.moveTo(L0,sy(y));
                    for(let x=L0; x<=R0;x+=20) g.lineTo(x,sy(y)+Math.sin(x*0.02+y*0.05)*6);
                    g.stroke();
                }
                g.strokeStyle='#18181b';
                g.lineWidth=1.5;
                g.strokeRect(L0,-5,R0-L0,H+10);
                if(sy(0)<H){g.fillStyle='#6b6355'; g.fillRect(0,sy(0),W,H-sy(0));
                    g.strokeRect(-5,sy(0),W+10,H);}
                    g.strokeStyle='#e04f16';
                    g.lineWidth=2.5;
                    g.beginPath();
                    g.moveTo(sx(0),sy(0));
                    for(const b of wall.bolts) if (b.on) g.lineTo(sx(b.x),sy(b.y));
                    g.lineTo(sx(p.x),sy(p.y));
                    g.stroke();
                    for(const b of wall.bolts){
                        const y=sy(b.y);
                        if(y<-20 || y>H+20) continue;
                        g.fillStyle=b.on? '#e04f16' : '#d9d4c7';
                        g.strokeStyle='#18181b';
                        g.lineWidth=1.5;
                        g.beginPath();g.rect(sx(b.x)-5,y-5,10,10);
                        g.fill();g.stroke();
                    }
                    const inReach=h=>st==='hang' && !h.gone && h!== hold && Math.hypot(h.x-p.x,h.y-p.y-HAND)<=cfg.reach;
                    for(const h of wall.holds){
                        const y=sy(h.y); if (h.gone || y<-30 || y>H+30) continue;
                        const x=sx(h.x)+(h.on?Math.sin(t*60)*2:0);
                        g.fillStyle=cfg.col[h.t]; 
                        g.strokeStyle='rgba(243,239,230,0.6)' 
                        g.lineWidth=1.5;g.beginPath();
                        if(h.t==='crimp') g.rect(x-12,y-3,24,6);
                        else if(h.t==='sloper') g.ellipse(x,y,15,9,0,0,7);
                        else if(h.t==='ice'){
                            g.moveTo(x-12,y+7);g.lineTo(x,y-10);
                            g.lineTo(x+12,y+7); g.closePath();
                        }
                        else if(h.t === 'crumble') g.rect(x-12,y-8,24,16);
                        else g.arc(x,y,13,0,7);
                        g.fill(); g.stroke();
                        if(h.t==='crumble'){g.beginPath();g.moveTo(x-4,y-8); g.lineTo(x+1,y);g.lineTo(x-3,y+8);g.stroke();}
                            if(inReach(h)){
                                g.strokeStyle='#e04f16'; g.lineWidth=2;
                                g.beginPath();g.arc(x,y,20,0,7); g.stroke();}
                    }
                    if(wall.pickups){
                        for(const u of wall.pickups){
                            const y=sy(u.y); if(u.taken || y<-30 || y>H+30) continue;
                            const x=sx(u.x);
                            g.lineWidth=1.5;
                            g.strokeStyle='#18181b';
                            if(u.t==='chalk'){
                                g.fillStyle='#f3efe6';
                                g.beginPath();
                                g.rect(x-5,y-5,10,10);
                                g.fill();
                                g.stroke();
                            }else if(u.t==='piton'){
                                g.fillStyle='#e04f16';
                                g.beginPath();
                                g.rect(x-5,y-5,10,10);
                                g.fill();
                                g.stroke();
                            }else if(u.t==='rope'){
                                g.fillStyle='#1f7a4c';
                                g.beginPath();
                                g.arc(x,y,6,0,7);
                                g.fill();
                                g.stroke();
                            }
                        }
                    }
                    if(st==='hang' && !aim){
                        g.strokeStyle='rgba(243,239,230,0.75)';
                        g.lineWidth=1.5;g.setLineDash([6,6]);
                        g.beginPath();g.arc(sx(p.x),sy(p.y+HAND),cfg.reach,0,7);
                        g.stroke();g.setLineDash([]);
                    }
                    if(ghost && ghost.seed===curSeed && Array.isArray(ghost.pts)){
                        const idx=Math.floor(runT*10);
                        const pt=ghost.pts[idx];
                        if(pt && typeof pt[0]==='number'){
                            const gx=sx(pt[0]),gy=sy(pt[1]),gshy=sy(pt[1]+32);
                            g.save();
                            g.globalAlpha=0.65;
                            g.lineCap='round';
                            g.strokeStyle='#f3efe6';
                            g.lineWidth=12;
                            g.beginPath();
                            g.moveTo(gx,gy);
                            g.lineTo(gx,gshy);
                            g.stroke();
                            g.fillStyle='#f3efe6';
                            g.strokeStyle='#18181b';
                            g.lineWidth=1.5;
                            g.beginPath();
                            g.arc(gx,gshy-13,8,0,7);
                            g.fill();
                            g.stroke();
                            g.fillStyle='#e04f16';
                            g.beginPath();
                            g.arc(gx,gshy-13,8,Math.PI,0);
                            g.fill();
                            g.stroke();
                            g.font='700 11px monospace';
                            g.fillStyle='#f3efe6';
                            g.textAlign='center';
                            g.fillText('best',gx,gshy-25);
                            g.restore();
                        }
                    }
                    climber(dt);
                    if(aim && st==='hang'){
                        const v=aimvel();let x=p.x,y=p.y,vx=v.vx,vy=v.vy;
                        g.fillStyle='#e04f16';
                        for(let i=0;i<28;i++){
                            vy-=cfg.grav*0.045; vx+=wind*0.045; x += vx*0.045;y+=vy*0.045;
                            g.globalAlpha=1-i/32;g.beginPath();g.arc(sx(x),sy(y+HAND),3,0,7);g.fill();}
                            g.globalAlpha=1;
                    }
                    for (const q of parts){
                        g.globalAlpha=clamp(q.l*2,0,1);g.fillStyle=q.c;
                        g.fillRect(sx(q.x),sy(q.y),q.r,q.r);
                    }
                    g.globalAlpha=1;
                    for(const w of warnings){
                        const wx=sx(w.x);
                        g.fillStyle='#e04f16';
                        g.strokeStyle='#18181b';
                        g.lineWidth=1.5;
                        g.beginPath();
                        g.moveTo(wx,8);
                        g.lineTo(wx+6,20);
                        g.lineTo(wx-6,20);
                        g.closePath();
                        g.fill();
                        g.stroke();
                    }
                    for(const rk of rocks){
                        g.fillStyle='#8e959e';
                        g.strokeStyle='#18181b';
                        g.lineWidth=1.5;
                        g.beginPath();
                        g.arc(sx(rk.x),sy(rk.y),rk.r,0,7);
                        g.fill();
                        g.stroke();
                    }
                    const rx=W-16;
                    g.strokeStyle=g.fillStyle='#18181b';g.lineWidth=1.5;g.beginPath();
                    g.moveTo(rx,0);g.lineTo(rx,H);g.stroke();
                    g.font='10px ui-monospace,monospace';g.textAlign='right';
                    const lo=Math.max(0,Math.floor((cam-H*(1-AY))/(10*px))),hi=Math.min(100,Math.ceil((cam+H*AY)/(10*px)));
                    for(let k=lo;k<=hi;k++){
                        const y=sy(k*10*px),len=k%10===0 ? 16:k%5===0? 11:6;
                        g.beginPath();g.moveTo(rx,y);g.lineTo(rx-len,y);g.stroke();
                        if(k%10===0) g.fillText(k*10+'m',rx-20,y+3);
                    }
                    g.fillStyle='#e04f16';
                    for(const e of lb){
                        const y=sy(e.m*px); if(y<0||y>H) continue; 
                        g.beginPath();g.moveTo(rx,y);g.lineTo(rx-14,y-4);g.lineTo(rx,y-8);
                        g.closePath(); g.fill();
                    }
                g.restore();
                if(paused){
                    g.fillStyle='rgba(243,239,230,0.85)'; g.fillRect(0,0,W,H);
                    g.fillStyle='#18181b'; g.font='700 28px Georgia,serif'; g.textAlign='center';
                    g.fillText('Paused - tap screen to resume',W/2,H/2);
                }
            }
            reset();drawLb();
            let last=performance.now();
            function loop(now){
                const dt=Math.min(0.033,(now-last)/1000);last=now;
                shake=Math.max(0,shake-dt);
                if(paused) snd.wind(0); else if(!ended) update(dt); else{t +=dt; stepParts(dt);snd.wind(0);}
                draw(dt);hud();requestAnimationFrame(loop);
            }
requestAnimationFrame(loop);
})();