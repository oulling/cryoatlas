'use strict';
const $ = id => document.getElementById(id);
const colors = {CryoAtom:0xd4a123, ModelAngelo:0xb05ac6, EMProt:0x279a71, 'E3-CryoFold':0x397bb4, AF3:0xdb906c};
const names = {AF3:'AlphaFold 3'};
let viewer, entries=[], selected, busy=false, volumeRefs=[], modelSpheres=[], modelRefs=[], densityKey='';
const bytesCache = new Map();
const highDensityCache = new Map();
let updateVolumeQueue = Promise.resolve();

function status(message, error=false) {
  $('status').hidden=!error;
  $('status').textContent=message;
  $('status').classList.toggle('error',error);
}
function lock(value) {
  busy=value;
  for(const id of ['search','entry','method','method-second','previous','next','show-gt','show-density','density-detail','load-original','reset','contour','opacity']) $(id).disabled=value;
  for(const button of document.querySelectorAll('[data-example]')) button.disabled=value;
}
async function decompressed(path) {
  if(!bytesCache.has(path)) {
    bytesCache.set(path,(async()=>{
      const response=await fetch(path);
      if(!response.ok) throw new Error(`File unavailable (${response.status}). Please try again later.`);
      return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    })().catch(error=>{bytesCache.delete(path);throw error;}));
    // Keep only a few entries in memory, rather than retaining the entire benchmark.
    if(bytesCache.size>18) bytesCache.delete(bytesCache.keys().next().value);
  }
  return bytesCache.get(path);
}
async function structure(path,label,color,alpha) {
  const plugin=viewer.plugin;
  const content=new TextDecoder().decode(await decompressed(path));
  const data=await plugin.builders.data.rawData({data:content,label},{state:{isGhost:true}});
  modelRefs.push(data.ref);
  const trajectory=await plugin.builders.structure.parseTrajectory(data,'mmcif');
  const model=await plugin.builders.structure.createModel(trajectory);
  const modelStructure=await plugin.builders.structure.createStructure(model,{name:'model',params:{}});
  const polymer=await plugin.builders.structure.tryCreateComponentStatic(modelStructure,'polymer');
  if(!polymer) throw new Error(`No protein cartoon could be created for ${label}.`);
  await plugin.builders.structure.representation.addRepresentation(polymer,{
    type:'cartoon',typeParams:{alpha,quality:'medium'},color:'uniform',colorParams:{value:color}
  });
  modelSpheres.push(modelStructure.cell.obj.data.boundary.sphere);
}
function focusModels() {
  viewer.plugin.managers.camera.focusSpheres(modelSpheres,sphere=>sphere,{extraRadius:6,durationMs:0});
}
async function density() {
  const mode=$('density-detail').value, high=mode==='high', original=mode==='original';
  let bytes;
  if(original) {
    $('density-status').textContent='Downloading and parsing the original EMDB map…';
    await viewer.loadFullResolutionEMDBMap(selected.id,{
      isoValue:{kind:'relative',relativeValue:Number($('contour').value)},color:0x9ca8b8
    });
  } else if(high) {
    $('density-status').textContent='Loading high-detail EMDB density…';
    const box=selected.bounds;
    if(!box) throw new Error('Reference bounds are unavailable. Choose Fast overview.');
    const a=box.min.map(v=>(v-12).toFixed(2)).join(',');
    const b=box.max.map(v=>(v+12).toFixed(2)).join(',');
    const source=`https://maps.rcsb.org/em/${selected.id.toLowerCase()}/box/${a}/${b}?space=cartesian&detail=6`;
    if(!highDensityCache.has(source)) {
      highDensityCache.set(source,(async()=>{
        const response=await fetch(source,{signal:AbortSignal.timeout(45000)});
        if(!response.ok) throw new Error('High-detail EMDB density is unavailable. Choose Fast overview or try again later.');
        return new Uint8Array(await response.arrayBuffer());
      })().catch(error=>{highDensityCache.delete(source);throw error;}));
      if(highDensityCache.size>2) highDensityCache.delete(highDensityCache.keys().next().value);
    }
    bytes=await highDensityCache.get(source);
  } else {
    bytes=await decompressed(selected.density);
    const info=selected.density_info;
    $('density-status').textContent=info?`Coarse overview · ${info.voxel.map(v=>v.toFixed(2)).join(' × ')} Å / voxel`: 'Coarse overview';
  }
  if(!original) {
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  try {
    await viewer.loadVolumeFromUrl({url,format:high?'dscif':'ccp4',isBinary:true},[{
      type:'relative',value:Number($('contour').value),color:0x9ca8b8,alpha:Number($('opacity').value)
    }],{entryId:selected.id});
  } finally { URL.revokeObjectURL(url); }
  }
    volumeRefs=[];
    for(const [ref,cell] of viewer.plugin.state.data.cells) {
      if(cell.transform.transformer.id.includes('volume-representation')) volumeRefs.push(ref);
      if((high||original)&&cell.obj?.data?.grid) {
        const grid=cell.obj.data.grid, dimensions=grid.cells.space.dimensions;
        const transform=grid.transform;
        const spacing=transform.kind==='spacegroup'
          ? Array.from(transform.cell.size,(size,i)=>size*(transform.fractionalBox.max[i]-transform.fractionalBox.min[i])/dimensions[i])
          : [0,1,2].map(i=>Math.hypot(transform.matrix[i*4],transform.matrix[i*4+1],transform.matrix[i*4+2]));
        $('density-status').textContent=`${original?'Original EMDB map':'EMDB high detail'} · ${spacing.map(v=>v.toFixed(2)).join(' × ')} Å / voxel · ${dimensions.join(' × ')} grid`;
      }
    }
    if(original) await changeVolume();
}
function selectedMethods() {
  if($('method-second').value===$('method').value) $('method-second').value='';
  for(const option of $('method-second').options) option.disabled=option.value===$('method').value;
  return [$('method').value,$('method-second').value].filter(Boolean);
}
function scores() {
  const methods=selectedMethods();
  const keys=['gt_score','map_score','geom_score','tm_score','ca_rmsd','sequence_recall'];
  for(const [index,method] of methods.entries()) {
    const values=selected.scores[method]||{};
    for(const [i,dd] of [...$(index?'scores-second':'scores').querySelectorAll('dd')].entries()) {
      const v=values[keys[i]];
      dd.textContent=v==null?'—':keys[i]==='sequence_recall'?`${(v*100).toFixed(1)}%`:keys[i]==='ca_rmsd'?`${v.toFixed(3)} Å`:v.toFixed(3);
    }
    $(index?'second-score-method':'score-method').textContent=names[method]||method;
    $(index?'second-score-method':'score-method').style.color='#'+colors[method].toString(16).padStart(6,'0');
    $(index?'second-prediction-name':'prediction-name').textContent=names[method]||method;
    $(index?'second-prediction-color':'prediction-color').style.background='#'+colors[method].toString(16).padStart(6,'0');
  }
  $('second-score-row').hidden=methods.length<2;
  $('second-legend').hidden=methods.length<2;
}
async function render(preserveCamera=false) {
  if(busy||!selected) return;
  lock(true);
  const methods=selectedMethods(), method=methods[0];
  const camera=preserveCamera?viewer.plugin.canvas3d?.camera.getSnapshot():null;
  status('Loading models…');
  scores();
  $('target-title').textContent=`${selected.id} · ${selected.pdb.toUpperCase()}`;
  $('target-detail').textContent=`${selected.resolution.toFixed(2)} Å · ${selected.residues.toLocaleString()} residues · ${selected.chains} chains`;
  $('emdb-link').href=`https://www.ebi.ac.uk/emdb/${selected.id}`;
  $('original-size').textContent=selected.original_map_bytes?`Expanded map: ${(selected.original_map_bytes/1048576).toFixed(0)} MiB. Download starts only on request.`:'';
  $('map-detail').textContent=`Reference: ${selected.gt_alignment}. ${$('method').value==='AF3'?'AF3: whole-complex rigid USalign superposition.':''}`;
  try {
    const key=`${selected.id}|${$('density-detail').value}|${$('show-density').checked}`;
    const reuseDensity=key===densityKey&&(!$('show-density').checked||volumeRefs.length>0);
    if(reuseDensity) {
      const update=viewer.plugin.build();
      for(const ref of modelRefs) update.delete(ref);
      await update.commit();
    } else {
      await viewer.plugin.clear();
      $('density-status').textContent=$('show-density').checked?'':'Density hidden';
      volumeRefs=[];
      densityKey='';
    }
    modelRefs=[];
    modelSpheres=[];
    if($('show-gt').checked) await structure(selected.assets.GT,'Reference (GT)',0x8895a6,.4);
    const missing=[];
    for(const modelMethod of methods) {
      if(selected.assets[modelMethod]) await structure(selected.assets[modelMethod],names[modelMethod]||modelMethod,colors[modelMethod],1);
      else missing.push(names[modelMethod]||modelMethod);
    }
    focusModels();
    if($('show-density').checked&&!reuseDensity) {
      status($('density-detail').value==='original'?'Loading original-resolution map…':$('density-detail').value==='high'?'Loading high-detail density…':'Loading density preview…');
      try { await density(); }
      catch(error) {
        $('density-status').textContent='Density could not load. Try Fast overview or reload later.';
        status(`Models loaded; density could not load. ${error.message}`,true);
        return;
      }
    }
    densityKey=key;
    if(camera) viewer.plugin.managers.camera.setSnapshot(camera,0);
    else focusModels();
    status(missing.length?`Prediction unavailable: ${missing.join(', ')}.`:'Ready',missing.length>0);
    const url=new URL(location.href); url.searchParams.set('entry',selected.id);url.searchParams.set('method',method);
    if(methods[1]) url.searchParams.set('compare',methods[1]);else url.searchParams.delete('compare');
    history.replaceState(null,'',url);
  } catch(error) { status(error.message,true); }
  finally { lock(false); }
}
function list(query='') {
  const filtered=entries.filter(e=>`${e.id} ${e.pdb} ${e.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  $('entry').replaceChildren(...filtered.map(e=>new Option(`${e.id} · ${e.pdb.toUpperCase()} · ${e.resolution.toFixed(2)} Å`,e.id)));
  if(selected&&filtered.some(e=>e.id===selected.id)) $('entry').value=selected.id;
  if(!filtered.length) $('entry').append(new Option('No matching targets',''));
}
async function choose(id) {
  if(busy) return;
  selected=entries.find(e=>e.id===id);
  if(!selected) return;
  $('density-detail').value='preview';
  $('entry').value=id;
  await render();
}
function changeVolume() {
  updateVolumeQueue=updateVolumeQueue.then(async()=>{
    if(!volumeRefs.length) return;
    const update=viewer.plugin.build();
    for(const ref of volumeRefs) update.to(ref).update(p=>{
      p.type.params.alpha=Number($('opacity').value);
      p.type.params.isoValue={kind:'relative',relativeValue:Number($('contour').value)};
    });
    await update.commit();
  }).catch(error=>status(error.message,true));
  return updateVolumeQueue;
}
async function init() {
  try {
    if(!window.molstar) throw new Error('The 3D viewer library could not load. Check your connection and refresh.');
    if(!window.DecompressionStream) throw new Error('Please use a current version of Chrome, Edge, Firefox, or Safari.');
    const response=await fetch('manifest.json?v=3');
    if(!response.ok) throw new Error('Benchmark target list could not load.');
    entries=(await response.json()).entries;
    viewer=await molstar.Viewer.create('viewer',{
      layoutIsExpanded:false,layoutShowControls:false,layoutShowSequence:false,layoutShowLog:false,layoutShowLeftPanel:false,
      viewportShowExpand:false,viewportShowToggleFullscreen:false,viewportShowSelectionMode:false,viewportShowAnimation:false,
      volumeStreamingDisabled:true,viewportBackgroundColor:'#ffffff'
    });
    list();lock(false);
    const params=new URLSearchParams(location.search);
    if(colors[params.get('method')]) $('method').value=params.get('method');
    if(colors[params.get('compare')]) $('method-second').value=params.get('compare');
    await choose(entries.some(e=>e.id===params.get('entry'))?params.get('entry'):'EMD-36039');
  } catch(error) { status(error.message,true);$('viewer-placeholder')?.replaceChildren(document.createTextNode(error.message)); }
}
$('search').addEventListener('input',()=>list($('search').value));
$('entry').addEventListener('change',()=>choose($('entry').value));
for(const id of ['method','method-second']) $(id).addEventListener('change',()=>render(true));
for(const id of ['show-gt','show-density','density-detail']) $(id).addEventListener('change',()=>render(true));
for(const [id,offset] of [['previous',-1],['next',1]]) $(id).addEventListener('click',()=>{
  const options=[...$('entry').options].map(o=>o.value);const i=options.indexOf(selected?.id);
  choose(options[(i+offset+options.length)%options.length]);
});
for(const button of document.querySelectorAll('[data-example]')) button.addEventListener('click',()=>{
  $('search').value='';list();choose(button.dataset.example);
});
$('reset').addEventListener('click',focusModels);
$('load-original').addEventListener('click',()=>{
  $('show-density').checked=true;
  $('density-detail').value='original';
  render(true);
});
$('contour').addEventListener('input',()=>{$('contour-value').textContent=Number($('contour').value).toFixed(1)+' σ';});
$('opacity').addEventListener('input',()=>{$('opacity-value').textContent=Math.round(Number($('opacity').value)*100)+'%';});
for(const id of ['contour','opacity']) $(id).addEventListener('change',changeVolume);
init();
