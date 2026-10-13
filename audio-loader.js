'use strict';
(() => {
  const loaded=new Map(),pending=new Map();
  function register(source,bytes){
    const valid=bytes instanceof Uint8Array&&bytes.length>44&&
      bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&
      bytes[8]===87&&bytes[9]===65&&bytes[10]===86&&bytes[11]===69;
    if(!valid)throw new Error('Invalid audio payload');
    if(loaded.has(source))return;
    loaded.set(source,URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})));
  }
  function load(source){
    if(loaded.has(source))return Promise.resolve(loaded.get(source));
    if(pending.has(source))return pending.get(source);
    if(!/^audio\/[a-zA-Z0-9-]+\.wav$/.test(source))return Promise.reject(new Error('Unknown audio path'));
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timeout=setTimeout(()=>finish(new Error('Audio loading timed out')),45000);
      function finish(error){
        clearTimeout(timeout);script.remove();
        if(error){reject(error);return;}
        const url=loaded.get(source);
        if(!url){reject(new Error('Audio payload did not register'));return;}
        resolve(url);
      }
      script.src=new URL('audio-data/'+source.slice(6)+'.js',document.baseURI).href;
      script.async=true;script.onload=()=>finish();script.onerror=()=>finish(new Error('Audio script could not be loaded'));
      document.head.append(script);
    }).finally(()=>pending.delete(source));
    pending.set(source,promise);return promise;
  }
  window.DBU_EMBEDDED_AUDIO={register,load};
  window.addEventListener('pagehide',event=>{if(event.persisted)return;for(const url of loaded.values())URL.revokeObjectURL(url);loaded.clear();});
})();
