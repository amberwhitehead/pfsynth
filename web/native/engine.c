#include "../vendor/src/core/pf_partial.h"
#include "../vendor/src/core/pf_attack.h"
#include "../vendor/experiments/partial-piano-wide/salamander.h"
#include "../vendor/experiments/attack-ptq/patch_attack.h"
#include <math.h>
#include <string.h>
#define VOICES 24
typedef struct { pf_partial p; pf_attack a; int used, held, id; double age, level; } Voice;
static Voice voices[VOICES];
static float output[128];
static double sr=48000, pedal=0;
static pf_pedal_params params;
void *memset(void *p,int c,size_t n){unsigned char *b=p;while(n--)*b++=c;return p;}
void init(double rate){sr=rate;pf_pedal_defaults(&params);memset(voices,0,sizeof voices);}
void sustain(double value){pedal=value;for(int i=0;i<VOICES;i++)if(voices[i].used)pf_partial_pedal(&voices[i].p,value);}
void off(int id){for(int i=0;i<VOICES;i++)if(voices[i].used&&voices[i].id==id){voices[i].held=0;pf_partial_release(&voices[i].p);}}
void panic(void){memset(voices,0,sizeof voices);pedal=0;}
void on(int id,int midi,double velocity){
 int best=0;double score=1e9;
 for(int i=0;i<VOICES;i++){if(!voices[i].used){best=i;break;}double s=voices[i].level+(voices[i].held?10:0);if(s<score){score=s;best=i;}}
 Voice *v=&voices[best];memset(v,0,sizeof *v);v->used=1;v->held=1;v->id=id;v->level=1;
 pf_partial_init2(&v->p,&pf_partial_salamander,sr,midi,velocity,&params,0);
 pf_partial_pedal(&v->p,pedal);pf_attack_init(&v->a,&pf_attack_experiment,sr,midi,velocity);
}
float *render(void){
 memset(output,0,sizeof output);
 for(int i=0;i<VOICES;i++){Voice *v=&voices[i];if(!v->used)continue;float tmp[128]={0};
 pf_partial_process(&v->p,tmp,128);if(v->age<2)pf_attack_process(&v->a,tmp,128);
 double energy=0;for(int j=0;j<128;j++){output[j]+=tmp[j];energy+=tmp[j]*tmp[j];}
 v->age+=128/sr;v->level=sqrt(energy/128);if((v->age>.5&&v->level<1e-6)||v->age>24)v->used=0;
 }
 for(int j=0;j<128;j++)output[j]=(float)tanh(output[j]*3);
 return output;
}
