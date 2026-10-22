const cfg = window.DNH_CONFIG || {};
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let profile = null;
let settings = { name: 'DNH BARBEARIA', whatsapp: '', start_time: '08:00', end_time: '18:00', slot_interval: 30, logo_url: 'dnh-logo.png', weekly_schedule: {}, slug: 'dnh', lunch_start: '12:00', lunch_end: '13:00' };
let services = []; let professionals = []; let financeChart = null; let currentManageSlug = null; let selectedPlano = 'profissional'; let selectedPlanoValor = 97.90;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function getSlug(){ const p=new URLSearchParams(window.location.search); const s=p.get('b'); if(s){ localStorage.setItem('dnh_slug', s); return s; } return localStorage.getItem('dnh_slug')||'dnh'; }
const CURRENT_SLUG=getSlug();
const today=()=>{ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escapeHtml=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function timeToMinutes(t){ const[h,m]=String(t||'0:0').split(':').map(Number); return (h||0)*60+(m||0); }
function isSuperAdmin(){ const list=(cfg.superAdmins||[]).map(e=>e.toLowerCase()); return profile && list.includes((profile.email||'').toLowerCase()); }
function toast(m){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=m; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3500); }
function getWeeklySchedule(){ const f=(e,s,en)=>({enabled:e,start:s,end:en}); const st=settings.start_time?.slice(0,5)||'08:00'; const en=settings.end_time?.slice(0,5)||'18:00'; const fb={0:f(false,st,en),1:f(true,st,en),2:f(true,st,en),3:f(true,st,en),4:f(true,st,en),5:f(true,st,en),6:f(false,st,en)}; const cur=settings.weekly_schedule||{}; return Object.fromEntries(Object.keys(fb).map(k=>[k,{...fb[k],...(cur[k]||{})}])); }
function scheduleForDate(d){ const dt=new Date(d+'T12:00:00'); return getWeeklySchedule()[dt.getDay()]||{enabled:true,start:'08:00',end:'18:00'}; }
function aplicarPermissoesUI(){
  const superAdmin=isSuperAdmin();
  $$('.sidebar .nav button, .mobile-nav button').forEach(el=>el.style.display='none');
  $$('.sidebar .nav').forEach(el=>el.style.display='flex');
  if(superAdmin){
    $$('.superadmin-only').forEach(el=>el.style.display='');
    const rl=$('#roleLabel'); if(rl) rl.textContent='GESTORA DE LICENÇAS';
    const bn=$('#brandName'); if(bn) bn.innerHTML='<b>BARBERPRO</b><small>MASTER PANEL</small>';
    localStorage.removeItem('dnh_admin_view');
  }else if(profile?.role==='admin'){
    $$('.admin-only').forEach(el=>el.style.display='');
    const rl=$('#roleLabel'); if(rl) rl.textContent='Admin - '+CURRENT_SLUG;
    const bn=$('#brandName'); if(bn) bn.innerHTML='<b>'+escapeHtml(settings.name||CURRENT_SLUG)+'</b>';
  }else{
    $$('.client-only').forEach(el=>el.style.display='');
    const rl=$('#roleLabel'); if(rl) rl.textContent='Cliente';
    const bn=$('#brandName'); if(bn) bn.innerHTML='<b>'+escapeHtml(settings.name||'DNH')+'</b>';
  }
}
async function user(){
  const{data:{user:au}}=await sb.auth.getUser();
  if(!au){ profile=null; return null; }
  const{data}=await sb.from('profiles').select('*').eq('id',au.id).maybeSingle();
  if(data){ profile=data; }
  else{
    const md=au.user_metadata||{};
    const fb={id:au.id,name:md.name||au.email?.split('@')[0]||'Cliente',phone:md.phone||'',email:au.email||'',role:'client',active:true};
    const{data:r}=await sb.from('profiles').upsert(fb,{onConflict:'id'}).select('*').maybeSingle();
    profile=r||fb;
  }
  return profile;
}
function go(page){
  if(!profile) return;
  $$('.page').forEach(p=>p.classList.remove('active'));
  const t=$('#page-'+page); if(t) t.classList.add('active');
  $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(page==='dashboard') dashboard();
  if(page==='agenda') agenda();
  if(page==='consultar') consultarAgenda();
  if(page==='services') loadServices();
  if(page==='clients') loadClients();
  if(page==='stock') loadStock();
  if(page==='finance') loadFinance();
  if(page==='team') loadTeam();
  if(page==='settings') loadSettings();
  if(page==='superadmin') loadBarbershops();
  if(page==='superadmin-cadastro') loadBarbershops();
  if(page==='superadmin-financeiro') loadSuperFinance();
}
async function loadSettings(){
  let data=null;
  try{ const r=await sb.from('settings').select('*').eq('slug',CURRENT_SLUG).maybeSingle(); if(r.data) data=r.data; }catch(e){}
  if(!data){ const{data:fb}=await sb.from('settings').select('*').eq('id',1).maybeSingle(); data=fb; }
  if(data){ settings={...settings,...data,slug:data.slug||CURRENT_SLUG}; }
  if($('#setName')) $('#setName').value=settings.name||'DNH';
  if($('#setWhatsapp')) $('#setWhatsapp').value=settings.whatsapp||'';
  if($('#setStart')) $('#setStart').value=settings.start_time?.slice(0,5)||'08:00';
  if($('#setEnd')) $('#setEnd').value=settings.end_time?.slice(0,5)||'18:00';
  if($('#setInterval')) $('#setInterval').value=settings.slot_interval||30;
  if($('#setLogoUrl')) $('#setLogoUrl').value=settings.logo_url||'';
  if($('#setLunchStart')) $('#setLunchStart').value=settings.lunch_start?.slice(0,5)||'12:00';
  if($('#setLunchEnd')) $('#setLunchEnd').value=settings.lunch_end?.slice(0,5)||'13:00';
  if($('#shareUrl')){ const b=location.href.split('?')[0]; $('#shareUrl').textContent=b+'?b='+CURRENT_SLUG; }
  if($('#brandLogo')) $('#brandLogo').src=settings.logo_url||'dnh-logo.png';
  if($('#weeklyBox') && !$('#weeklyBox').dataset.done){
    const w=getWeeklySchedule();
    let h='';
    Object.entries({1:'Segunda',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado',0:'Domingo'}).forEach(([k,n])=>{
      const c=w[k]||{};
      h+=`<div class="day-row" data-weekday="${k}"><b>${n}</b><label><input type="checkbox" data-week-enabled ${c.enabled!==false?'checked':''}> Atende</label><input type="time" data-week-start value="${c.start||'08:00'}"><input type="time" data-week-end value="${c.end||'18:00'}"></div>`;
    });
    $('#weeklyBox').innerHTML=h;
    $('#weeklyBox').dataset.done='1';
  }
}
async function loadServices(){
  const{data=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).order('name');
  services=data||[];
  if($('#serviceList')){ $('#serviceList').innerHTML=!services.length?'<p class="muted">Nenhum</p>':services.map(s=>`<div class="list-row"><div><b>${escapeHtml(s.name)}</b><small>${money(s.price)}</small></div><div><button data-service-edit="${s.id}">Editar</button><button class="danger" data-service-delete="${s.id}">Excluir</button></div></div>`).join(''); }
  if($('#clientService')){ const cur=$('#clientService').value; $('#clientService').innerHTML=`<option value="">Selecione</option>${services.filter(s=>s.active!==false).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}`; if(cur) $('#clientService').value=cur; }
}
async function loadProfessionals(){
  const{data=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true).order('name');
  professionals=data||[];
  if($('#clientProfessional')){ const cur=$('#clientProfessional').value; $('#clientProfessional').innerHTML=`<option value="">Selecione</option>${professionals.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} ${p.perfil?' - '+p.perfil:''}</option>`).join('')}`; if(cur) $('#clientProfessional').value=cur; }
}
async function dashboard(){
  const{data:books=[]}=await sb.from('bookings').select('*').eq('slug',CURRENT_SLUG).eq('booking_date',today());
  const{count}=await sb.from('profiles').select('*',{count:'exact',head:true}).eq('role','client');
  const{data:fin=[]}=await sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).gte('entry_date',today().slice(0,7)+'-01');
  if($('#kToday')) $('#kToday').textContent=books.filter(x=>x.status==='confirmed').length;
  if($('#kClients')) $('#kClients').textContent=count||0;
  if($('#kRevenue')) $('#kRevenue').textContent=money(fin.filter(x=>x.type==='income').reduce((a,b)=>a+Number(b.amount||0),0));
  if($('#todayList')) $('#todayList').innerHTML=books.length?books.map(b=>`<div class="list-row"><b>${(b.booking_time||'').slice(0,5)}</b></div>`).join(''):'<p class="muted">Nenhum hoje</p>';
}
async function agenda(){
  await loadSettings(); await loadProfessionals();
  if(profile?.role==='admin'||isSuperAdmin()){
    const a=$('#adminAgenda'); const c=$('#clientAgenda');
    if(c) c.classList.add('hidden');
    if(a){
      a.classList.remove('hidden');
      a.innerHTML=`<div><h1>Agenda ${CURRENT_SLUG} - Admin</h1><div id="adminAgendaCalendar"><p class="muted">Carregando...</p></div></div>`;
      const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time');
      a.querySelector('#adminAgendaCalendar').innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div style="display:flex;gap:6px;"><button data-pay="${b.id}" style="background:#22a861;color:#fff;">💰 Pagamento</button><button class="danger" data-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>';
    }
    return;
  }
  $('#clientAgenda')?.classList.remove('hidden'); $('#adminAgenda')?.classList.add('hidden');
  await loadServices(); initClientBooking(); await loadClientTimes();
}
function initClientBooking(){ const d=$('#clientDate'); if(!d) return; d.value=today(); d.min=today(); }
async function loadClientTimes(){
  const sid=$('#clientService')?.value; const pid=$('#clientProfessional')?.value; const date=$('#clientDate')?.value; const grid=$('#clientTimeGrid'); if(!grid) return;
  if(!sid||!pid||!date){ grid.innerHTML='<p class="muted">Selecione tudo</p>'; return; }
  const svc=services.find(s=>s.id===sid); const dur=Number(svc?.duration)||30;
  const ds=scheduleForDate(date); if(ds.enabled===false){ grid.innerHTML='<p class="muted">Não atende</p>'; return; }
  const op=timeToMinutes(ds.start||'08:00'); const cl=timeToMinutes(ds.end||'18:00');
  const lunchS=timeToMinutes(settings.lunch_start||'12:00'); const lunchE=timeToMinutes(settings.lunch_end||'13:00');
  const inter=Number(settings.slot_interval)||30;
  const{data:books=[]}=await sb.from('bookings').select('booking_time,service_id').eq('slug',CURRENT_SLUG).eq('professional_id',pid).eq('booking_date',date).neq('status','cancelled');
  const occ=books.map(b=>{ const st=timeToMinutes(String(b.booking_time).slice(0,5)); const bs=services.find(s=>s.id===b.service_id); return{start:st,end:st+(Number(bs?.duration)||30)}; });
  const avail=[]; const now=new Date(); const curMin=now.getHours()*60+now.getMinutes();
  for(let st=op; st+dur<=cl; st+=inter){
    if(date===today() && st<=curMin) continue;
    if(st>=lunchS && st<lunchE) continue;
    const en=st+dur;
    if(occ.some(o=>st<o.end && en>o.start)) continue;
    const hh=String(Math.floor(st/60)).padStart(2,'0'); const mm=String(st%60).padStart(2,'0'); avail.push(`${hh}:${mm}`);
  }
  grid.innerHTML=avail.length?avail.map(t=>`<button class="time-option" data-booking-time="${t}">${t}</button>`).join(''):'<p class="muted">Sem horário</p>';
}
function atualizarResumo(t){
  const s=services.find(x=>x.id===$('#clientService')?.value);
  const p=professionals.find(x=>x.id===$('#clientProfessional')?.value);
  if($('#summaryService')) $('#summaryService').textContent=s?.name||'-';
  if($('#summaryProfessional')) $('#summaryProfessional').textContent=p?.name||'-';
  if($('#summaryDate')){ const d=$('#clientDate')?.value; if(d){ const[y,m,dd]=d.split('-'); $('#summaryDate').textContent=`${dd}/${m}/${y}`; } }
  if($('#summaryTime')) $('#summaryTime').textContent=t||'';
  if($('#bookingSummary')){ if(t) $('#bookingSummary').classList.remove('hidden'); else $('#bookingSummary').classList.add('hidden'); }
}
async function createBooking(){
  const sid=$('#clientService')?.value; const pid=$('#clientProfessional')?.value; const date=$('#clientDate')?.value; const time=$('#summaryTime')?.textContent?.trim();
  if(!sid||!pid||!date||!time){ alert('Selecione tudo'); return; }
  const{data:{user:au}}=await sb.auth.getUser(); if(!au) return;
  const{data:ex}=await sb.from('bookings').select('id').eq('slug',CURRENT_SLUG).eq('professional_id',pid).eq('booking_date',date).eq('booking_time',time+':00').neq('status','cancelled').maybeSingle();
  if(ex){ toast('Ocupado'); return; }
  const{error}=await sb.from('bookings').insert({user_id:au.id,service_id:sid,professional_id:pid,booking_date:date,booking_time:time+':00',status:'confirmed',slug:CURRENT_SLUG});
  if(error){ toast(error.message); return; }
  toast('Confirmado!'); await consultarAgenda();
}
async function consultarAgenda(){
  const list=$('#clientBookingsList'); if(!list) return;
  list.innerHTML='<p class="muted">Carregando...</p>';
  const{data:{user:au}}=await sb.auth.getUser(); if(!au) return;
  const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('user_id',au.id).eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time');
  list.innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div><button class="danger" data-client-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>';
}
async function loadClients(){
  const{data=[]}=await sb.from('profiles').select('*').order('name');
  if($('#clientList')){ $('#clientList').innerHTML=data.map(c=>`<div class="list-row"><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.email||'')} • ${c.role}</small></div></div>`).join('')||'<p class="muted">Nenhum</p>'; }
}
async function loadStock(){
  const{data=[]}=await sb.from('inventory').select('*').eq('slug',CURRENT_SLUG).order('name');
  if($('#stockList')){ $('#stockList').innerHTML=data.map(x=>{ const qty=Number(x.quantity)||0; const min=Number(x.min_quantity)||5; const isLow=qty<=min; return `<div class="list-row ${isLow?'low-stock':''}"><div><b>${escapeHtml(x.name)}</b><small>Qtd: ${qty} | Mín: ${min} ${isLow?'<span class="stock-alert">BAIXO</span>':''}</small></div><div><button data-stock-entry="${x.id}">+ Entrada</button><button data-stock-exit="${x.id}">- Saída</button></div></div>`; }).join('')||'<p class="muted">Nenhum</p>'; }
}
async function registrarMovimento(id,t){
  const{data:item}=await sb.from('inventory').select('*').eq('id',id).maybeSingle(); if(!item) return;
  const raw=prompt('Qtd:'); const q=Number(String(raw||'').replace(',','.')); if(!q) return;
  const cur=Number(item.quantity)||0; const next=t==='in'?cur+q:cur-q; if(next<0){ toast('Insuficiente'); return; }
  await sb.from('inventory_movements').insert({inventory_id:id,type:t,quantity:q});
  await sb.from('inventory').update({quantity:next}).eq('id',id); await loadStock();
}
async function loadFinance(){
  const start=$('#financeStart')?.value; const end=$('#financeEnd')?.value;
  let query=sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).order('entry_date',{ascending:true});
  if(start) query=query.gte('entry_date',start); if(end) query=query.lte('entry_date',end);
  const{data=[]}=await query;
  const inc=data.filter(x=>x.type==='income').reduce((a,b)=>a+Number(b.amount||0),0);
  const exp=data.filter(x=>x.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0);
  if($('#sumIncome')) $('#sumIncome').textContent=money(inc);
  if($('#sumExpense')) $('#sumExpense').textContent=money(exp);
  if($('#sumBalance')) $('#sumBalance').textContent=money(inc-exp);
  if($('#financeList')){ $('#financeList').innerHTML=data.slice(-30).reverse().map(x=>`<div class="list-row"><b>${escapeHtml(x.description)}</b><span>${x.type==='income'?'+':'-'}${money(x.amount)} - ${x.entry_date}</span></div>`).join('')||'<p class="muted">Sem lançamentos</p>'; }
}
async function loadTeam(){
  const{data=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).order('name');
  if($('#teamList')){ $('#teamList').innerHTML=data.map(x=>`<div class="list-row"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.email||'') } - ${x.perfil}</small></div><div><button class="danger" data-team-delete="${x.id}">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhum</p>'; }
  professionals=data;
}
async function excluirProfissional(id){ if(!confirm('Excluir?')) return; await sb.from('professionals').delete().eq('id',id).eq('slug',CURRENT_SLUG); await loadTeam(); }

async function loadBarbershops(){
  if(!isSuperAdmin()) return;
  const {data:shops, error} = await sb.from('barbershops').select('*').order('created_at',{ascending:false});
  if(error){
    const el=$('#barbershopList');
    if(el) el.innerHTML='<p>Erro: '+escapeHtml(error.message)+'</p>';
    return;
  }
  const listShops = shops || [];
  const base=location.href.split('?')[0];
  const todayStr=today();
  const in7Days=new Date(); in7Days.setDate(in7Days.getDate()+7);
  const in7Str=in7Days.toISOString().slice(0,10);

  const ativas=listShops.filter(s=>s.active!==false).length;
  const trial=listShops.filter(s=> (s.plano||'trial')==='trial').length;
  const mrr=listShops.filter(s=>s.active!==false && s.plano!=='trial').reduce((a,b)=>a+Number(b.plano_valor||0),0);
  const atraso=listShops.filter(s=> s.data_vencimento && s.data_vencimento < todayStr && s.status_pagamento!=='pago').length;

  if($('#metricAtivas')) $('#metricAtivas').textContent=ativas;
  if($('#metricTrial')) $('#metricTrial').textContent=trial;
  if($('#metricMRR')) $('#metricMRR').textContent=money(mrr);
  if($('#metricAtraso')) $('#metricAtraso').textContent=atraso;

  const vencendo=listShops.filter(s=> s.data_vencimento && s.data_vencimento >= todayStr && s.data_vencimento <= in7Str).sort((a,b)=>a.data_vencimento.localeCompare(b.data_vencimento));
  const listEl=$('#barbershopList');
  if(!listEl) return;

  if(document.querySelector('#page-superadmin.active')){
    listEl.innerHTML=vencendo.length?vencendo.map(b=>`<div class="list-row"><div><b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.slug)} • Vence: ${b.data_vencimento} • ${escapeHtml(b.plano||'trial')} ${money(b.plano_valor||0)} • ${escapeHtml(b.owner_email||'')}</small></div><div style="display:flex;gap:6px;"><button data-manage-shop="${b.slug}" class="btn gold">Gerenciar</button><button data-copy-link="${base}?b=${b.slug}">Link</button></div></div>`).join(''):'<p class="muted">Nenhuma vencendo nos próximos 7 dias</p>';
  }

  const shopSelect=$('#superFinanceShopFilter');
  if(shopSelect && shopSelect.options.length===1){
    listShops.forEach(s=>{ const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; shopSelect.appendChild(opt); });
  }
}

async function openManageShopModal(slug){
  currentManageSlug=slug;
  const{data:shop}=await sb.from('barbershops').select('*').eq('slug',slug).maybeSingle();
  if(!shop){ toast('Não encontrada'); return; }
  const nameEl=$('#mShopName'); if(nameEl) nameEl.value=shop.name||'';
  const slugEl=$('#mShopSlug'); if(slugEl) slugEl.value=shop.slug||'';
  const logoEl=$('#mShopLogo'); if(logoEl) logoEl.value=shop.logo_url||'';
  const ownerEl=$('#mShopOwner'); if(ownerEl) ownerEl.value=shop.owner_email||'';
  const activeEl=$('#mShopActive'); if(activeEl) activeEl.checked=shop.active!==false;
  const titleEl=$('#manageShopTitle'); if(titleEl) titleEl.textContent='Gerenciar: '+shop.name;
  const base=location.href.split('?')[0];
  if($('#mShopLink')) $('#mShopLink').textContent=base+'?b='+shop.slug;
  const{data:admins=[]}=await sb.from('professionals').select('*').eq('slug',slug).order('name');
  const listAdminEl=$('#mShopAdminsList');
  if(listAdminEl){
    listAdminEl.innerHTML=admins.length?admins.map(a=>`<div class="list-row" style="padding:10px 12px;margin:0;background:#1e1e1e;border-color:#2a2a2a;"><div><b style="color:#fff">${escapeHtml(a.name)}</b><small style="display:block;color:#aaa">${escapeHtml(a.email||'sem email')} • ${escapeHtml(a.perfil)} • ${escapeHtml(a.phone||'')}</small></div><div style="display:flex;gap:6px;"><button data-resend="${a.email}" style="padding:6px 8px;font-size:11px;background:#222;color:#d4af37;border:1px solid #d4af37;">Reenviar Acesso</button><button class="danger" data-remove-admin="${a.id}" style="padding:6px 8px;font-size:11px;">Remover</button></div></div>`).join(''):'<div style="padding:12px;text-align:center;color:#666;background:#1a1a1a;border-radius:10px;border:1px dashed #333;">Nenhum admin</div>';
  }
  const modal=$('#manageShopModal');
  if(modal){ modal.classList.remove('hidden'); modal.style.display='flex'; }
}
async function saveManageShop(){
  if(!currentManageSlug) return;
  const payload={
    name: $('#mShopName') ? $('#mShopName').value.trim() : '',
    logo_url: $('#mShopLogo') ? $('#mShopLogo').value.trim()||'dnh-logo.png' : 'dnh-logo.png',
    owner_email: $('#mShopOwner') ? $('#mShopOwner').value.trim()||null : null,
    active: $('#mShopActive') ? $('#mShopActive').checked : true
  };
  const{error}=await sb.from('barbershops').update(payload).eq('slug',currentManageSlug);
  if(error){ toast(error.message); return; }
  await sb.from('settings').update({name:payload.name,logo_url:payload.logo_url}).eq('slug',currentManageSlug);
  toast('Barbearia atualizada');
  const modal=$('#manageShopModal');
  if(modal){ modal.style.display='none'; modal.classList.add('hidden'); }
  await loadBarbershops(); await loadSuperFinance();
}
async function addShopAdmin(){
  if(!currentManageSlug) return;
  const nameEl=$('#mNewAdminName'); const emailEl=$('#mNewAdminEmail'); const phoneEl=$('#mNewAdminPhone'); const perfilEl=$('#mNewAdminPerfil');
  const name=nameEl ? nameEl.value.trim() : '';
  const email=emailEl ? emailEl.value.trim().toLowerCase() : '';
  const phone=phoneEl ? phoneEl.value.trim() : '';
  const perfil=perfilEl ? perfilEl.value : 'admin';
  if(!name||!email){ toast('Nome e E-mail obrigatórios'); return; }
  const btn=$('#mAddAdminBtn'); if(btn){ btn.textContent='Criando e enviando e-mail...'; btn.disabled=true; }
  const tempPass = Math.random().toString(36).slice(-8)+'A1!b2@';
  let userId = null;
  try{
    const { data } = await sb.auth.signUp({ email, password: tempPass, options: { data: { name, phone, role: 'admin' } } });
    if(data && data.user && data.user.id) userId=data.user.id;
  }catch(e){}
  try{ await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); }catch(e){}
  try{
    const { error } = await sb.from('professionals').insert({ name, phone, email, perfil, slug: currentManageSlug, active: true });
    if(error && error.message.includes('duplicate')){
      await sb.from('professionals').update({ name, phone, perfil, active: true }).eq('email', email).eq('slug', currentManageSlug);
    }
  }catch(e){}
  try{
    if(userId){
      await sb.from('profiles').upsert({ id: userId, name, phone, email, role: 'admin', active: true, barbershop_slug: currentManageSlug }, { onConflict: 'id' });
    } else {
      const { data: existing } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
      if(existing && existing.id){
        await sb.from('profiles').update({ role: 'admin', barbershop_slug: currentManageSlug, name, phone }).eq('id', existing.id);
      }
    }
  }catch(e){}
  if(btn){ btn.textContent='✉️ Criar ADM e Enviar Acesso por E-mail'; btn.disabled=false; }
  toast('ADM criado! E-mail enviado para '+email);
  if(nameEl) nameEl.value=''; if(emailEl) emailEl.value=''; if(phoneEl) phoneEl.value='';
  await openManageShopModal(currentManageSlug);
}
async function removeShopAdmin(id){ if(!confirm('Remover?')) return; await sb.from('professionals').delete().eq('id',id); toast('Removido'); await openManageShopModal(currentManageSlug); }
async function resendAccess(email){ if(!email || email==='sem email'){ toast('Sem e-mail'); return; } const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); if(error){ toast('Erro: '+error.message); } else { toast('Link reenviado para '+email); } }
async function excluirBarbearia(id){ if(!confirm('Excluir barbearia?')) return; const{error}=await sb.from('barbershops').delete().eq('id',id); if(error){ toast(error.message); return; } toast('Excluída'); await loadBarbershops(); await loadSuperFinance(); }

async function loadSuperFinance(){
  if(!isSuperAdmin()) return;
  const{data:shops=[]}=await sb.from('barbershops').select('*').order('name');
  const{data:pays=[]}=await sb.from('barbershop_payments').select('*').order('payment_date',{ascending:false});
  const shopSelect=$('#superFinanceShopFilter');
  if(shopSelect && shopSelect.options.length===1){
    (shops||[]).forEach(s=>{ const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; shopSelect.appendChild(opt); });
  }
  const shopFilter=$('#superFinanceShopFilter') ? $('#superFinanceShopFilter').value : '';
  const startFilter=$('#superFinanceStart') ? $('#superFinanceStart').value : '';
  const endFilter=$('#superFinanceEnd') ? $('#superFinanceEnd').value : '';
  let filteredPays=[...(pays||[])];
  if(shopFilter) filteredPays=filteredPays.filter(p=>p.barbershop_slug===shopFilter);
  if(startFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) >= startFilter );
  if(endFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) <= endFilter );
  const totalFiltered=filteredPays.reduce((a,b)=>a+Number(b.amount||0),0);
  const summaryEl=$('#superFinanceSummary');
  if(summaryEl){
    summaryEl.innerHTML=`<div class="metric-card"><small>Filtrado</small><b>${filteredPays.length} pagamentos</b></div><div class="metric-card"><small>Total no intervalo</small><b>${money(totalFiltered)}</b></div><div class="metric-card"><small>Período</small><b style="font-size:12px">${startFilter||'início'} até ${endFilter||'hoje'}</b></div>`;
  }
  const list=$('#superFinanceList'); if(!list) return;
  if(!shops || shops.length===0){ list.innerHTML='<p class="muted">Nenhuma barbearia</p>'; return; }
  const shopsToShow=shopFilter ? shops.filter(s=>s.slug===shopFilter) : shops;
  let html=shopsToShow.map(shop=>{
    const shopPays=filteredPays.filter(p=>p.barbershop_slug===shop.slug);
    const allShopPays=(pays||[]).filter(p=>p.barbershop_slug===shop.slug);
    const todayStr=today();
    const paidThisMonth=allShopPays.some(p=>p.month_ref===todayStr.slice(0,7));
    const statusText=paidThisMonth?`PAGO MES ATUAL`:`PENDENTE`;
    const history=shopPays.map(p=>{
      const d=new Date(p.payment_date);
      const dataHora=d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px dashed #222;align-items:center;"><span>${dataHora} - Ref: ${p.month_ref} - ${p.method}</span><span><b>${money(p.amount)}</b> <button class="danger" data-del-pay="${p.id}" style="padding:2px 6px;font-size:10px;margin-left:6px">X</button></span></div>`;
    }).join('')||'<small class="muted">Nenhum pagamento neste intervalo</small>';
    return `<div class="list-row" style="flex-direction:column;align-items:stretch;gap:10px;"><div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;"><div><b>${escapeHtml(shop.name)} (${escapeHtml(shop.slug)})</b><br><small style="color:${paidThisMonth?'#22c55e':'#ef4444'}">${statusText} | Filtrado: ${money(shopPays.reduce((a,b)=>a+Number(b.amount||0),0))} (${shopPays.length}) | Plano: ${escapeHtml(shop.plano||'trial')} ${money(shop.plano_valor||0)}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;"><input type="month" id="month-${shop.slug}" value="${todayStr.slice(0,7)}" style="width:130px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><input type="number" id="amount-${shop.slug}" value="${Number(shop.plano_valor||100)}" style="width:80px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><select id="method-${shop.slug}" style="width:90px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select><button data-add-pay="${shop.slug}" class="btn gold" style="padding:8px 12px;">+ Mensalidade</button></div></div><details style="width:100%;margin-top:4px;"><summary style="cursor:pointer;color:#d4af37;font-size:13px;">Ver histórico filtrado (${shopPays.length}) de ${allShopPays.length} total</summary><div style="margin-top:8px;background:#0a0a0a;padding:10px;border-radius:10px;border:1px solid #1e1e1e;">${history}</div></details></div>`;
  }).join('');
  list.innerHTML=html||'<p class="muted">Nenhum resultado no intervalo</p>';
}
async function addPayment(slug){
  const monthInput=document.getElementById('month-'+slug);
  const amountInput=document.getElementById('amount-'+slug);
  const methodInput=document.getElementById('method-'+slug);
  if(!monthInput||!amountInput) return;
  const month_ref=monthInput.value; const amount=Number(amountInput.value)||0; const method=methodInput ? methodInput.value : 'pix';
  if(!month_ref){ toast('Selecione o mês'); return; }
  const{error}=await sb.from('barbershop_payments').insert({barbershop_slug:slug,amount,month_ref,method,payment_date:new Date().toISOString()});
  if(error){ toast(error.message); return; }
  toast('Mensalidade '+month_ref+' lançada'); await loadSuperFinance();
}
async function confirmarPagamento(bookingId){
  const{data:booking}=await sb.from('bookings').select('*, services(name,price)').eq('id',bookingId).maybeSingle();
  if(!booking){ toast('Não encontrado'); return; }
  if(!confirm(`Confirmar pagamento de ${money(booking.services?.price||0)}?`)) return;
  const{error}=await sb.from('cash_entries').insert({type:'income',description:`Pagamento - ${booking.services?.name||'Serviço'}`,amount:Number(booking.services?.price||0),entry_date:today(),slug:booking.slug});
  if(error){ toast(error.message); return; }
  await sb.from('bookings').update({status:'paid'}).eq('id',bookingId);
  toast('Pagamento confirmado'); await agenda();
}
async function excluirServico(id){ if(!confirm('Excluir?')) return; await sb.from('services').delete().eq('id',id).eq('slug',CURRENT_SLUG); await loadServices(); }
async function editarServico(id){
  const s=services.find(x=>x.id===id); if(!s) return;
  const n=prompt('Nome',s.name); if(!n) return;
  const p=prompt('Preço',s.price);
  await sb.from('services').update({name:n.trim(),price:Number(p)||0}).eq('id',id); await loadServices();
}

$$('[data-page]').forEach(b=>{ b.onclick=()=>go(b.dataset.page); });
$$('[data-page-go]').forEach(b=>{ b.onclick=()=>go(b.dataset.pageGo); });

document.addEventListener('click', (e)=>{
  const card=e.target.closest('.plan-card');
  if(card && card.dataset.plan){
    $$('.plan-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedPlano=card.dataset.plan;
    selectedPlanoValor=Number(card.dataset.valor||0);
    const vencEl=$('#shopVencimento');
    if(vencEl){
      const now=new Date();
      if(selectedPlano==='trial'){ now.setDate(now.getDate()+7); } else { now.setDate(now.getDate()+30); }
      vencEl.value=now.toISOString().slice(0,10);
    }
  }
});

$$('.auth-tabs button').forEach(b=>{
  b.onclick=()=>{
    $$('.auth-tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const signup=b.dataset.auth==='signup';
    const lf=$('#loginForm'); if(lf) lf.classList.toggle('hidden',signup);
    const sf=$('#signupForm'); if(sf) sf.classList.toggle('hidden',!signup);
  };
});
if($('#loginForm')){
  $('#loginForm').onsubmit=async(e)=>{
    e.preventDefault();
    const emailEl=$('#loginEmail'); const passEl=$('#loginPassword');
    const email=emailEl ? emailEl.value.trim() : '';
    const password=passEl ? passEl.value : '';
    const{error}=await sb.auth.signInWithPassword({email,password});
    if(error){ alert('Login falhou: '+error.message); }
  };
}
if($('#signupForm')){
  $('#signupForm').onsubmit=async(e)=>{
    e.preventDefault();
    const nameEl=$('#signupName'); const phoneEl=$('#signupPhone'); const emailEl=$('#signupEmail'); const passEl=$('#signupPassword'); const birthEl=$('#signupBirth');
    const name=nameEl ? nameEl.value.trim() : '';
    const phone=phoneEl ? phoneEl.value.trim() : '';
    const email=emailEl ? emailEl.value.trim() : '';
    const password=passEl ? passEl.value : '';
    const birth=birthEl ? birthEl.value||null : null;
    const{data,error}=await sb.auth.signUp({email,password,options:{data:{name,phone}}});
    if(error){ toast(error.message); return; }
    if(data.session){
      await sb.from('profiles').upsert({id:data.user.id,name,phone,email,birth,role:'client',active:true});
      toast('Cadastrado');
    }else{ toast('Confirme e-mail'); }
  };
}
if($('#logoutBtn')){ $('#logoutBtn').onclick=()=>sb.auth.signOut(); }
if($('#serviceForm')){
  $('#serviceForm').onsubmit=async(e)=>{
    e.preventDefault();
    const nameEl=$('#serviceName'); const priceEl=$('#servicePrice'); const durEl=$('#serviceDuration');
    const name=nameEl ? nameEl.value.trim() : '';
    const price=nameEl ? Number(priceEl.value) : 0;
    const dur=durEl ? Number(durEl.value) : 0;
    const{error}=await sb.from('services').insert({name,price,duration:dur,active:true,slug:CURRENT_SLUG});
    if(error){ toast(error.message); }else{ e.target.reset(); await loadServices(); }
  };
}
if($('#stockForm')){
  $('#stockForm').onsubmit=async(e)=>{
    e.preventDefault();
    const nameEl=$('#stockName'); const qtyEl=$('#stockQty'); const minEl=$('#stockMin');
    const name=nameEl ? nameEl.value.trim() : '';
    const qty=qtyEl ? Number(qtyEl.value) : 0;
    const min=minEl ? Number(minEl.value) : 0;
    const{error}=await sb.from('inventory').insert({name,quantity:qty,min_quantity:min,slug:CURRENT_SLUG});
    if(error){ toast(error.message); }else{ e.target.reset(); await loadStock(); }
  };
}
if($('#financeForm')){
  $('#financeForm').onsubmit=async(e)=>{
    e.preventDefault();
    const typeEl=$('#financeType'); const descEl=$('#financeDesc'); const amountEl=$('#financeAmount'); const dateEl=$('#financeDate');
    const type=typeEl ? typeEl.value : 'income';
    const description=descEl ? descEl.value.trim() : '';
    const amount=amountEl ? Number(amountEl.value) : 0;
    const entry_date=dateEl ? dateEl.value : today();
    const{error}=await sb.from('cash_entries').insert({type,description,amount,entry_date,slug:CURRENT_SLUG});
    if(error){ toast(error.message); }else{ e.target.reset(); const fd=$('#financeDate'); if(fd) fd.value=today(); await loadFinance(); }
  };
}
if($('#teamForm')){
  $('#teamForm').onsubmit=async(e)=>{
    e.preventDefault();
    const nameEl=$('#teamName'); const phoneEl=$('#teamPhone'); const perfilEl=$('#teamPerfil');
    const n=nameEl ? nameEl.value.trim() : '';
    const ph=phoneEl ? phoneEl.value.trim() : '';
    const perfil=perfilEl ? perfilEl.value : 'barbeiro';
    const{error}=await sb.from('professionals').insert({name:n,phone:ph,perfil,active:true,slug:CURRENT_SLUG});
    if(error){ toast(error.message); return; }
    e.target.reset(); await loadProfessionals(); await loadTeam(); toast('Cadastrado');
  };
}
if($('#barbershopForm')){
  const shopSlugInput=$('#shopSlug');
  if(shopSlugInput){
    shopSlugInput.addEventListener('input',()=>{
      const s=shopSlugInput.value.trim()||'slug';
      const el=$('#previewLink'); if(el) el.textContent=location.href.split('?')[0]+'?b='+s;
    });
  }
  const vencInput=$('#shopVencimento');
  if(vencInput){ const d=new Date(); d.setDate(d.getDate()+7); vencInput.value=d.toISOString().slice(0,10); }
}
const btnSalvar=$('#btnSalvarBarbearia');
if(btnSalvar){
  btnSalvar.onclick=async()=>{
    if(!isSuperAdmin()){ toast('Só super admin'); return; }
    const slugEl=$('#shopSlug'); const nameEl=$('#shopName'); const logoEl=$('#shopLogo'); const ownerEl=$('#shopOwner'); const phoneEl=$('#shopPhone'); const cpfEl=$('#shopCpfCnpj'); const vencEl=$('#shopVencimento'); const statusEl=$('#shopStatus');
    const slug=slugEl ? slugEl.value.trim().toLowerCase().replace(/\s+/g,'-') : '';
    const name=nameEl ? nameEl.value.trim() : '';
    const logo=logoEl ? logoEl.value.trim()||'dnh-logo.png' : 'dnh-logo.png';
    const owner=ownerEl ? ownerEl.value.trim() : '';
    const telefone=phoneEl ? phoneEl.value.trim()||null : null;
    const cpf_cnpj=cpfEl ? cpfEl.value.trim()||null : null;
    const data_vencimento=vencEl ? vencEl.value||null : null;
    const statusVal=statusEl ? statusEl.value : 'ativo';
    if(!slug||!name||!owner){ toast('Preencha Nome, Slug e E-mail do proprietário'); return; }
    const payload={ slug, name, logo_url: logo, owner_email: owner, telefone, cpf_cnpj, data_vencimento, active: statusVal==='ativo', plano: selectedPlano, plano_valor: selectedPlanoValor, status_pagamento: selectedPlano==='trial'?'trial':'pendente' };
    const{error}=await sb.from('barbershops').insert(payload);
    if(error){ toast(error.message); return; }
    await sb.from('settings').insert({slug,name,logo_url:logo,whatsapp:telefone||'',start_time:'08:00:00',end_time:'18:00:00',slot_interval:30,lunch_start:'12:00:00',lunch_end:'13:00:00'});
    toast('Barbearia criada! Plano: '+selectedPlano+' - R$ '+selectedPlanoValor);
    const form=$('#barbershopForm'); if(form) form.reset();
    const d=new Date(); d.setDate(d.getDate()+7); if(vencEl) vencEl.value=d.toISOString().slice(0,10);
    await loadBarbershops(); go('superadmin');
  };
}
if($('#saveSettings')){
  $('#saveSettings').onclick=async()=>{
    const weekly={};
    $$('[data-weekday]').forEach(row=>{
      const d=row.dataset.weekday;
      const enEl=row.querySelector('[data-week-enabled]');
      const stEl=row.querySelector('[data-week-start]');
      const endEl=row.querySelector('[data-week-end]');
      weekly[d]={enabled: enEl ? enEl.checked : true, start: stEl ? stEl.value||'08:00' : '08:00', end: endEl ? endEl.value||'18:00' : '18:00'};
    });
    const setNameEl=$('#setName'); const setWhatsappEl=$('#setWhatsapp'); const setStartEl=$('#setStart'); const setEndEl=$('#setEnd'); const setIntervalEl=$('#setInterval'); const setLogoEl=$('#setLogoUrl'); const setLunchStartEl=$('#setLunchStart'); const setLunchEndEl=$('#setLunchEnd');
    const payload={
      slug:CURRENT_SLUG,
      name: setNameEl ? setNameEl.value||'DNH' : 'DNH',
      whatsapp: setWhatsappEl ? setWhatsappEl.value||'' : '',
      start_time: (setStartEl ? setStartEl.value||'08:00' : '08:00')+':00',
      end_time: (setEndEl ? setEndEl.value||'18:00' : '18:00')+':00',
      slot_interval: setIntervalEl ? Number(setIntervalEl.value||30) : 30,
      logo_url: setLogoEl ? setLogoEl.value||'dnh-logo.png' : 'dnh-logo.png',
      lunch_start: (setLunchStartEl ? setLunchStartEl.value||'12:00' : '12:00')+':00',
      lunch_end: (setLunchEndEl ? setLunchEndEl.value||'13:00' : '13:00')+':00',
      weekly_schedule: weekly
    };
    const{error}=await sb.from('settings').upsert(payload,{onConflict:'slug'});
    if(error){ toast(error.message); return; }
    settings={...settings,...payload}; toast('Salvo'); await loadSettings();
  };
}
document.addEventListener('click', async (e)=>{
  const t=e.target;
  if(t.matches('[data-booking-time]')){ $$('.time-option').forEach(b=>b.classList.remove('selected')); t.classList.add('selected'); atualizarResumo(t.dataset.bookingTime); return; }
  if(t.id==='confirmBooking'){ await createBooking(); return; }
  if(t.matches('[data-client-cancel]')){ if(!confirm('Cancelar?')) return; const{error}=await sb.from('bookings').update({status:'cancelled'}).eq('id',t.dataset.clientCancel); if(!error){ toast('Cancelado'); await consultarAgenda(); } return; }
  if(t.matches('[data-cancel]')){ if(!confirm('Cancelar?')) return; const{error}=await sb.from('bookings').update({status:'cancelled'}).eq('id',t.dataset.cancel).eq('slug',CURRENT_SLUG); if(!error){ toast('Cancelado'); await agenda(); } return; }
  if(t.matches('[data-pay]')){ await confirmarPagamento(t.dataset.pay); return; }
  if(t.matches('[data-manage-shop]')){ await openManageShopModal(t.dataset.manageShop); return; }
  if(t.id==='mSaveBtn'){ await saveManageShop(); return; }
  if(t.id==='mCancelBtn' || t.id==='mCloseX'){ const modal=$('#manageShopModal'); if(modal){ modal.style.display='none'; modal.classList.add('hidden'); } return; }
  if(t.id==='mAddAdminBtn'){ await addShopAdmin(); return; }
  if(t.matches('[data-remove-admin]')){ await removeShopAdmin(t.dataset.removeAdmin); return; }
  if(t.matches('[data-resend]')){ await resendAccess(t.dataset.resend); return; }
  if(t.matches('[data-add-pay]')){ await addPayment(t.dataset.addPay); return; }
  if(t.matches('[data-del-pay]')){ if(!confirm('Excluir este pagamento?')) return; await sb.from('barbershop_payments').delete().eq('id',t.dataset.delPay); toast('Excluído'); await loadSuperFinance(); return; }
  if(t.id==='manageShopModal'){ const modal=$('#manageShopModal'); if(modal) modal.style.display='none'; return; }
  if(t.matches('[data-copy-link]')){ navigator.clipboard.writeText(t.dataset.copyLink); toast('Link copiado'); return; }
  if(t.matches('[data-shop-delete]')){ await excluirBarbearia(t.dataset.shopDelete); return; }
  if(t.matches('[data-service-delete]')){ await excluirServico(t.dataset.serviceDelete); return; }
  if(t.matches('[data-service-edit]')){ await editarServico(t.dataset.serviceEdit); return; }
  if(t.matches('[data-stock-entry]')){ await registrarMovimento(t.dataset.stockEntry,'in'); return; }
  if(t.matches('[data-stock-exit]')){ await registrarMovimento(t.dataset.stockExit,'out'); return; }
  if(t.matches('[data-team-delete]')){ await excluirProfissional(t.dataset.teamDelete); return; }
  if(t.id==='filterSuperFinance'){ await loadSuperFinance(); return; }
  if(t.id==='clearSuperFinance'){ const s=$('#superFinanceShopFilter'); if(s) s.value=''; const a=$('#superFinanceStart'); if(a) a.value=''; const b=$('#superFinanceEnd'); if(b) b.value=''; await loadSuperFinance(); return; }
});

if($('#clientService')) $('#clientService').addEventListener('change',loadClientTimes);
if($('#clientProfessional')) $('#clientProfessional').addEventListener('change',loadClientTimes);
if($('#clientDate')) $('#clientDate').addEventListener('change',loadClientTimes);
if($('#copyShare')) $('#copyShare').onclick=()=>{ const url=$('#shareUrl') ? $('#shareUrl').textContent||location.href : location.href; navigator.clipboard.writeText(url); toast('Link copiado'); };
if($('#filterFinance')) $('#filterFinance').onclick=()=>loadFinance();

async function init(){
  const fd=$('#financeDate'); if(fd) fd.value=today();
  const sI=$('#financeStart'); const eI=$('#financeEnd'); if(sI){ const d=new Date(); d.setDate(1); sI.value=d.toISOString().slice(0,10); } if(eI) eI.value=today();
  sb.auth.onAuthStateChange(async(ev,sess)=>{
    const av=$('#authView'); const ap=$('#appView');
    if(sess){
      await user(); if(!profile) return;
      if(av) av.classList.add('hidden'); if(ap) ap.classList.remove('hidden');
      aplicarPermissoesUI(); await loadSettings(); await loadServices(); await loadProfessionals();
      if(isSuperAdmin()){ go('superadmin'); } else if(profile?.role==='admin') go('dashboard'); else go('agenda');
    } else {
      profile=null; if(av) av.classList.remove('hidden'); if(ap) ap.classList.add('hidden');
    }
  });
  const{data:{session}}=await sb.auth.getSession();
  if(session){
    await user();
    if(profile){
      const av=$('#authView'); const ap=$('#appView');
      if(av) av.classList.add('hidden'); if(ap) ap.classList.remove('hidden');
      aplicarPermissoesUI(); await loadSettings(); await loadServices(); await loadProfessionals();
      if(isSuperAdmin()){ go('superadmin'); } else if(profile?.role==='admin') go('dashboard'); else go('agenda');
    }
  }
}
init();
