const cfg = window.DNH_CONFIG || {};
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let profile = null;
let settings = { name: 'DNH BARBEARIA', whatsapp: '', start_time: '08:00', end_time: '18:00', slot_interval: 30, logo_url: 'dnh-logo.png', weekly_schedule: {}, slug: 'dnh', lunch_start: '12:00', lunch_end: '13:00' };
let services = []; let professionals = []; let financeChart = null; let currentManageSlug = null;
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
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
    $('#roleLabel').textContent='GESTORA DE LICENÇAS'; $('#brandName').textContent='GESTÃO DNH';
    localStorage.removeItem('dnh_admin_view');
  }else if(profile?.role==='admin'){
    $$('.admin-only').forEach(el=>el.style.display='');
    $('#roleLabel').textContent='Admin - '+CURRENT_SLUG; $('#brandName').textContent=settings.name||CURRENT_SLUG;
  }else{
    $$('.client-only').forEach(el=>el.style.display='');
    $('#roleLabel').textContent='Cliente'; $('#brandName').textContent=settings.name||'DNH';
  }
}
async function user(){ const{data:{user:au}}=await sb.auth.getUser(); if(!au){ profile=null; return null; } const{data}=await sb.from('profiles').select('*').eq('id',au.id).maybeSingle(); if(data){ profile=data; }else{ const md=au.user_metadata||{}; const fb={id:au.id,name:md.name||au.email?.split('@')[0]||'Cliente',phone:md.phone||'',email:au.email||'',role:'client',active:true}; const{data:r}=await sb.from('profiles').upsert(fb,{onConflict:'id'}).select('*').maybeSingle(); profile=r||fb; } return profile; }
function go(page){ if(!profile) return; $$('.page').forEach(p=>p.classList.remove('active')); const t=$('#page-'+page); if(t) t.classList.add('active'); $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); if(page==='dashboard') dashboard(); if(page==='agenda') agenda(); if(page==='consultar') consultarAgenda(); if(page==='services') loadServices(); if(page==='clients') loadClients(); if(page==='stock') loadStock(); if(page==='finance') loadFinance(); if(page==='team') loadTeam(); if(page==='settings') loadSettings(); if(page==='superadmin') loadBarbershops(); if(page==='superadmin-financeiro') loadSuperFinance(); }
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
async function loadServices(){ const{data=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).order('name'); services=data||[]; if($('#serviceList')){ $('#serviceList').innerHTML=!services.length?'<p class="muted">Nenhum</p>':services.map(s=>`<div class="list-row"><div><b>${escapeHtml(s.name)}</b><small>${money(s.price)}</small></div><div><button data-service-edit="${s.id}">Editar</button><button class="danger" data-service-delete="${s.id}">Excluir</button></div></div>`).join(''); } if($('#clientService')){ const cur=$('#clientService').value; $('#clientService').innerHTML=`<option value="">Selecione</option>${services.filter(s=>s.active!==false).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}`; if(cur) $('#clientService').value=cur; } }
async function loadProfessionals(){ const{data=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true).order('name'); professionals=data||[]; if($('#clientProfessional')){ const cur=$('#clientProfessional').value; $('#clientProfessional').innerHTML=`<option value="">Selecione</option>${professionals.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} ${p.perfil?' - '+p.perfil:''}</option>`).join('')}`; if(cur) $('#clientProfessional').value=cur; } }
async function dashboard(){ const{data:books=[]}=await sb.from('bookings').select('*').eq('slug',CURRENT_SLUG).eq('booking_date',today()); const{count}=await sb.from('profiles').select('*',{count:'exact',head:true}).eq('role','client'); const{data:fin=[]}=await sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).gte('entry_date',today().slice(0,7)+'-01'); if($('#kToday')) $('#kToday').textContent=books.filter(x=>x.status==='confirmed').length; if($('#kClients')) $('#kClients').textContent=count||0; if($('#kRevenue')) $('#kRevenue').textContent=money(fin.filter(x=>x.type==='income').reduce((a,b)=>a+Number(b.amount||0),0)); if($('#todayList')) $('#todayList').innerHTML=books.length?books.map(b=>`<div class="list-row"><b>${(b.booking_time||'').slice(0,5)}</b></div>`).join(''):'<p class="muted">Nenhum hoje</p>'; }
async function agenda(){ await loadSettings(); await loadProfessionals(); if(profile?.role==='admin'||isSuperAdmin()){ const a=$('#adminAgenda'); const c=$('#clientAgenda'); if(c) c.classList.add('hidden'); if(a){ a.classList.remove('hidden'); a.innerHTML=`<div><h1>Agenda ${CURRENT_SLUG} - Admin</h1><div id="adminAgendaCalendar"><p class="muted">Carregando...</p></div></div>`; const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time'); a.querySelector('#adminAgendaCalendar').innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div style="display:flex;gap:6px;"><button data-pay="${b.id}" style="background:#22a861;color:#fff;">💰 Pagamento</button><button class="danger" data-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>'; } return; } $('#clientAgenda')?.classList.remove('hidden'); $('#adminAgenda')?.classList.add('hidden'); await loadServices(); initClientBooking(); await loadClientTimes(); }
function initClientBooking(){ const d=$('#clientDate'); if(!d) return; d.value=today(); d.min=today(); }
async function loadClientTimes(){ const sid=$('#clientService')?.value; const pid=$('#clientProfessional')?.value; const date=$('#clientDate')?.value; const grid=$('#clientTimeGrid'); if(!grid) return; if(!sid||!pid||!date){ grid.innerHTML='<p class="muted">Selecione tudo</p>'; return; } const svc=services.find(s=>s.id===sid); const dur=Number(svc?.duration)||30; const ds=scheduleForDate(date); if(ds.enabled===false){ grid.innerHTML='<p class="muted">Não atende</p>'; return; } const op=timeToMinutes(ds.start||'08:00'); const cl=timeToMinutes(ds.end||'18:00'); const lunchS=timeToMinutes(settings.lunch_start||'12:00'); const lunchE=timeToMinutes(settings.lunch_end||'13:00'); const inter=Number(settings.slot_interval)||30; const{data:books=[]}=await sb.from('bookings').select('booking_time,service_id').eq('slug',CURRENT_SLUG).eq('professional_id',pid).eq('booking_date',date).neq('status','cancelled'); const occ=books.map(b=>{ const st=timeToMinutes(String(b.booking_time).slice(0,5)); const bs=services.find(s=>s.id===b.service_id); return{start:st,end:st+(Number(bs?.duration)||30)}; }); const avail=[]; const now=new Date(); const curMin=now.getHours()*60+now.getMinutes(); for(let st=op; st+dur<=cl; st+=inter){ if(date===today() && st<=curMin) continue; if(st>=lunchS && st<lunchE) continue; const en=st+dur; if(occ.some(o=>st<o.end && en>o.start)) continue; const hh=String(Math.floor(st/60)).padStart(2,'0'); const mm=String(st%60).padStart(2,'0'); avail.push(`${hh}:${mm}`); } grid.innerHTML=avail.length?avail.map(t=>`<button class="time-option" data-booking-time="${t}">${t}</button>`).join(''):'<p class="muted">Sem horário</p>'; }
function atualizarResumo(t){ const s=services.find(x=>x.id===$('#clientService')?.value); const p=professionals.find(x=>x.id===$('#clientProfessional')?.value); if($('#summaryService')) $('#summaryService').textContent=s?.name||'-'; if($('#summaryProfessional')) $('#summaryProfessional').textContent=p?.name||'-'; if($('#summaryDate')){ const d=$('#clientDate')?.value; if(d){ const[y,m,dd]=d.split('-'); $('#summaryDate').textContent=`${dd}/${m}/${y}`; } } if($('#summaryTime')) $('#summaryTime').textContent=t||''; if($('#bookingSummary')){ if(t) $('#bookingSummary').classList.remove('hidden'); else $('#bookingSummary').classList.add('hidden'); } }
async function createBooking(){ const sid=$('#clientService')?.value; const pid=$('#clientProfessional')?.value; const date=$('#clientDate')?.value; const time=$('#summaryTime')?.textContent?.trim(); if(!sid||!pid||!date||!time){ alert('Selecione tudo'); return; } const{data:{user:au}}=await sb.auth.getUser(); if(!au) return; const{data:ex}=await sb.from('bookings').select('id').eq('slug',CURRENT_SLUG).eq('professional_id',pid).eq('booking_date',date).eq('booking_time',time+':00').neq('status','cancelled').maybeSingle(); if(ex){ toast('Ocupado'); return; } const{error}=await sb.from('bookings').insert({user_id:au.id,service_id:sid,professional_id:pid,booking_date:date,booking_time:time+':00',status:'confirmed',slug:CURRENT_SLUG}); if(error){ toast(error.message); return; } toast('Confirmado!'); await consultarAgenda(); }
async function consultarAgenda(){ const list=$('#clientBookingsList'); if(!list) return; list.innerHTML='<p class="muted">Carregando...</p>'; const{data:{user:au}}=await sb.auth.getUser(); if(!au) return; const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('user_id',au.id).eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time'); list.innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div><button class="danger" data-client-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>'; }
async function loadClients(){ const{data=[]}=await sb.from('profiles').select('*').order('name'); if($('#clientList')){ $('#clientList').innerHTML=data.map(c=>`<div class="list-row"><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.email||'')} • ${c.role}</small></div></div>`).join('')||'<p class="muted">Nenhum</p>'; } }
async function loadStock(){ const{data=[]}=await sb.from('inventory').select('*').eq('slug',CURRENT_SLUG).order('name'); if($('#stockList')){ $('#stockList').innerHTML=data.map(x=>{ const qty=Number(x.quantity)||0; const min=Number(x.min_quantity)||5; const isLow=qty<=min; return `<div class="list-row ${isLow?'low-stock':''}"><div><b>${escapeHtml(x.name)}</b><small>Qtd: ${qty} | Mín: ${min} ${isLow?'<span class="stock-alert">BAIXO</span>':''}</small></div><div><button data-stock-entry="${x.id}">+ Entrada</button><button data-stock-exit="${x.id}">- Saída</button></div></div>`; }).join('')||'<p class="muted">Nenhum</p>'; } }
async function registrarMovimento(id,t){ const{data:item}=await sb.from('inventory').select('*').eq('id',id).maybeSingle(); if(!item) return; const raw=prompt('Qtd:'); const q=Number(String(raw||'').replace(',','.')); if(!q) return; const cur=Number(item.quantity)||0; const next=t==='in'?cur+q:cur-q; if(next<0){ toast('Insuficiente'); return; } await sb.from('inventory_movements').insert({inventory_id:id,type:t,quantity:q}); await sb.from('inventory').update({quantity:next}).eq('id',id); await loadStock(); }
async function loadFinance(){ const start=$('#financeStart')?.value; const end=$('#financeEnd')?.value; let query=sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).order('entry_date',{ascending:true}); if(start) query=query.gte('entry_date',start); if(end) query=query.lte('entry_date',end); const{data=[]}=await query; const inc=data.filter(x=>x.type==='income').reduce((a,b)=>a+Number(b.amount||0),0); const exp=data.filter(x=>x.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0); if($('#sumIncome')) $('#sumIncome').textContent=money(inc); if($('#sumExpense')) $('#sumExpense').textContent=money(exp); if($('#sumBalance')) $('#sumBalance').textContent=money(inc-exp); if($('#financeList')){ $('#financeList').innerHTML=data.slice(-30).reverse().map(x=>`<div class="list-row"><b>${escapeHtml(x.description)}</b><span>${x.type==='income'?'+':'-'}${money(x.amount)} - ${x.entry_date}</span></div>`).join('')||'<p class="muted">Sem lançamentos</p>'; } }
async function loadTeam(){ const{data=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).order('name'); if($('#teamList')){ $('#teamList').innerHTML=data.map(x=>`<div class="list-row"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.email||'') } - ${x.perfil}</small></div><div><button class="danger" data-team-delete="${x.id}">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhum</p>'; } professionals=data; }
async function excluirProfissional(id){ if(!confirm('Excluir?')) return; await sb.from('professionals').delete().eq('id',id).eq('slug',CURRENT_SLUG); await loadTeam(); }
async function loadBarbershops(){
  if(!isSuperAdmin()) return;
  const{data=[],error}=await sb.from('barbershops').select('*').order('created_at',{ascending:false});
  if(error){ $('#barbershopList').innerHTML='<p>Erro: '+escapeHtml(error.message)+'</p>'; return; }
  const base=location.href.split('?')[0];
  $('#barbershopList').innerHTML=data.map(b=>`<div class="list-row"><div><b>${escapeHtml(b.name)}</b><small>Slug: ${escapeHtml(b.slug)} • ${b.active?'Ativo':'Inativo'} • Owner: ${escapeHtml(b.owner_email||'-')}</small><small>Link cliente: ${base}?b=${escapeHtml(b.slug)}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button data-manage-shop="${b.slug}" class="btn gold">⚙️ Gerenciar</button><button data-copy-link="${base}?b=${b.slug}">Copiar Link</button><button class="danger" data-shop-delete="${b.id}">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhuma</p>';
}
async function openManageShopModal(slug){
  currentManageSlug=slug;
  const{data:shop}=await sb.from('barbershops').select('*').eq('slug',slug).maybeSingle();
  if(!shop){ toast('Não encontrada'); return; }
  $('#mShopName').value=shop.name||''; $('#mShopSlug').value=shop.slug||''; $('#mShopLogo').value=shop.logo_url||''; $('#mShopOwner').value=shop.owner_email||''; $('#mShopActive').checked=shop.active!==false;
  $('#manageShopTitle').textContent='Gerenciar: '+shop.name;
  const base=location.href.split('?')[0];
  if($('#mShopLink')) $('#mShopLink').textContent=base+'?b='+shop.slug;
  const{data:admins=[]}=await sb.from('professionals').select('*').eq('slug',slug).order('name');
  $('#mShopAdminsList').innerHTML=admins.length?admins.map(a=>`<div class="list-row" style="padding:10px 12px;margin:0;background:#1e1e1e;border-color:#2a2a2a;"><div><b style="color:#fff">${escapeHtml(a.name)}</b><small style="display:block;color:#aaa">${escapeHtml(a.email||'sem email')} • ${escapeHtml(a.perfil)} • ${escapeHtml(a.phone||'')}</small></div><div style="display:flex;gap:6px;"><button data-resend="${a.email}" style="padding:6px 8px;font-size:11px;background:#222;color:#d4af37;border:1px solid #d4af37;">Reenviar Acesso</button><button class="danger" data-remove-admin="${a.id}" style="padding:6px 8px;font-size:11px;">Remover</button></div></div>`).join(''):'<div style="padding:12px;text-align:center;color:#666;background:#1a1a1a;border-radius:10px;border:1px dashed #333;">Nenhum admin</div>';
  $('#manageShopModal').classList.remove('hidden'); $('#manageShopModal').style.display='flex';
}
async function saveManageShop(){
  if(!currentManageSlug) return;
  const payload={name:$('#mShopName').value.trim(),logo_url:$('#mShopLogo').value.trim()||'dnh-logo.png',owner_email:$('#mShopOwner').value.trim()||null,active:$('#mShopActive').checked};
  const{error}=await sb.from('barbershops').update(payload).eq('slug',currentManageSlug);
  if(error){ toast(error.message); return; }
  await sb.from('settings').update({name:payload.name,logo_url:payload.logo_url}).eq('slug',currentManageSlug);
  toast('Barbearia atualizada'); $('#manageShopModal').style.display='none'; $('#manageShopModal').classList.add('hidden'); await loadBarbershops(); await loadSuperFinance();
}
async function addShopAdmin(){
  if(!currentManageSlug) return;
  const name=$('#mNewAdminName').value.trim();
  const email=$('#mNewAdminEmail').value.trim().toLowerCase();
  const phone=$('#mNewAdminPhone').value.trim();
  const perfil=$('#mNewAdminPerfil').value;
  if(!name||!email){ toast('Nome e E-mail obrigatórios'); return; }
  const btn=$('#mAddAdminBtn'); btn.textContent='Criando e enviando e-mail...'; btn.disabled=true;
  const tempPass = Math.random().toString(36).slice(-8)+'A1!b2@';
  let userId = null;
  try{
    const { data: signUpData } = await sb.auth.signUp({ email, password: tempPass, options: { data: { name, phone, role: 'admin' } } });
    if(signUpData?.user?.id) userId = signUpData.user.id;
  }catch(e){}
  try{ await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); }catch(e){}
  try{
    const { error: profError } = await sb.from('professionals').insert({ name, phone, email, perfil, slug: currentManageSlug, active: true });
    if(profError && profError.message.includes('duplicate')){ await sb.from('professionals').update({ name, phone, perfil, active: true }).eq('email', email).eq('slug', currentManageSlug); }
  }catch(e){}
  try{
    if(userId){ await sb.from('profiles').upsert({ id: userId, name, phone, email, role: 'admin', active: true, barbershop_slug: currentManageSlug }, { onConflict: 'id' }); }
    else{ const { data: existing } = await sb.from('profiles').select('id').eq('email', email).maybeSingle(); if(existing?.id){ await sb.from('profiles').update({ role: 'admin', barbershop_slug: currentManageSlug, name, phone }).eq('id', existing.id); } }
  }catch(e){}
  btn.textContent='✉️ Criar ADM e Enviar Acesso por E-mail'; btn.disabled=false;
  toast('✅ ADM criado! E-mail enviado para '+email);
  $('#mNewAdminName').value=''; $('#mNewAdminEmail').value=''; $('#mNewAdminPhone').value='';
  await openManageShopModal(currentManageSlug);
}
async function removeShopAdmin(id){ if(!confirm('Remover?')) return; await sb.from('professionals').delete().eq('id',id); toast('Removido'); await openManageShopModal(currentManageSlug); }
async function resendAccess(email){ if(!email || email==='sem email'){ toast('Sem e-mail'); return; } const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); if(error){ toast('Erro: '+error.message); } else { toast('🔑 Link reenviado para '+email); } }
async function excluirBarbearia(id){ if(!confirm('Excluir barbearia?')) return; const{error}=await sb.from('barbershops').delete().eq('id',id); if(error){ toast(error.message); return; } toast('Excluída'); await loadBarbershops(); await loadSuperFinance(); }

// FINANCEIRO LICENÇAS COM FILTRO DE INTERVALO
async function loadSuperFinance(){
  if(!isSuperAdmin()) return;
  const{data:shops=[]}=await sb.from('barbershops').select('*').order('name');
  const{data:pays=[]}=await sb.from('barbershop_payments').select('*').order('payment_date',{ascending:false});
  
  // Preenche select de barbearias no filtro se vazio
  const shopSelect=$('#superFinanceShopFilter');
  if(shopSelect && shopSelect.options.length===1){
    shops.forEach(s=>{
      const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; shopSelect.appendChild(opt);
    });
  }

  const shopFilter=$('#superFinanceShopFilter')?.value||'';
  const startFilter=$('#superFinanceStart')?.value||'';
  const endFilter=$('#superFinanceEnd')?.value||'';

  let filteredPays=[...pays];
  if(shopFilter) filteredPays=filteredPays.filter(p=>p.barbershop_slug===shopFilter);
  if(startFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) >= startFilter );
  if(endFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) <= endFilter );

  const totalFiltered=filteredPays.reduce((a,b)=>a+Number(b.amount||0),0);
  const now=new Date(); const currentMonth=now.toISOString().slice(0,7);

  // Resumo filtrado
  const summaryEl=$('#superFinanceSummary');
  if(summaryEl){
    summaryEl.innerHTML=`<div class="stat"><small>Filtrado</small><b>${filteredPays.length} pagamentos</b></div><div class="stat"><small>Total no intervalo</small><b>${money(totalFiltered)}</b></div><div class="stat"><small>Período</small><b style="font-size:12px">${startFilter||'início'} até ${endFilter||'hoje'}</b></div>`;
  }

  const list=$('#superFinanceList'); if(!list) return;

  if(shops.length===0){ list.innerHTML='<p class="muted">Nenhuma barbearia</p>'; return; }

  let html='';
  // Se filtro de barbearia, mostra só ela. Se não, mostra todas com seus pagamentos filtrados
  const shopsToShow=shopFilter ? shops.filter(s=>s.slug===shopFilter) : shops;

  html+=shopsToShow.map(shop=>{
    const shopPays=filteredPays.filter(p=>p.barbershop_slug===shop.slug);
    const allShopPays=pays.filter(p=>p.barbershop_slug===shop.slug);
    const paidThisMonth=allShopPays.some(p=>p.month_ref===currentMonth);
    const statusText=paidThisMonth?`✅ PAGO EM ${currentMonth}`:`❌ ATRASADO - ${currentMonth}`;
    const history=shopPays.map(p=>{
      const d=new Date(p.payment_date);
      const dataHora=d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px dashed #222;align-items:center;"><span>${dataHora} - Ref: ${p.month_ref} - ${p.method}</span><span><b>${money(p.amount)}</b> <button class="danger" data-del-pay="${p.id}" style="padding:2px 6px;font-size:10px;margin-left:6px">X</button></span></div>`;
    }).join('')||'<small class="muted">Nenhum pagamento neste intervalo</small>';
    
    return `<div class="list-row ${paidThisMonth?'':'low-stock'}" style="flex-direction:column;align-items:stretch;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;">
        <div><b>${escapeHtml(shop.name)} (${escapeHtml(shop.slug)})</b><br><small class="${paidThisMonth?'':'stock-alert'}" style="margin:0">${statusText} | Filtrado: ${money(shopPays.reduce((a,b)=>a+Number(b.amount||0),0))} (${shopPays.length})</small></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <input type="month" id="month-${shop.slug}" value="${currentMonth}" style="width:130px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff">
          <input type="number" id="amount-${shop.slug}" value="100" style="width:80px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff">
          <select id="method-${shop.slug}" style="width:90px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select>
          <button data-add-pay="${shop.slug}" class="btn gold" style="padding:8px 12px;">+ Mensalidade</button>
        </div>
      </div>
      <details style="width:100%;margin-top:4px;"><summary style="cursor:pointer;color:#d4af37;font-size:13px;">Ver histórico filtrado (${shopPays.length}) de ${allShopPays.length} total</summary><div style="margin-top:8px;background:#0a0a0a;padding:10px;border-radius:10px;border:1px solid #1e1e1e;">${history}</div></details>
    </div>`;
  }).join('');

  list.innerHTML=html||'<p class="muted">Nenhum resultado no intervalo</p>';
}

async function addPayment(slug){
  const monthInput=document.getElementById('month-'+slug); const amountInput=document.getElementById('amount-'+slug); const methodInput=document.getElementById('method-'+slug);
  if(!monthInput||!amountInput) return;
  const month_ref=monthInput.value; const amount=Number(amountInput.value)||0; const method=methodInput.value;
  if(!month_ref){ toast('Selecione o mês'); return; }
  const{error}=await sb.from('barbershop_payments').insert({barbershop_slug:slug,amount,month_ref,method,payment_date:new Date().toISOString()});
  if(error){ toast(error.message); return; }
  toast('Mensalidade '+month_ref+' lançada'); await loadSuperFinance();
}
async function confirmarPagamento(bookingId){ const{data:booking}=await sb.from('bookings').select('*, services(name,price)').eq('id',bookingId).maybeSingle(); if(!booking){ toast('Não encontrado'); return; } if(!confirm(`Confirmar pagamento de ${money(booking.services?.price||0)}?`)) return; const{error}=await sb.from('cash_entries').insert({type:'income',description:`Pagamento - ${booking.services?.name||'Serviço'}`,amount:Number(booking.services?.price||0),entry_date:today(),slug:booking.slug}); if(error){ toast(error.message); return; } await sb.from('bookings').update({status:'paid'}).eq('id',bookingId); toast('Pagamento confirmado'); await agenda(); }
async function excluirServico(id){ if(!confirm('Excluir?')) return; await sb.from('services').delete().eq('id',id).eq('slug',CURRENT_SLUG); await loadServices(); }
async function editarServico(id){ const s=services.find(x=>x.id===id); if(!s) return; const n=prompt('Nome',s.name); if(!n) return; const p=prompt('Preço',s.price); await sb.from('services').update({name:n.trim(),price:Number(p)||0}).eq('id',id); await loadServices(); }

$$('[data-page]').forEach(b=>{ b.onclick=()=>go(b.dataset.page); });
$$('.auth-tabs button').forEach(b=>{ b.onclick=()=>{ $$('.auth-tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const signup=b.dataset.auth==='signup'; $('#loginForm')?.classList.toggle('hidden',signup); $('#signupForm')?.classList.toggle('hidden',!signup); }; });
if($('#loginForm')){ $('#loginForm').onsubmit=async(e)=>{ e.preventDefault(); const{error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value}); if(error){ alert('Login falhou: '+error.message); } }; }
if($('#signupForm')){ $('#signupForm').onsubmit=async(e)=>{ e.preventDefault(); const name=$('#signupName').value.trim(); const phone=$('#signupPhone').value.trim(); const email=$('#signupEmail').value.trim(); const password=$('#signupPassword').value; const birth=$('#signupBirth').value||null; const{data,error}=await sb.auth.signUp({email,password,options:{data:{name,phone,birth}}}); if(error){ toast(error.message); return; } if(data.session){ await sb.from('profiles').upsert({id:data.user.id,name,phone,email,birth,role:'client',active:true}); toast('Cadastrado'); }else{ toast('Confirme e-mail'); } }; }
if($('#logoutBtn')){ $('#logoutBtn').onclick=()=>sb.auth.signOut(); }
if($('#serviceForm')){ $('#serviceForm').onsubmit=async(e)=>{ e.preventDefault(); const{error}=await sb.from('services').insert({name:$('#serviceName').value.trim(),price:Number($('#servicePrice').value),duration:Number($('#serviceDuration').value),active:true,slug:CURRENT_SLUG}); if(error){ toast(error.message); }else{ e.target.reset(); await loadServices(); } }; }
if($('#stockForm')){ $('#stockForm').onsubmit=async(e)=>{ e.preventDefault(); const qty=Number($('#stockQty').value); const min=Number($('#stockMin').value); const{error}=await sb.from('inventory').insert({name:$('#stockName').value.trim(),quantity:qty,min_quantity:min,slug:CURRENT_SLUG}); if(error){ toast(error.message); }else{ e.target.reset(); await loadStock(); } }; }
if($('#financeForm')){ $('#financeForm').onsubmit=async(e)=>{ e.preventDefault(); const{error}=await sb.from('cash_entries').insert({type:$('#financeType').value,description:$('#financeDesc').value.trim(),amount:Number($('#financeAmount').value),entry_date:$('#financeDate').value,slug:CURRENT_SLUG}); if(error){ toast(error.message); }else{ e.target.reset(); if($('#financeDate')) $('#financeDate').value=today(); await loadFinance(); } }; }
if($('#teamForm')){ $('#teamForm').onsubmit=async(e)=>{ e.preventDefault(); const n=$('#teamName').value.trim(); const ph=$('#teamPhone').value.trim(); const perfil=$('#teamPerfil').value; const{error}=await sb.from('professionals').insert({name:n,phone:ph,perfil,active:true,slug:CURRENT_SLUG}); if(error){ toast(error.message); return; } e.target.reset(); await loadProfessionals(); await loadTeam(); toast('Cadastrado'); }; }
if($('#barbershopForm')){
  $('#barbershopForm').onsubmit=async(e)=>{
    e.preventDefault(); if(!isSuperAdmin()){ toast('Só super admin'); return; }
    const slug=$('#shopSlug').value.trim().toLowerCase().replace(/\s+/g,'-'); const name=$('#shopName').value.trim(); const logo=$('#shopLogo').value.trim()||'dnh-logo.png'; const owner=$('#shopOwner').value.trim()||null;
    if(!slug||!name){ toast('Preencha'); return; }
    const{error}=await sb.from('barbershops').insert({slug,name,logo_url:logo,owner_email:owner});
    if(error){ toast(error.message); return; }
    await sb.from('settings').insert({slug,name,logo_url:logo,whatsapp:'',start_time:'08:00:00',end_time:'18:00:00',slot_interval:30,lunch_start:'12:00:00',lunch_end:'13:00:00'});
    toast('Criada! ?b='+slug); e.target.reset(); await loadBarbershops(); await loadSuperFinance();
  };
  const shopSlugInput=$('#shopSlug'); if(shopSlugInput){ shopSlugInput.addEventListener('input',()=>{ const s=shopSlugInput.value.trim()||'slug'; const el=$('#previewLink'); if(el) el.textContent=location.href.split('?')[0]+'?b='+s; }); }
}
if($('#saveSettings')){
  $('#saveSettings').onclick=async()=>{
    const weekly={}; $$('[data-weekday]').forEach(row=>{ const d=row.dataset.weekday; weekly[d]={enabled:row.querySelector('[data-week-enabled]')?.checked!==false,start:row.querySelector('[data-week-start]')?.value||'08:00',end:row.querySelector('[data-week-end]')?.value||'18:00'}; });
    const payload={slug:CURRENT_SLUG,name:$('#setName')?.value||'DNH',whatsapp:$('#setWhatsapp')?.value||'',start_time:($('#setStart')?.value||'08:00')+':00',end_time:($('#setEnd')?.value||'18:00')+':00',slot_interval:Number($('#setInterval')?.value||30),logo_url:$('#setLogoUrl')?.value||'dnh-logo.png',lunch_start:($('#setLunchStart')?.value||'12:00')+':00',lunch_end:($('#setLunchEnd')?.value||'13:00')+':00',weekly_schedule:weekly};
    const{error}=await sb.from('settings').upsert(payload,{onConflict:'slug'}); if(error){ toast(error.message); return; } settings={...settings,...payload}; toast('Salvo'); await loadSettings();
  };
}

document.addEventListener('click', async (e)=>{
  const t=e.target;
  if(t.matches('[data-booking-time]')){ $$('.time-option').forEach(b=>b.classList.remove('selected')); t.classList.add('selected'); atualizarResumo(t.dataset.bookingTime); }
  if(t.id==='confirmBooking'){ await createBooking(); return; }
  if(t.matches('[data-client-cancel]')){ if(!confirm('Cancelar?')) return; const{error}=await sb.from('bookings').update({status:'cancelled'}).eq('id',t.dataset.clientCancel); if(!error){ toast('Cancelado'); await consultarAgenda(); } return; }
  if(t.matches('[data-cancel]')){ if(!confirm('Cancelar?')) return; const{error}=await sb.from('bookings').update({status:'cancelled'}).eq('id',t.dataset.cancel).eq('slug',CURRENT_SLUG); if(!error){ toast('Cancelado'); await agenda(); } return; }
  if(t.matches('[data-pay]')){ await confirmarPagamento(t.dataset.pay); return; }
  if(t.matches('[data-manage-shop]')){ await openManageShopModal(t.dataset.manageShop); return; }
  if(t.id==='mSaveBtn'){ await saveManageShop(); return; }
  if(t.id==='mCancelBtn' || t.id==='mCloseX'){ $('#manageShopModal').style.display='none'; $('#manageShopModal').classList.add('hidden'); return; }
  if(t.id==='mAddAdminBtn'){ await addShopAdmin(); return; }
  if(t.matches('[data-remove-admin]')){ await removeShopAdmin(t.dataset.removeAdmin); return; }
  if(t.matches('[data-resend]')){ await resendAccess(t.dataset.resend); return; }
  if(t.matches('[data-add-pay]')){ await addPayment(t.dataset.addPay); return; }
  if(t.matches('[data-del-pay]')){ if(!confirm('Excluir este pagamento?')) return; await sb.from('barbershop_payments').delete().eq('id',t.dataset.delPay); toast('Excluído'); await loadSuperFinance(); return; }
  if(t.id==='manageShopModal'){ $('#manageShopModal').style.display='none'; return; }
  if(t.matches('[data-copy-link]')){ navigator.clipboard.writeText(t.dataset.copyLink); toast('Link copiado'); return; }
  if(t.matches('[data-shop-delete]')){ await excluirBarbearia(t.dataset.shopDelete); return; }
  if(t.matches('[data-service-delete]')){ await excluirServico(t.dataset.serviceDelete); return; }
  if(t.matches('[data-service-edit]')){ await editarServico(t.dataset.serviceEdit); return; }
  if(t.matches('[data-stock-entry]')){ await registrarMovimento(t.dataset.stockEntry,'in'); return; }
  if(t.matches('[data-stock-exit]')){ await registrarMovimento(t.dataset.stockExit,'out'); return; }
  if(t.matches('[data-team-delete]')){ await excluirProfissional(t.dataset.teamDelete); return; }
  if(t.id==='filterSuperFinance'){ await loadSuperFinance(); return; }
  if(t.id==='clearSuperFinance'){ 
    const s=$('#superFinanceShopFilter'); if(s) s.value=''; 
    const a=$('#superFinanceStart'); if(a) a.value=''; 
    const b=$('#superFinanceEnd'); if(b) b.value=''; 
    await loadSuperFinance(); return; 
  }
});

if($('#clientService')) $('#clientService').addEventListener('change',loadClientTimes);
if($('#clientProfessional')) $('#clientProfessional').addEventListener('change',loadClientTimes);
if($('#clientDate')) $('#clientDate').addEventListener('change',loadClientTimes);
if($('#copyShare')) $('#copyShare').onclick=()=>{ const url=$('#shareUrl')?.textContent||location.href; navigator.clipboard.writeText(url); toast('Link copiado'); };
if($('#filterFinance')) $('#filterFinance').onclick=()=>loadFinance();

async function init(){
  if($('#financeDate')) $('#financeDate').value=today();
  const sI=$('#financeStart'); const eI=$('#financeEnd'); if(sI){ const d=new Date(); d.setDate(1); sI.value=d.toISOString().slice(0,10); } if(eI) eI.value=today();
  sb.auth.onAuthStateChange(async(ev,sess)=>{
    const av=$('#authView'); const ap=$('#appView');
    if(sess){ await user(); if(!profile) return; if(av) av.classList.add('hidden'); if(ap) ap.classList.remove('hidden'); aplicarPermissoesUI(); await loadSettings(); await loadServices(); await loadProfessionals(); if(isSuperAdmin()){ localStorage.removeItem('dnh_slug'); go('superadmin'); } else if(profile?.role==='admin') go('dashboard'); else go('agenda'); }
    else{ profile=null; if(av) av.classList.remove('hidden'); if(ap) ap.classList.add('hidden'); }
  });
  const{data:{session}}=await sb.auth.getSession();
  if(session){ await user(); if(profile){ $('#authView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden'); aplicarPermissoesUI(); await loadSettings(); await loadServices(); await loadProfessionals(); if(isSuperAdmin()){ localStorage.removeItem('dnh_slug'); go('superadmin'); } else if(profile?.role==='admin') go('dashboard'); else go('agenda'); } }
}
init();
