function getSlugFromUrl(){
  const params=new URLSearchParams(window.location.search);
  if(params.get('b')) return params.get('b').toLowerCase();
  const parts=window.location.pathname.split('/').filter(Boolean);
  if(parts.length>0){
    const first=parts[0].toLowerCase();
    if(!['admin.html','barbeiro.html','cliente.html','admin','barbeiro','cliente','index.html','hub.html'].includes(first)) return first;
  }
  return localStorage.getItem('dnh_slug')||'dnh';
}
const cfg=window.DNH_CONFIG||{};const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let CURRENT_SLUG=getSlugFromUrl();localStorage.setItem('dnh_slug',CURRENT_SLUG);
let settings={},selectedHora=null;
const $=s=>document.querySelector(s);
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};

const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

async function initCliente(){
  $('#slugInfo').textContent='/'+CURRENT_SLUG;
  if($('#linkAdminCli')) $('#linkAdminCli').href='/'+CURRENT_SLUG+'/admin.html';
  const {data:set}=await sb.from('settings').select('*').eq('slug',CURRENT_SLUG).maybeSingle();
  if(set){settings=set;$('#nomeBarbearia').textContent=set.name||CURRENT_SLUG;if(set.logo_url){const img=$('#logoCliente');img.src=set.logo_url;img.style.display='block';}}
  $('#cliData').value=today();
  const {data:profs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true);
  $('#cliBarbeiro').innerHTML=profs.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')||'<option value="">Sem barbeiro - cadastre no admin</option>';
  const {data:servs=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).eq('active',true);
  $('#cliServico').innerHTML=servs.map(s=>`<option value="${s.id}">${s.name} - ${money(s.price)} (${s.duration}min)</option>`).join('')||'<option value="">Sem serviço - cadastre no admin</option>';

  // Já preenche se já agendou antes nesse celular
  const salvo = JSON.parse(localStorage.getItem('dnh_cliente_'+CURRENT_SLUG)||'null');
  if(salvo){
    $('#cliNome').value = salvo.name || '';
    $('#cliPhone').value = salvo.phone || '';
    if(salvo.birthdate && $('#cliNascimento')) $('#cliNascimento').value = salvo.birthdate;
    $('#msgCli').textContent = 'Olá '+salvo.name+'! Já deixei seus dados preenchidos.';
  }
  await carregarHorarios();
}

async function carregarHorarios(){
  const data=$('#cliData').value;const barb=$('#cliBarbeiro').value;
  const {data:ocup}=await sb.from('bookings').select('booking_time').eq('slug',CURRENT_SLUG).eq('booking_date',data).eq('professional_id',barb).neq('status','cancelled');
  const setOcup=new Set((ocup||[]).map(o=>(o.booking_time||'').slice(0,5)));
  const dia=new Date(data+'T12:00:00').getDay();
  const weekly=settings.weekly_schedule||{};
  const cfgDia=weekly[dia];
  if(cfgDia && cfgDia.enabled===false){ $('#cliHorarios').innerHTML='<small style="color:#f87171">Fechado neste dia</small>'; return; }
  const start=(cfgDia?.start||settings.start_time||'08:00').slice(0,5);
  const end=(cfgDia?.end||settings.end_time||'18:00').slice(0,5);
  const intv=Number(settings.slot_interval||30);
  const lunchS=(settings.lunch_start||'12:00').slice(0,5);
  const lunchE=(settings.lunch_end||'13:00').slice(0,5);
  let h=Number(start.split(':')[0]),m=Number(start.split(':')[1]);
  const [eh,em]=end.split(':').map(Number);
  const [lh,lm]=lunchS.split(':').map(Number);
  const [lhe,lme]=lunchE.split(':').map(Number);
  let html='';
  while(h<eh||(h===eh&&m<em)){
    const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const cur=h*60+m, lS=lh*60+lm, lE=lhe*60+lme;
    if(!(cur>=lS && cur<lE)){
      const ocup=setOcup.has(t);
      html+=`<button data-hora="${t}" style="padding:10px;border-radius:8px;border:1px solid ${ocup?'#333':'#d4af37'};background:${ocup?'#111':'#1e2230'};color:#fff;cursor:pointer;opacity:${ocup?'0.4':'1'}" ${ocup?'disabled':''}>${t}</button>`;
    }
    m+=intv;if(m>=60){m-=60;h++;}
  }
  $('#cliHorarios').innerHTML=html||'<small>Sem horários</small>';
  document.querySelectorAll('[data-hora]').forEach(b=>b.onclick=()=>{selectedHora=b.dataset.hora;document.querySelectorAll('[data-hora]').forEach(x=>{x.style.background='#1e2230';x.style.color='#fff';});b.style.background='#d4af37';b.style.color='#000';});
}

document.addEventListener('click',async e=>{
  if(e.target.id==='btnAgendarCli'){
    const data=$('#cliData').value,barb=$('#cliBarbeiro').value,serv=$('#cliServico').value,nome=$('#cliNome').value.trim(),phone=$('#cliPhone').value.trim();
    const nasc=$('#cliNascimento')?.value || null;
    if(!data||!selectedHora||!nome||!phone||!serv){alert('Preencha data, horário, serviço, nome e telefone');return;}
    const phoneClean=phone.replace(/\D/g,'');

    // Salva / reconhece cliente
    const {data:exist}=await sb.from('customers').select('*').eq('slug',CURRENT_SLUG).eq('phone',phoneClean).maybeSingle();
    if(!exist){
      await sb.from('customers').insert({slug:CURRENT_SLUG, name:nome, phone:phoneClean, birthdate: nasc || null});
    } else if(nasc && !exist.birthdate){
      await sb.from('customers').update({birthdate: nasc}).eq('id', exist.id);
    }
    localStorage.setItem('dnh_cliente_'+CURRENT_SLUG, JSON.stringify({name:nome, phone:phone, birthdate:nasc}));

    const {data:servObj}=await sb.from('services').select('*').eq('id',serv).maybeSingle();
    const {error}=await sb.from('bookings').insert({slug:CURRENT_SLUG,booking_date:data,booking_time:selectedHora,service_id:serv,professional_id:barb,client_name:nome,phone,status:'confirmed',price:servObj?.price||0,paid:false});
    if(error){alert(error.message);return;}
    $('#msgCli').textContent='✅ Agendado! '+nome+' dia '+data.split('-').reverse().join('/')+' às '+selectedHora;
    selectedHora=null;await carregarHorarios();
  }
});

// Ao digitar telefone, busca nome e nascimento automaticamente
$('#cliPhone')?.addEventListener('blur', async ()=>{
  const p = $('#cliPhone').value.replace(/\D/g,'');
  if(p.length<10) return;
  const {data} = await sb.from('customers').select('*').eq('slug',CURRENT_SLUG).eq('phone',p).maybeSingle();
  if(data){
    if(!$('#cliNome').value) $('#cliNome').value = data.name;
    if(data.birthdate && $('#cliNascimento') && !$('#cliNascimento').value) $('#cliNascimento').value = data.birthdate;
  }
});

$('#cliData')?.addEventListener('change',carregarHorarios);
$('#cliBarbeiro')?.addEventListener('change',carregarHorarios);
initCliente();
