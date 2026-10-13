"""Package exact WAV bytes as classic scripts for opaque-origin review proxies."""
from pathlib import Path
import hashlib
import json
ROOT=Path(__file__).resolve().parent
out=ROOT/'audio-data';out.mkdir(exist_ok=True)
report=[]
for wav in sorted((ROOT/'audio').glob('*.wav')):
 data=wav.read_bytes()
 assert data[:4]==b'RIFF' and data[8:12]==b'WAVE'
 # Numeric byte literals contain no author/institution strings for the
 # anonymous service's text redaction to accidentally modify.
 source='audio/'+wav.name
 script='window.DBU_EMBEDDED_AUDIO.register('+json.dumps(source)+',new Uint8Array(['+','.join(map(str,data))+']));\n'
 path=out/(wav.name+'.js');path.write_text(script)
 assert path.stat().st_size<8*1024*1024
 report.append({'src':source,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'payload_bytes':path.stat().st_size})
print('Packaged',len(report),'lossless audio payloads; largest script',max(x['payload_bytes'] for x in report),'bytes')
