const snd={
    ctx:null,
    muted:false,
    wg:null,
    nb:null,
    init() {
        if(this.ctx){
            if(this.ctx.state==='suspended') this.ctx.resume();return;}
            const C=window.AudioContext || window.webkitAudioContext;
            if(!C) return;
            const c=this.ctx=new C();
            const n=c.sampleRate;
            this.nb=c.createBuffer(1,n,n);
            const d=this.nb.getChannelData(0);
            for (let i=0;i<n;i++) d[i]=Math.random()*2-1;
            const s=c.createBufferSource(), f=c.createBiquadFilter();
            s.buffer=this.nb;
            s.loop=true;
            f.type='bandpass';
            f.frequency.value=420;
            this.wg=c.createGain();
            this.wg.gain.value=0;
            s.connect(f);
            f.connect(this.wg);
            this.wg.connect(c.destination);
            s.start();
        },
        ok() { return this.ctx && !this.muted; },
        tone(f,d,type,g,to){
            if(!this.ok()) return;
            const c=this.ctx,
            o=c.createOscillator(),
            v=c.createGain(),
            t=c.currentTime;
            o.type=type;
            o.frequency.setValueAtTime(f,t);
            if(to) o.frequency.exponentialRampToValueAtTime(to,t+d);
            v.gain.setValueAtTime(g,t);
            v.gain.exponentialRampToValueAtTime(0.001,t+d);
            o.connect(v);
            v.connect(c.destination);
            o.start(t);
            o.stop(t+d);
        },
        burst(d,g,type,f){
            if(!this.ok()) return;
            const c=this.ctx,
            s=c.createBufferSource(),fl=c.createBiquadFilter(),
            v=c.createGain(),
            t=c.currentTime;
            s.buffer=this.nb;
            fl.type=type;
            fl.frequency.value=f;
            v.gain.setValueAtTime(g,t);
            v.gain.exponentialRampToValueAtTime(0.001,t+d);
            s.connect(fl);
            fl.connect(v);
            v.connect(c.destination);
            s.start(t,Math.random()*0.5,d);
        },
        grab(){
            this.burst(0.09,0.25,'lowpass',350);
            this.tone(110,0.08,'triangle',0.12);
        },
        chalk(){
            this.burst(0.3,0.18,'highpass',2500);
        },
        clip(){this.tone(1900,0.07,'square',0.05); setTimeout(()=> this.tone(1250,0.1,'square',0.05),70);},
        crumble(){this.burst(0.6,0.4,'lowpass',500);},
        chime(){[660,880,1320].forEach((f,i)=>setTimeout(()=>this.tone(f,0.9,'sine',
            0.12),i*150)); },
            wind(v){if(this.wg) this.wg.gain.value=this.muted ? 0:v},
            toggle(){this.muted= !this.muted; 
            if(this.wg && this.muted) this.wg.gain.value=0;
            return this.muted;}
    };
    