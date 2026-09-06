#include "../vendor/src/core/pf_partial.h"
#include "../vendor/src/core/pf_attack.h"
#include "../vendor/experiments/partial-piano-wide/salamander.h"
#include "../vendor/experiments/attack-ptq/patch_attack.h"
#include <math.h>
#include <string.h>
#define VOICES 24
typedef struct { pf_partial p; pf_attack a; int used, held, id, note, fading; double age, level, fade, fade_rate; } Voice;
static Voice voices[VOICES];
static float output[128];
static double sr=48000, pedal=0, lim_gain=1;
static pf_pedal_params params;
static long lim_hold=0;
static int live_trims=0;
void set_live(int enabled){live_trims=enabled;}
void *memset(void *p,int c,size_t n){unsigned char *b=p;while(n--)*b++=c;return p;}
void *memcpy(void *dst,const void *src,size_t n){unsigned char *d=dst;const unsigned char *s=src;while(n--)*d++=*s++;return dst;}
void init(double rate){sr=rate;pedal=0;lim_gain=1;lim_hold=0;pf_pedal_defaults(&params);memset(voices,0,sizeof voices);}
void sustain(double value){pedal=value;for(int i=0;i<VOICES;i++)if(voices[i].used)pf_partial_pedal(&voices[i].p,value);}
void off(int id){for(int i=0;i<VOICES;i++)if(voices[i].used&&voices[i].id==id){voices[i].held=0;pf_partial_release(&voices[i].p);}}
void panic(void){memset(voices,0,sizeof voices);pedal=0;lim_gain=1;lim_hold=0;}
static void key_trims(int note,pf_attack_patch *p)
{
    double w=(92-note)/10.0;if(w<0)w=0;if(w>1)w=1;
    double body=(-18)*w+0*(1-w),knock=(-22)*w+0*(1-w),noise=(-17)*w+0*(1-w);
    p->slow_mix=(float)pow(10,body/20);p->knock_mix=(float)pow(10,knock/20);p->noise_mix=(float)(pf_attack_experiment.noise_mix*pow(10,noise/20));
    double top=(note-96)/6.0;if(top<0)top=0;if(top>1)top=1;
    if(top>0){
        double f1=440*pow(2,(note-69)/12.0);
        for(int m=0;m<PF_ATTACK_MODES;m++)if(p->mode_t60[m]<.5f&&p->mode_hz[m]>=.5*f1&&p->mode_hz[m]<f1){
            p->mode_t60[m]*=(float)(1-top*(1-.25));p->mode_db[m]+=(float)(top*0);
        }
    }
}

void on(int id,int midi,double velocity){
 for(int i=0;i<VOICES;i++){Voice *o=&voices[i];if(!o->used||o->note!=midi||o->fading)continue;if(o->age<.005)return;}
 for(int i=0;i<VOICES;i++){Voice *o=&voices[i];if(o->used&&o->note==midi&&!o->fading){o->fading=1;o->fade=1;o->fade_rate=exp(-1.0/(sr*.006));}}
 int best=0;double score=1e9;
 for(int i=0;i<VOICES;i++){if(!voices[i].used){best=i;break;}double s=voices[i].level+(voices[i].held?10:0);if(s<score){score=s;best=i;}}
 Voice *v=&voices[best];memset(v,0,sizeof *v);v->used=1;v->held=1;v->id=id;v->note=midi;v->level=1;
 pf_partial_init2(&v->p,&pf_partial_salamander,sr,midi,velocity,&params,0);
 pf_partial_pedal(&v->p,pedal);pf_attack_patch ap=pf_attack_experiment;if(live_trims)key_trims(midi,&ap);pf_attack_init(&v->a,&ap,sr,midi,velocity);
}
float *render(void){
 memset(output,0,sizeof output);
 for(int i=0;i<VOICES;i++){Voice *v=&voices[i];if(!v->used)continue;float tmp[128]={0};
 pf_partial_process(&v->p,tmp,128);if(v->age<2)pf_attack_process(&v->a,tmp,128);
 if(v->fading){for(int j=0;j<128;j++){tmp[j]*=(float)v->fade;v->fade*=v->fade_rate;}}
 double energy=0;for(int j=0;j<128;j++){output[j]+=tmp[j];energy+=tmp[j]*tmp[j];}
 v->age+=128/sr;v->level=sqrt(energy/128);if((v->age>.5&&v->level<3e-5)||v->age>24||(v->fading&&v->fade<1e-4))v->used=0;
 }
 /* Makeup + block-lookahead peak limiter (as pfplayer / the demo app): the block's own
  * peak is the lookahead, reduction is instant with a 250 ms release ramped over the
  * first 32 samples, hard clamp as safety.  No waveshaping: a tanh here distorted
  * every fff chord.  Onset trims stay at the fit (1.0) so the port is compared raw. */
 double g=2.0,peak=0;for(int j=0;j<128;j++){double a=output[j]<0?-output[j]:output[j];a*=g;if(a>peak)peak=a;}
 const double thr=.95;double target=peak>thr?thr/peak:1,prev=lim_gain;
 if(target<prev){lim_gain=target;lim_hold=(long)(sr*.05);}else if(lim_hold>0)lim_hold-=128;else lim_gain=prev+(1-prev)*(1-exp(-128/(sr*.25)));
 for(int j=0;j<128;j++){
  double lg=j<32?prev+(lim_gain-prev)*(j/32.0):lim_gain;
  double x=output[j]*g*lg;output[j]=(float)(x<-1?-1:x>1?1:x);
 }
 return output;
}
