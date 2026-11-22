const wall={
    holds:[],
    bolts:[],
    top:0,
    s:1,
    px:0,
    lastBolt:0,
    rnd(){this.s=(this.s*16807) % 2147483647; return this.s/2147483647;},
    reset(send){
        this.s=seed || 7;
        this.holds=[];
        this.bolts=[];
        this.top=120;
        this.px=0;
        this.lastBolt0;
        this.add(0,120,'jug');
        this.gen(1800);
    },
    add(x,y,t){
        const h={
            x,
            y,
            t,
            life:0,
            on:false,
            gone:false
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
            this.top +=this.rnd() < 0.12? 150 + this.rnd()* 40:60 + this.rnd()*45;
            const x=Math.max(-hf,Math.min(hf,this.px +(this.rnd()-0.5)*200));
            this.px=x;
            this.add(x,this.top,this.pick(this.top));
            if(this.rnd()<0.6)
                this.add(Math.max(-hf,Math.min(hf,x+(this.rnd()-0.5)*320)),
            this.top+(this.rnd()-0.5)*50,this.pick(this.top));
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