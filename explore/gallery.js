'use strict';
const galleryView=document.getElementById('gallery-view');
const interactiveView=document.getElementById('interactive-view');
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let loadingViewer=null;
function loadScript(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('The viewer could not load. Please try again.'));document.head.append(s);});}
function loadCss(url){return new Promise((resolve,reject)=>{const l=document.createElement('link');l.rel='stylesheet';l.href=url;l.onload=resolve;l.onerror=reject;document.head.append(l);});}
async function openViewer(id='EMD-36039'){
  const url=new URL(location.href);url.searchParams.set('entry',id);history.replaceState(null,'',url);
  galleryView.hidden=true;interactiveView.hidden=false;
  window.scrollTo({top:0,behavior:'instant'});
  try{
    if(!loadingViewer){loadingViewer=(async()=>{await Promise.all([loadCss('https://cdn.jsdelivr.net/npm/molstar@5.12.0/build/viewer/molstar.css'),loadScript('https://cdn.jsdelivr.net/npm/molstar@5.12.0/build/viewer/molstar.js')]);await loadScript('explore.js?v=reference-pair-20261005');})();await loadingViewer;}
    else{await loadingViewer;const select=document.getElementById('entry');if(select.disabled){await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(!select.disabled){clearInterval(timer);resolve();}else if(Date.now()-start>60000){clearInterval(timer);reject(Error('The current target is still loading. Please try again shortly.'));}},100);});}select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}
  }catch(error){document.getElementById('status').textContent=error.message;loadingViewer=null;}
}
function updateMotion(){document.getElementById('motion-toggle').textContent=paused?'Play':'Pause';for(const video of document.querySelectorAll('#gallery-grid video')){if(paused||video.dataset.visible!=='yes')video.pause();else video.play().catch(()=>{});}}
const videoVisibility=new IntersectionObserver(items=>{for(const item of items)item.target.dataset.visible=item.isIntersecting?'yes':'no';updateMotion();},{threshold:.05});
document.getElementById('motion-toggle').onclick=()=>{paused=!paused;updateMotion();};
document.getElementById('enter-explorer').onclick=()=>openViewer();
document.getElementById('back-to-gallery').onclick=()=>{interactiveView.hidden=true;galleryView.hidden=false;const url=new URL(location.href);url.searchParams.delete('entry');url.searchParams.delete('method');history.replaceState(null,'',url);window.scrollTo({top:0,behavior:'instant'});};
(async()=>{try{const response=await fetch('gallery.json?v=8');if(!response.ok)throw Error('The gallery could not load.');const data=await response.json();for(const e of data.entries){const button=document.createElement('button');button.className='gallery-card';button.setAttribute('aria-label',`Inspect ${e.id}, ${e.resolution.toFixed(2)} angstrom resolution`);button.onclick=()=>openViewer(e.id);const image=document.createElement('video');image.poster=e.poster;image.src=e.video;image.width=448;image.height=448;image.preload='none';image.loop=true;image.playbackRate=.8;image.defaultPlaybackRate=.8;image.muted=true;image.defaultMuted=true;image.playsInline=true;image.setAttribute('aria-hidden','true');videoVisibility.observe(image);const label=document.createElement('span');label.className='gallery-card-label';const name=document.createElement('strong');name.textContent=e.id;const detail=document.createElement('span');detail.textContent=e.resolution.toFixed(2)+' Å';label.append(name,detail);button.append(image,label);document.getElementById('gallery-grid').append(button);}updateMotion();}catch(e){document.getElementById('gallery-error').textContent=e.message;}})();
const initial=new URLSearchParams(location.search);if(initial.has('entry'))openViewer(initial.get('entry'));



