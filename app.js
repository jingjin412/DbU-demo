'use strict';
(() => {
  const examples = window.DBU_SAMPLES;
  const moods = {
    neutral:{name:'Neutral',color:'#4e6d56'}, happiness:{name:'Happiness',color:'#b49339'},
    angry:{name:'Angry',color:'#c26448'}, sadness:{name:'Sadness',color:'#638ca4'},
    fear:{name:'Fear',color:'#8c80b4'}, disgust:{name:'Disgust',color:'#879247'},
    surprise:{name:'Surprise',color:'#ad7784'}
  };
  const $ = id => document.getElementById(id);
  const audio = $('audio'), referenceAudio = $('reference-audio');
  let kind='utterance',language='all',emotionFilter='all',sample=examples[0];
  let generation=0,pendingSeek=null,currentTurn=-1;
  const time=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function tag(label){const n=el('span','emotion-tag');n.style.setProperty('--mood',moods[label].color);n.append(el('i'),document.createTextNode(moods[label].name));return n;}
  function visible(){return examples.filter(s=>s.kind===kind&&(language==='all'||s.language===language)&&(kind==='dialogue'||emotionFilter==='all'||s.emotion===emotionFilter));}
  function applyFilter(){
    audio.pause();referenceAudio.pause();
    const list=visible();
    if(!list.includes(sample)){sample=list[0];renderDesk();}
    else $('player-status').textContent='Select an example, then press play.';
    renderSamples();
    $('emotion-filter-label').hidden=kind!=='utterance';
    $('list-label').textContent=kind==='utterance'?'Select an excerpt':'Select a dialogue';
    $('selection-note').textContent=kind==='utterance'
      ? 'Actual dataset turns, selected to cover all seven emotion labels in each language.'
      : 'Complete dataset dialogue units. Every turn and speaker is preserved in the original order.';
  }
  function renderSamples(){
    const list=visible();$('sample-count').textContent=String(list.length).padStart(2,'0');
    $('samples').replaceChildren(...list.map((s,i)=>{
      const b=el('button','sample');b.type='button';b.setAttribute('aria-pressed',String(s.id===sample.id));
      b.setAttribute('aria-label',`${s.title}, ${s.language==='zh'?'Mandarin':'English'}`);
      const info=el('span','sample-info');
      info.append(el('strong','',s.title),el('small','',s.kind==='utterance'
        ?`${s.language==='zh'?'Mandarin':'English'} · ${s.speaker}`
        :`${s.language==='zh'?'Mandarin':'English'} · ${s.turns.length} turns · ${s.references.length} speakers`));
      b.append(el('span','sample-number',String(i+1).padStart(2,'0')),info,el('span','sample-active-dot'));
      b.addEventListener('click',()=>{sample=s;renderSamples();renderDesk();});return b;
    }));
  }
  function renderDesk(){
    generation++;pendingSeek=null;currentTurn=-1;audio.pause();referenceAudio.pause();
    $('sample-meta').textContent=`${sample.language==='zh'?'MANDARIN':'ENGLISH'} · ${sample.dataset==='mpdd'?'MPDD':'BAZINGA'}`;
    $('label-source').textContent=sample.label_source;
    $('source-detail').textContent=sample.source_display;
    const full=sample.kind==='dialogue';
    $('utterance-view').hidden=full;$('dialogue-view').hidden=!full;$('dialogue-timing-note').hidden=!full;
    if(!full){
      $('transcript').textContent=sample.text;$('transcript').lang=sample.language==='zh'?'zh-Hant':'en';
      $('translation').textContent=sample.translation?`English translation: ${sample.translation}`:'';
      $('translation').hidden=!sample.translation;$('speaker').textContent=`Speaker: ${sample.speaker}`;
      $('emotion-badge').replaceChildren(tag(sample.emotion));setMood(sample.emotion,sample.speaker);
    }else{
      $('dialogue-title').textContent=sample.title;
      $('dialogue-summary').textContent=`${sample.turns.length} turns · ${sample.references.length} speakers · ${new Set(sample.turns.map(t=>t.emotion)).size} emotion labels · ${time(sample.audio.duration)}`;
      $('dialogue-turns').replaceChildren(...sample.turns.map((turn,i)=>{
        const button=el('button','dialogue-turn');button.type='button';button.dataset.turn=i;
        button.setAttribute('aria-label',`Jump to turn ${i+1}, ${turn.speaker}, ${moods[turn.emotion].name}`);
        button.setAttribute('aria-current','false');
        const body=el('span','turn-body'),meta=el('span','turn-meta');meta.append(el('strong','',turn.speaker),tag(turn.emotion));
        const text=el('span','turn-text',turn.text);text.lang=sample.language==='zh'?'zh-Hant':'en';body.append(meta,text);
        if(turn.translation)body.append(el('span','turn-translation',turn.translation));
        button.append(el('span','turn-number',String(i+1).padStart(2,'0')),body,el('span','turn-time',time(turn.start)));
        button.addEventListener('click',()=>{seekTo(turn.start);playAudio();});return button;
      }));
      updateTurn(0);
    }
    const refs=full?sample.references:[{speaker:sample.speaker,...sample.reference}];
    $('reference-select-label').hidden=refs.length<2;
    $('reference-select').replaceChildren(...refs.map((ref,i)=>{const option=el('option','',ref.speaker);option.value=i;return option;}));
    setReference(refs[0]);
    audio.src=sample.audio.src;audio.load();
    $('waveform').replaceChildren(...sample.audio.waveform.map(v=>{const bar=el('i');bar.style.height=`${Math.max(4,v*46)}px`;return bar;}));
    $('seek').value=0;$('current-time').textContent='0:00';$('total-time').textContent=time(sample.audio.duration);
    $('player-status').textContent=full?'Press play to hear the complete dialogue.':'Press play to hear this script excerpt.';
    updatePlayback();
  }
  function setReference(ref){referenceAudio.pause();referenceAudio.src=ref.src;referenceAudio.load();$('reference-speaker').textContent=`· ${ref.speaker}`;$('reference-status').textContent='';}
  function setMood(label,speaker){$('playing-label').textContent=moods[label].name;$('playing-note').textContent=speaker;$('player-box').style.setProperty('--mood',moods[label].color);$('mood-dot').style.backgroundColor=moods[label].color;}
  function updateTurn(seconds){
    if(sample.kind!=='dialogue')return;
    let index=sample.turns.findLastIndex(t=>t.start<=seconds);if(index<0)index=0;
    if(index===currentTurn)return;currentTurn=index;const turn=sample.turns[index];
    setMood(turn.emotion,`Turn ${index+1} · ${turn.speaker}`);
    [...$('dialogue-turns').children].forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));
    if(!audio.paused){const b=$('dialogue-turns').children[index],container=$('dialogue-turns');
      const rect=b.getBoundingClientRect(), bounds=container.getBoundingClientRect();
      if(rect.top<bounds.top||rect.bottom>bounds.bottom)container.scrollTop+=rect.top-bounds.top-20;
    }
  }
  function seekTo(seconds){referenceAudio.pause();
    if(audio.readyState>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(seconds,audio.duration);
    else{pendingSeek=seconds;audio.load();}updateTurn(seconds);
  }
  async function playAudio(){const version=generation;referenceAudio.pause();$('player-status').textContent='Loading audio…';
    try{await audio.play();}catch(error){if(version!==generation||error.name==='AbortError')return;$('player-status').textContent='Playback could not start. Press play to try again.';updatePlayback();}
  }
  function updatePlayback(){$('play-symbol').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',audio.paused?'Play audio':'Pause audio');$('play').setAttribute('aria-pressed',String(!audio.paused));}
  function updateProgress(){const duration=Number.isFinite(audio.duration)?audio.duration:sample.audio.duration;const fraction=duration>0?Math.min(1,audio.currentTime/duration):0;
    $('seek').value=Math.round(fraction*1000);$('seek').setAttribute('aria-valuetext',`${time(audio.currentTime)} / ${time(duration)}`);
    $('current-time').textContent=time(audio.currentTime);$('total-time').textContent=time(duration);
    [...$('waveform').children].forEach((b,i,all)=>b.classList.toggle('played',i/all.length<fraction));updateTurn(audio.currentTime);
  }
  $('play').addEventListener('click',()=>{if(audio.paused)playAudio();else{audio.pause();$('player-status').textContent='Paused. Press play to continue.';}});
  $('restart').addEventListener('click',()=>{seekTo(0);playAudio();});
  $('seek').addEventListener('input',()=>seekTo(Number($('seek').value)/1000*(Number.isFinite(audio.duration)?audio.duration:sample.audio.duration)));
  $('reference-select').addEventListener('change',()=>setReference(sample.references[Number($('reference-select').value)]));
  audio.addEventListener('playing',()=>{if(audio.paused||audio.ended)return;referenceAudio.pause();updatePlayback();$('player-status').textContent=sample.kind==='dialogue'?'Playing the complete dialogue.':'Playing the script excerpt.';});
  audio.addEventListener('pause',updatePlayback);audio.addEventListener('timeupdate',updateProgress);
  audio.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){audio.currentTime=Math.min(pendingSeek,audio.duration);pendingSeek=null;}updateProgress();});
  audio.addEventListener('ended',()=>{updatePlayback();$('player-status').textContent=sample.kind==='dialogue'?'Full dialogue playback complete.':'Excerpt playback complete.';});
  audio.addEventListener('waiting',()=>{if(!audio.paused)$('player-status').textContent='Buffering audio…';});
  audio.addEventListener('error',()=>{$('player-status').textContent='Audio could not be loaded. Select another example and try again.';updatePlayback();});
  referenceAudio.addEventListener('playing',()=>{if(referenceAudio.paused||referenceAudio.ended)return;audio.pause();$('reference-status').textContent='Playing the original reference voice.';$('player-status').textContent='Generated audio paused while the reference plays.';});
  referenceAudio.addEventListener('pause',()=>{$('reference-status').textContent='';});
  referenceAudio.addEventListener('ended',()=>{$('reference-status').textContent='Reference playback complete.';});
  referenceAudio.addEventListener('error',()=>{$('reference-status').textContent='Reference audio could not be loaded. Please select another speaker.';});
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{language=button.dataset.lang;document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));applyFilter();}));
  document.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.kind;document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));applyFilter();}));
  $('emotion-filter').addEventListener('change',()=>{emotionFilter=$('emotion-filter').value;applyFilter();});
  document.addEventListener('keydown',event=>{if(event.code!=='Space'||/^(INPUT|BUTTON|A|TEXTAREA|SELECT|AUDIO|VIDEO)$/.test(event.target.tagName)||event.target.isContentEditable)return;event.preventDefault();$('play').click();});
  $('hero-wave').replaceChildren(...examples[0].audio.waveform.slice(0,56).map((v,i)=>{const b=el('i');b.style.height=`${8+v*100+Math.sin(i*.4)*8}px`;return b;}));
  renderSamples();renderDesk();
})();
