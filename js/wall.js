const wall={
    holds:[],
    bolts:[],
    top:0,
    s:1,
    px:0,
    lastBolt:0,
    rnd(){this.s=(this.s*16807) % 2147483647; return this.s/2147483647;},
    reset(seed){
        this.s=seed || 7;
        this.holds=[];
        this.bolts=[];
        this.top=120;
        this.px=0;
        this.lastBolt=0;
        this.lastBig=-9999;
        this.add(0,120,'jug');
        this.gen(1800);
    },
    add(x,y,t,extra){
        const h={
            x,
            y,
            t,
            life:0,
            on:false,
            gone:false,
            extra:!!extra
        };
        this.holds.push(h); return h;
    },
    pick(y){
        const r=this.rnd(),
        m=y/cfg.px;
        if(m>cfg.iceForm && r<0.2) return 'ice';
        if(m>30 && r>0.9) return 'crumble';
        const q=this.rnd();
        return q<0.28? 'jug':q<0.6? 'crimp':'sloper';
    },
    gen(h){
        const hf=cfg.half;
        while (this.top<h){
            const big=this.top-this.lastBig>1000 && this.rnd()<0.25;
            if(big) this.lastBig=this.top;
            this.top+=big? 150+this.rnd()*40 : 70+this.rnd()*30;
            const x=Math.max(-hf,Math.min(hf,this.px +(this.rnd()-0.5)*(big?60:200)));
            this.px=x;
            this.holds=this.holds.filter(o=>!(o.extra && Math.hypot(o.x-x,o.y-this.top)<70));
            this.add(x,this.top,this.pick(this.top));
            if(this.rnd()<0.6){
                const ex=Math.max(-hf,Math.min(hf,x+(this.rnd()-0.5)*320)),
                ey=this.top+(this.rnd()-0.5)*50;
                if(!this.holds.some(o=>Math.hypot(o.x-ex,o.y-ey)<70)) this.add(ex,ey,this.pick(this.top),true);
            }
            if (this.top - this.lastBolt>=380){
                this.lastBolt=this.top;
                this.bolts.push({x:x+(this.rnd()<0.5?-34:34),
                    y:this.top+20,
                    on:false
                });
            }
        }
    }
};