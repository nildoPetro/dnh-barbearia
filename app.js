const cfg = window.DNH_CONFIG || {};
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let profile = null;
let settings = { name: 'DNH BARBEARIA', whatsapp: '', start_time: '08:00', end_time: '18:00', slot_interval: 30, logo_url: 'dnh-logo.png', weekly_schedule: {}, slug: 'dnh', lunch_start: '12:00', lunch_end: '13:00' };
let services = []; let professionals = []; let currentManageSlug = null; let selectedPlano = 'profissional'; let selectedPlanoValor = 97.90;
let allBarbershopsCache = [];
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function getSlug(){ const p=new URLSearchParams(window.location.search); const s=p.get('b'); if(s){ localStorage.setItem('dnh_slug', s); return s; } return localStorage.getItem('dnh_slug')||'dnh'; }
const CURRENT_SLUG=getSlug();
const today=()=>{ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escapeHtml=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function isSuperAdmin(){ const list=(cfg.superAdmins||[]).map(e=>e.toLowerCase()); return profile && list.includes((profile.email||'').toLowerCase()); }
function toast(m){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=m; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3500); }
function getPlanoValor(plano, valorSalvo){
  const tabela={ trial:0, starter:59.90, profissional:97.90, premium:147.90 };
  const v=Number(valorSalvo||0);
  if(v>0) return v;
  return tabela[(plano||'').toLowerCase()]||0;
}
function aplicarPermissoesUI(){
  const superAdmin=isSuperAdmin();
  $$('.sidebar .nav button').forEach(el=>el.style.display='none');
  $$('.sidebar .nav').forEach(el=>el.style.display='flex');
  if(superAdmin){
    $$('.superadmin-only').forEach(el=>el.style.display='flex');
    const em=$('#userEmailDisplay'); if(em) em.textContent=profile?.email||'admin@barbearisaas.com';
  }else if(profile?.role==='admin'){
    $$('.admin-only').forEach(el=>el.style.display='flex');
  }else{
    $$('.client-only').forEach(el=>el.style.display='flex');
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
  if(page==='superadmin') loadDashboardPrincipal();
  if(page==='superadmin-cadastro') loadDashboardPrincipal();
  if(page==='superadmin-financeiro') loadSuperFinance();
  if(page==='superadmin-vincular') loadVincular();
  if(page==='superadmin-metricas') loadDashboardPrincipal();
  if(page==='dashboard') dashboard();
  if(page==='agenda') agenda();
  if(page==='consultar') consultarAgenda();
  if(page==='settings') loadSettings();
}

// ================= DASHBOARD PRINCIPAL =================
async function loadDashboardPrincipal(){
  if(!isSuperAdmin()) return;
  try{
    const tbody=$('#barbershopTableBody');
    if(tbody) tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:#d4af37">Carregando barbearias...</td></tr>`;
    const {data:shops, error} = await sb.from('barbershops').select('*').order('created_at',{ascending:false});
    if(error){
      if(tbody) tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:#ff6b6b">Erro: ${escapeHtml(error.message)}</td></tr>`;
      toast('Erro: '+error.message); return;
    }
    allBarbershopsCache = shops || [];
    const listShops = allBarbershopsCache;
    const todayStr=today();
    const in7Days=new Date(); in7Days.setDate(in7Days.getDate()+7);
    const in7Str=in7Days.toISOString().slice(0,10);
    const ativas=listShops.filter(s=>s.active!==false).length;
    const trial=listShops.filter(s=> (s.plano||'trial')==='trial').length;
    const mrr=listShops.filter(s=>s.active!==false && (s.plano||'')!=='trial').reduce((a,b)=>a+getPlanoValor(b.plano, b.plano_valor),0);
    const atraso=listShops.filter(s=> s.data_vencimento && s.data_vencimento < todayStr).length;
    const elAtivas=$('#metricAtivas'); if(elAtivas) elAtivas.textContent=ativas;
    const elTrial=$('#metricTrial'); if(elTrial) elTrial.textContent=trial;
    const elMRR=$('#metricMRR'); if(elMRR) elMRR.textContent='R$ '+mrr.toLocaleString('pt-BR',{minimumFractionDigits:2});
    const elAtraso=$('#metricAtraso'); if(elAtraso) elAtraso.textContent=atraso;
    const elMRR2=$('#metricMRR2'); if(elMRR2) elMRR2.textContent='R$ '+mrr.toLocaleString('pt-BR');
    const elAtivas2=$('#metricAtivas2'); if(elAtivas2) elAtivas2.textContent=ativas;
    const trialExpiring=listShops.filter(s=> s.data_vencimento && s.data_vencimento >= todayStr && s.data_vencimento <= in7Str).length;
    const sub=$('#metricTrialSub'); if(sub) sub.textContent=`${trialExpiring} expiram em 7 dias`;
    if(tbody){
      if(listShops.length===0){
        tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:30px">Nenhuma barbearia cadastrada</td></tr>`;
      } else {
        tbody.innerHTML=listShops.map((b,idx)=>{
          const isAtraso = b.data_vencimento && b.data_vencimento < todayStr;
          const planoClass=(b.plano||'trial').toLowerCase();
          const statusVal = isAtraso ? 'atraso' : (b.active===false?'inativo':'ativo');
          const statusLabel = isAtraso ? 'em atraso' : (b.active===false?'inativo':'ativo');
          const pagStatus = isAtraso ? 'em atraso' : (b.status_pagamento||'trial');
          const pagClass = pagStatus==='pago'?'pago':(pagStatus==='em atraso'?'atraso':'trial');
          const responsavel = (b.owner_email||'').split('@')[0] || b.telefone || 'Sem resp.';
          const icon = idx%4===0?'💈':(idx%4===1?'✂️':(idx%4===2?'💇':'🏢'));
          return `<tr data-status="${statusVal}" data-plano="${planoClass}" data-search="${escapeHtml((b.name+' '+b.owner_email+' '+b.slug).toLowerCase())}">
            <td><div class="barbearia-cell"><span>${icon}</span><div><b>${escapeHtml(b.name)}</b><br><small style="color:#5a5f73">${escapeHtml(b.slug)}</small></div></div></td>
            <td>${escapeHtml(responsavel)}</td>
            <td><span class="badge-plano ${planoClass}">${escapeHtml((b.plano||'TRIAL').toUpperCase())}</span></td>
            <td><span class="status-dot ${statusVal}">${statusLabel}</span></td>
            <td><span class="pag-badge ${pagClass}">${escapeHtml(pagStatus)}</span></td>
            <td><div class="action-btns"><button data-manage-shop="${b.slug}">✏️ Editar</button><button data-view-shop="${b.slug}">👁️ Ver</button></div></td>
          </tr>`;
        }).join('');
      }
      const info=$('#tableInfo'); if(info) info.textContent=`Mostrando 1-${listShops.length} de ${listShops.length} resultados`;
    }
    const vincularList=$('#barbershopListVincular');
    if(vincularList){
      vincularList.innerHTML=listShops.map(b=>`<div class="list-row"><div><b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.slug)} • ${escapeHtml(b.owner_email||'')} • ${escapeHtml(b.plano||'trial')}</small></div><div style="display:flex;gap:6px"><button data-manage-shop="${b.slug}" class="btn gold">⚙️ Gerenciar</button></div></div>`).join('')||'<p class="muted">Nenhuma</p>';
    }
    const shopSelect=$('#superFinanceShopFilter');
    if(shopSelect){
      shopSelect.innerHTML='<option value="">Todas as barbearias</option>';
      listShops.forEach(s=>{ const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; shopSelect.appendChild(opt); });
    }
    const vincularSelect=$('#vincularShopSelect');
    if(vincularSelect){
      vincularSelect.innerHTML='<option value="">Selecione a barbearia...</option>';
      listShops.forEach(s=>{ const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; vincularSelect.appendChild(opt); });
    }
    const quick=$('#vincularQuickList');
    if(quick){
      quick.innerHTML=listShops.slice(0,6).map(b=>`<div class="list-row"><div><b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.slug)} • ${escapeHtml(b.owner_email||'')}</small></div><button data-select-vincular="${b.slug}" class="btn small gold">Selecionar</button></div>`).join('')||'<p class="muted">Nenhuma</p>';
    }
    const oldList=$('#barbershopList');
    if(oldList){
      const vencendo=listShops.filter(s=> s.data_vencimento && s.data_vencimento >= todayStr && s.data_vencimento <= in7Str).sort((a,b)=>a.data_vencimento.localeCompare(b.data_vencimento));
      oldList.innerHTML=vencendo.length?vencendo.map(b=>`<div class="list-row"><div style="flex:1"><b>${escapeHtml(b.name)}</b><small style="display:block">Vence: ${b.data_vencimento} • ${escapeHtml(b.plano||'trial')}</small></div><div style="display:flex;gap:6px;flex-shrink:0"><button data-manage-shop="${b.slug}" class="btn gold" style="padding:8px 14px">Gerenciar</button><button data-copy-link="${location.href.split('?')[0]+'?b='+b.slug}" class="btn small">Link</button></div></div>`).join(''):'<p class="muted" style="padding:12px">Nenhuma vencendo nos próximos 7 dias</p>';
    }
  }catch(err){
    console.error(err); toast('Erro: '+err.message);
  }
}

async function loadVincular(){ await loadDashboardPrincipal(); }

async function loadVincularAdmins(slug){
  if(!slug) return;
  const {data:shop} = await sb.from('barbershops').select('*').eq('slug',slug).maybeSingle();
  const base=location.href.split('?')[0];
  const empty=$('#vincularEmpty'); const content=$('#vincularContent');
  if(empty) empty.classList.add('hidden'); if(content) content.classList.remove('hidden');
  const nameEl=$('#vincularShopName'); if(nameEl) nameEl.textContent=shop?.name||slug;
  const hint=$('#vShopSlugHint'); if(hint) hint.textContent=slug;
  const linkInput=$('#vShopLink'); if(linkInput) linkInput.value=base+'?b='+slug;
  const {data:admins=[]} = await sb.from('professionals').select('*').eq('slug',slug).order('name');
  const list=$('#vincularAdminsList');
  if(list){
    list.innerHTML=admins.length?admins.map(a=>`<div class="list-row" style="background:#0f1320"><div><b>${escapeHtml(a.name)}</b><small style="display:block;color:#aaa">${escapeHtml(a.email||'')} • ${escapeHtml(a.perfil)} • ${escapeHtml(a.phone||'')}</small></div><div style="display:flex;gap:6px"><button data-resend="${a.email}" class="btn small" style="color:#d4af37;border-color:#d4af37">Reenviar</button><button data-remove-vincular="${a.id}" class="btn small danger">Remover</button></div></div>`).join(''):'<div style="padding:20px;text-align:center;color:#666;border:1px dashed #333;border-radius:10px">Nenhum admin vinculado ainda.</div>';
  }
}

async function addVincularAdmin(){
  const slug=$('#vincularShopSelect')?.value;
  if(!slug){ toast('Selecione a barbearia no topo'); return; }
  const name=$('#vAdminName')?.value.trim(); const email=$('#vAdminEmail')?.value.trim().toLowerCase(); const phone=$('#vAdminPhone')?.value.trim(); const perfil=$('#vAdminPerfil')?.value||'admin';
  if(!name||!email){ toast('Nome e E-mail obrigatórios'); return; }
  const btn=$('#vAddAdminBtn'); if(btn){ btn.textContent='Criando...'; btn.disabled=true; }
  const tempPass = Math.random().toString(36).slice(-8)+'A1!b2@';
  let userId=null;
  try{ const {data}=await sb.auth.signUp({ email, password: tempPass, options: { data: { name, phone, role: 'admin' } } }); if(data?.user?.id) userId=data.user.id; }catch(e){}
  try{ await sb.auth.resetPasswordForEmail(email,{ redirectTo: window.location.origin + window.location.pathname });}catch(e){}
  try{ const {error}=await sb.from('professionals').insert({name,phone,email,perfil,slug,active:true}); if(error && error.message.includes('duplicate')){ await sb.from('professionals').update({name,phone,perfil,active:true}).eq('email',email).eq('slug',slug); } }catch(e){}
  try{ if(userId){ await sb.from('profiles').upsert({id:userId,name,phone,email,role:'admin',active:true,barbershop_slug:slug},{onConflict:'id'}); } else { const {data:existing}=await sb.from('profiles').select('id').eq('email',email).maybeSingle(); if(existing?.id){ await sb.from('profiles').update({role:'admin',barbershop_slug:slug,name,phone}).eq('id',existing.id); } } }catch(e){}
  if(btn){ btn.textContent='✉️ Criar Administrador e Enviar Acesso por E-mail'; btn.disabled=false; }
  toast('✅ Admin criado! E-mail enviado para '+email);
  const nEl=$('#vAdminName'); const eEl=$('#vAdminEmail'); const pEl=$('#vAdminPhone');
  if(nEl) nEl.value=''; if(eEl) eEl.value=''; if(pEl) pEl.value='';
  await loadVincularAdmins(slug);
}

function applyDashboardFilters(){
  const search = ($('#searchBarbearia')?.value||'').toLowerCase();
  const statusFilter = $('#filterStatus')?.value||'';
  const planoFilter = $('#filterPlano')?.value||'';
  const rows = document.querySelectorAll('#barbershopTableBody tr');
  let visible=0;
  rows.forEach(row=>{
    const searchAttr=row.getAttribute('data-search')||'';
    const text=row.textContent.toLowerCase()+' '+searchAttr;
    const status=row.getAttribute('data-status')||'';
    const plano=row.getAttribute('data-plano')||'';
    let show=true;
    if(search && !text.includes(search)) show=false;
    if(statusFilter && status!==statusFilter) show=false;
    if(planoFilter && plano!==planoFilter) show=false;
    row.style.display=show?'':'none';
    if(show) visible++;
  });
  const info=$('#tableInfo'); if(info) info.textContent=`Mostrando ${visible} de ${rows.length} resultados`;
}

async function openManageShopModal(slug){
  currentManageSlug=slug;
  const{data:shop}=await sb.from('barbershops').select('*').eq('slug',slug).maybeSingle();
  if(!shop){ toast('Não encontrada'); return; }
  $('#mShopName').value=shop.name||''; $('#mShopSlug').value=shop.slug||''; $('#mShopLogo').value=shop.logo_url||''; $('#mShopOwner').value=shop.owner_email||''; $('#mShopActive').checked=shop.active!==false;
  $('#manageShopTitle').textContent='Gerenciar: '+shop.name;
  $('#mShopLink').textContent=location.href.split('?')[0]+'?b='+shop.slug;
  // NOVO - CARREGA PLANO
  const planoSel=$('#mShopPlano'); if(planoSel) planoSel.value=(shop.plano||'trial').toLowerCase();
  const valorEl=$('#mShopPlanoValor'); if(valorEl) valorEl.value=getPlanoValor(shop.plano, shop.plano_valor);
  const vencEl=$('#mShopVencimento'); if(vencEl) vencEl.value=shop.data_vencimento||'';
  const statusPagEl=$('#mShopStatusPag'); if(statusPagEl) statusPagEl.value=shop.status_pagamento||'trial';
  
  const{data:admins=[]}=await sb.from('professionals').select('*').eq('slug',slug).order('name');
  $('#mShopAdminsList').innerHTML=admins.length?admins.map(a=>`<div class="list-row" style="padding:10px 12px;margin:0;background:#1e1e1e;border-color:#2a2a2a;"><div><b style="color:#fff">${escapeHtml(a.name)}</b><small style="display:block;color:#aaa">${escapeHtml(a.email||'sem email')} • ${escapeHtml(a.perfil)} • ${escapeHtml(a.phone||'')}</small></div><div style="display:flex;gap:6px;"><button data-resend="${a.email}" style="padding:6px 8px;font-size:11px;background:#222;color:#d4af37;border:1px solid #d4af37;">Reenviar</button><button class="danger" data-remove-admin="${a.id}" style="padding:6px 8px;font-size:11px;">Remover</button></div></div>`).join(''):'<div style="padding:12px;text-align:center;color:#666;background:#1a1a1a;border-radius:10px;border:1px dashed #333;">Nenhum admin</div>';
  $('#manageShopModal').classList.remove('hidden'); $('#manageShopModal').style.display='flex';
}
async function saveManageShop(){
  if(!currentManageSlug) return;
  const plano=$('#mShopPlano')?.value||'trial';
  const planoValor=Number($('#mShopPlanoValor')?.value||0)||getPlanoValor(plano,0);
  const payload={
    name:$('#mShopName').value.trim(),
    logo_url:$('#mShopLogo').value.trim()||'dnh-logo.png',
    owner_email:$('#mShopOwner').value.trim()||null,
    active:$('#mShopActive').checked,
    plano: plano,
    plano_valor: planoValor,
    data_vencimento: $('#mShopVencimento')?.value||null,
    status_pagamento: $('#mShopStatusPag')?.value||'trial'
  };
  const{error}=await sb.from('barbershops').update(payload).eq('slug',currentManageSlug);
  if(error){ toast(error.message); return; }
  await sb.from('settings').update({name:payload.name,logo_url:payload.logo_url}).eq('slug',currentManageSlug);
  toast('✅ Barbearia atualizada! Plano: '+plano+' - '+money(planoValor));
  $('#manageShopModal').style.display='none'; $('#manageShopModal').classList.add('hidden'); 
  await loadDashboardPrincipal();
}
async function addShopAdmin(){
  if(!currentManageSlug) return;
  const name=$('#mNewAdminName').value.trim(); const email=$('#mNewAdminEmail').value.trim().toLowerCase(); const phone=$('#mNewAdminPhone').value.trim(); const perfil=$('#mNewAdminPerfil').value;
  if(!name||!email){ toast('Nome e E-mail obrigatórios'); return; }
  const btn=$('#mAddAdminBtn'); btn.textContent='Enviando...'; btn.disabled=true;
  const tempPass = Math.random().toString(36).slice(-8)+'A1!b2@';
  let userId=null;
  try{ const {data}=await sb.auth.signUp({ email, password: tempPass, options: { data: { name, phone, role: 'admin' } } }); if(data?.user?.id) userId=data.user.id; }catch(e){}
  try{ await sb.auth.resetPasswordForEmail(email,{ redirectTo: window.location.origin + window.location.pathname }); }catch(e){}
  try{ const {error}=await sb.from('professionals').insert({ name, phone, email, perfil, slug: currentManageSlug, active: true }); if(error && error.message.includes('duplicate')){ await sb.from('professionals').update({ name, phone, perfil, active: true }).eq('email', email).eq('slug', currentManageSlug); } }catch(e){}
  try{ if(userId){ await sb.from('profiles').upsert({ id: userId, name, phone, email, role: 'admin', active: true, barbershop_slug: currentManageSlug }, { onConflict: 'id' }); } else { const { data: existing } = await sb.from('profiles').select('id').eq('email', email).maybeSingle(); if(existing?.id){ await sb.from('profiles').update({ role: 'admin', barbershop_slug: currentManageSlug, name, phone }).eq('id', existing.id); } } }catch(e){}
  btn.textContent='✉️ Criar ADM e Enviar Acesso por E-mail'; btn.disabled=false;
  toast('✅ ADM vinculado!'); $('#mNewAdminName').value=''; $('#mNewAdminEmail').value=''; $('#mNewAdminPhone').value='';
  await openManageShopModal(currentManageSlug);
}
async function removeShopAdmin(id){ if(!confirm('Remover?')) return; await sb.from('professionals').delete().eq('id',id); toast('Removido'); await openManageShopModal(currentManageSlug); }
async function resendAccess(email){ if(!email){ toast('Sem e-mail'); return; } const { error } = await sb.auth.resetPasswordForEmail(email,{ redirectTo: window.location.origin + window.location.pathname });); if(error) toast(error.message); else toast('Link reenviado para '+email); }

async function loadSuperFinance(){
  if(!isSuperAdmin()) return;
  const{data:shops=[]}=await sb.from('barbershops').select('*').order('name');
  const{data:pays=[]}=await sb.from('barbershop_payments').select('*').order('payment_date',{ascending:false});
  const shopSelect=$('#superFinanceShopFilter');
  if(shopSelect && shopSelect.options.length<=1){
    shopSelect.innerHTML='<option value="">Todas as barbearias</option>';
    (shops||[]).forEach(s=>{ const opt=document.createElement('option'); opt.value=s.slug; opt.textContent=s.name+' ('+s.slug+')'; shopSelect.appendChild(opt); });
  }
  const shopFilter=$('#superFinanceShopFilter')?.value||''; const startFilter=$('#superFinanceStart')?.value||''; const endFilter=$('#superFinanceEnd')?.value||'';
  let filteredPays=[...(pays||[])];
  if(shopFilter) filteredPays=filteredPays.filter(p=>p.barbershop_slug===shopFilter);
  if(startFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) >= startFilter );
  if(endFilter) filteredPays=filteredPays.filter(p=> (p.payment_date||'').slice(0,10) <= endFilter );
  const totalFiltered=filteredPays.reduce((a,b)=>a+Number(b.amount||0),0);
  const summaryEl=$('#superFinanceSummary');
  if(summaryEl) summaryEl.innerHTML=`<div class="metric-card"><small>Filtrado</small><b>${filteredPays.length} pagamentos</b></div><div class="metric-card"><small>Total no intervalo</small><b>${money(totalFiltered)}</b></div><div class="metric-card"><small>Período</small><b style="font-size:12px">${startFilter||'início'} até ${endFilter||'hoje'}</b></div>`;
  const list=$('#superFinanceList'); if(!list) return;
  const shopsToShow=shopFilter ? shops.filter(s=>s.slug===shopFilter) : shops;
  list.innerHTML=shopsToShow.map(shop=>{
    const shopPays=filteredPays.filter(p=>p.barbershop_slug===shop.slug);
    const allShopPays=(pays||[]).filter(p=>p.barbershop_slug===shop.slug);
    const todayStr=today(); const paidThisMonth=allShopPays.some(p=>p.month_ref===todayStr.slice(0,7));
    const history=shopPays.map(p=>{ const d=new Date(p.payment_date); const dataHora=d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px dashed #222;"><span>${dataHora} - Ref: ${p.month_ref} - ${p.method}</span><span><b>${money(p.amount)}</b> <button class="danger" data-del-pay="${p.id}" style="padding:2px 6px;font-size:10px;margin-left:6px">X</button></span></div>`; }).join('')||'<small class="muted">Nenhum pagamento neste intervalo</small>';
    return `<div class="list-row" style="flex-direction:column;align-items:stretch;gap:10px;"><div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;"><div><b>${escapeHtml(shop.name)} (${escapeHtml(shop.slug)})</b><br><small style="color:${paidThisMonth?'#22c55e':'#ef4444'}">${paidThisMonth?'PAGO':'PENDENTE'} | Filtrado: ${money(shopPays.reduce((a,b)=>a+Number(b.amount||0),0))} | Plano: ${escapeHtml(shop.plano||'trial')} ${money(getPlanoValor(shop.plano,shop.plano_valor))}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><input type="month" id="month-${shop.slug}" value="${todayStr.slice(0,7)}" style="width:130px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><input type="number" id="amount-${shop.slug}" value="${getPlanoValor(shop.plano,shop.plano_valor)||100}" style="width:80px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><select id="method-${shop.slug}" style="width:90px;padding:8px;border-radius:8px;border:1px solid #2a2a2a;background:#1e1e1e;color:#fff"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select><button data-add-pay="${shop.slug}" class="btn gold" style="padding:8px 12px;">+ Mensalidade</button></div></div><details><summary style="cursor:pointer;color:#d4af37;font-size:13px;">Ver histórico (${shopPays.length})</summary><div style="margin-top:8px;background:#0a0a0a;padding:10px;border-radius:10px;border:1px solid #1e1e1e;">${history}</div></details></div>`;
  }).join('')||'<p class="muted">Nenhum resultado</p>';
}
async function addPayment(slug){
  const monthInput=document.getElementById('month-'+slug); const amountInput=document.getElementById('amount-'+slug); const methodInput=document.getElementById('method-'+slug);
  if(!monthInput||!amountInput) return;
  const month_ref=monthInput.value; const amount=Number(amountInput.value)||0; const method=methodInput ? methodInput.value : 'pix';
  if(!month_ref){ toast('Selecione o mês'); return; }
  const{error}=await sb.from('barbershop_payments').insert({barbershop_slug:slug,amount,month_ref,method,payment_date:new Date().toISOString()});
  if(error){ toast(error.message); return; }
  toast('Mensalidade lançada'); await loadSuperFinance();
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
  if($('#weeklyBox') && !$('#weeklyBox').dataset.done){
    const f=(e,s,en)=>({enabled:e,start:s,end:en}); const st=settings.start_time?.slice(0,5)||'08:00'; const en=settings.end_time?.slice(0,5)||'18:00'; const fb={0:f(false,st,en),1:f(true,st,en),2:f(true,st,en),3:f(true,st,en),4:f(true,st,en),5:f(true,st,en),6:f(false,st,en)}; const cur=settings.weekly_schedule||{}; const weekly=Object.fromEntries(Object.keys(fb).map(k=>[k,{...fb[k],...(cur[k]||{})}]));
    let h=''; Object.entries({1:'Segunda',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado',0:'Domingo'}).forEach(([k,n])=>{ const c=weekly[k]||{}; h+=`<div class="day-row" data-weekday="${k}"><b>${n}</b><label><input type="checkbox" data-week-enabled ${c.enabled!==false?'checked':''}> Atende</label><input type="time" data-week-start value="${c.start||'08:00'}"><input type="time" data-week-end value="${c.end||'18:00'}"></div>`; });
    $('#weeklyBox').innerHTML=h; $('#weeklyBox').dataset.done='1';
  }
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
  await loadSettings(); 
  const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time');
  const a=$('#adminAgenda'); if(a){ a.classList.remove('hidden'); a.innerHTML=`<div><h1>Agenda ${CURRENT_SLUG} - Admin</h1><div id="adminAgendaCalendar">${bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div style="display:flex;gap:6px;"><button data-pay="${b.id}" style="background:#22a861;color:#fff;">Pagamento</button><button class="danger" data-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>'}</div></div>`; }
}
async function consultarAgenda(){
  const list=$('#clientBookingsList'); if(!list) return; list.innerHTML='<p class="muted">Carregando...</p>';
  const{data:{user:au}}=await sb.auth.getUser(); if(!au) return;
  const{data:bs=[]}=await sb.from('bookings').select('*, services(name,price)').eq('user_id',au.id).eq('slug',CURRENT_SLUG).order('booking_date').order('booking_time');
  list.innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date} ${(b.booking_time||'').slice(0,5)}</b><small>${escapeHtml(b.services?.name||'')} - ${b.status}</small></div><div><button class="danger" data-client-cancel="${b.id}">Cancelar</button></div></div>`).join(''):'<p class="muted">Nenhum</p>';
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
    $('#loginForm')?.classList.toggle('hidden',signup);
    $('#signupForm')?.classList.toggle('hidden',!signup);
  };
});
if($('#loginForm')){
  $('#loginForm').onsubmit=async(e)=>{
    e.preventDefault();
    const{error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
    if(error) alert('Login falhou: '+error.message);
  };
}
if($('#signupForm')){
  $('#signupForm').onsubmit=async(e)=>{
    e.preventDefault();
    const name=$('#signupName').value.trim(); const phone=$('#signupPhone').value.trim(); const email=$('#signupEmail').value.trim(); const password=$('#signupPassword').value;
    const{data,error}=await sb.auth.signUp({email,password,options:{data:{name,phone,role:'client'}}});
    if(error){ toast(error.message); return; }
    if(data.session){ await sb.from('profiles').upsert({id:data.user.id,name,phone,email,role:'client',active:true}); toast('Cadastrado'); }else{ toast('Confirme e-mail'); }
  };
}
if($('#logoutBtn')) $('#logoutBtn').onclick=()=>sb.auth.signOut();

if($('#barbershopForm')){
  const shopSlugInput=$('#shopSlug');
  if(shopSlugInput) shopSlugInput.addEventListener('input',()=>{ const s=shopSlugInput.value.trim()||'slug'; const el=$('#previewLink'); if(el) el.textContent=location.href.split('?')[0]+'?b='+s; });
  const vencInput=$('#shopVencimento'); if(vencInput){ const d=new Date(); d.setDate(d.getDate()+7); vencInput.value=d.toISOString().slice(0,10); }
}
const btnSalvar=$('#btnSalvarBarbearia');
if(btnSalvar){
  btnSalvar.onclick=async()=>{
    if(!isSuperAdmin()){ toast('Só super admin'); return; }
    const slug=$('#shopSlug').value.trim().toLowerCase().replace(/\s+/g,'-'); const name=$('#shopName').value.trim(); const logo=$('#shopLogo').value.trim()||'dnh-logo.png'; const owner=$('#shopOwner').value.trim(); const telefone=$('#shopPhone').value.trim()||null; const cpf_cnpj=$('#shopCpfCnpj').value.trim()||null; const data_vencimento=$('#shopVencimento').value||null; const statusVal=$('#shopStatus').value;
    if(!slug||!name||!owner){ toast('Preencha Nome, Slug e E-mail'); return; }
    const payload={ slug, name, logo_url: logo, owner_email: owner, telefone, cpf_cnpj, data_vencimento, active: statusVal==='ativo', plano: selectedPlano, plano_valor: getPlanoValor(selectedPlano, selectedPlanoValor), status_pagamento: selectedPlano==='trial'?'trial':'pendente' };
    const{error}=await sb.from('barbershops').insert(payload);
    if(error){ toast(error.message); return; }
    await sb.from('settings').insert({slug,name,logo_url:logo,whatsapp:telefone||'',start_time:'08:00:00',end_time:'18:00:00',slot_interval:30});
    toast('Barbearia criada!'); $('#barbershopForm').reset(); const d=new Date(); d.setDate(d.getDate()+7); $('#shopVencimento').value=d.toISOString().slice(0,10);
    await loadDashboardPrincipal(); go('superadmin');
  };
}

document.addEventListener('click', async (e)=>{
  const t=e.target;
  if(t.matches('[data-manage-shop]')){ await openManageShopModal(t.dataset.manageShop); return; }
  if(t.matches('[data-view-shop]')){ const slug=t.dataset.viewShop; const url=location.href.split('?')[0]+'?b='+slug; navigator.clipboard.writeText(url); toast('Link copiado: '+url); return; }
  if(t.matches('[data-select-vincular]')){ const slug=t.dataset.selectVincular; const sel=$('#vincularShopSelect'); if(sel) sel.value=slug; await loadVincularAdmins(slug); return; }
  if(t.id==='mSaveBtn'){ await saveManageShop(); return; }
  if(t.id==='mCancelBtn' || t.id==='mCloseX'){ $('#manageShopModal').style.display='none'; $('#manageShopModal').classList.add('hidden'); return; }
  if(t.id==='mAddAdminBtn'){ await addShopAdmin(); return; }
  if(t.id==='vAddAdminBtn'){ await addVincularAdmin(); return; }
  if(t.id==='vCopyLink'){ const input=$('#vShopLink'); if(input){ navigator.clipboard.writeText(input.value); toast('Link copiado'); } return; }
  if(t.matches('[data-remove-admin]')){ if(!confirm('Remover?')) return; await sb.from('professionals').delete().eq('id',t.dataset.removeAdmin); toast('Removido'); await openManageShopModal(currentManageSlug); return; }
  if(t.matches('[data-remove-vincular]')){ if(!confirm('Remover este admin?')) return; await sb.from('professionals').delete().eq('id',t.dataset.removeVincular); toast('Removido'); const slug=$('#vincularShopSelect')?.value; if(slug) await loadVincularAdmins(slug); return; }
  if(t.matches('[data-resend]')){ const email=t.dataset.resend; if(!email) return; const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin}); if(error) toast(error.message); else toast('Link reenviado para '+email); return; }
  if(t.matches('[data-add-pay]')){ await addPayment(t.dataset.addPay); return; }
  if(t.matches('[data-del-pay]')){ if(!confirm('Excluir?')) return; await sb.from('barbershop_payments').delete().eq('id',t.dataset.delPay); toast('Excluído'); await loadSuperFinance(); return; }
  if(t.matches('[data-copy-link]')){ navigator.clipboard.writeText(t.dataset.copyLink); toast('Link copiado'); return; }
  if(t.id==='filterSuperFinance'){ await loadSuperFinance(); return; }
  if(t.id==='clearSuperFinance'){ const a=$('#superFinanceShopFilter'); if(a) a.value=''; const b=$('#superFinanceStart'); if(b) b.value=''; const c=$('#superFinanceEnd'); if(c) c.value=''; await loadSuperFinance(); return; }
  if(t.id==='manageShopModal'){ $('#manageShopModal').style.display='none'; return; }
});

const searchInput=$('#searchBarbearia'); if(searchInput) searchInput.addEventListener('input', applyDashboardFilters);
const filterStatusEl=$('#filterStatus'); if(filterStatusEl) filterStatusEl.addEventListener('change', applyDashboardFilters);
const filterPlanoEl=$('#filterPlano'); if(filterPlanoEl) filterPlanoEl.addEventListener('change', applyDashboardFilters);
const btnExportar=$('#btnExportar'); 
if(btnExportar){
  btnExportar.onclick=()=>{
    let csv='Barbearia,Responsavel,Plano,Status,Pagamento,Slug\n';
    document.querySelectorAll('#barbershopTableBody tr').forEach(r=>{
      if(r.style.display!=='none'){
        const cols=[...r.querySelectorAll('td')].slice(0,5).map(td=>`"${td.textContent.trim().replace(/"/g,'""')}"`);
        const slug=r.querySelector('[data-manage-shop]')?.getAttribute('data-manage-shop')||'';
        csv+=cols.join(',')+`,"${slug}"\n`;
      }
    });
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='barbearias.csv'; a.click();
  };
}
const vincularSelect=$('#vincularShopSelect'); 
if(vincularSelect){
  vincularSelect.addEventListener('change', async(e)=>{
    const slug=e.target.value;
    if(slug){ await loadVincularAdmins(slug); } else { const empty=$('#vincularEmpty'); const content=$('#vincularContent'); if(empty) empty.classList.remove('hidden'); if(content) content.classList.add('hidden'); }
  });
}
async function handleRecovery(){
  const hash = window.location.hash;
  if(hash && hash.includes('type=recovery')){
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if(access_token){
      const { error } = await sb.auth.setSession({ access_token, refresh_token });
      if(!error){
        const novaSenha = prompt('🔑 Link válido! Digite a NOVA SENHA para este administrador (mínimo 6 caracteres):');
        if(novaSenha && novaSenha.length>=6){
          const { error: updateError } = await sb.auth.updateUser({ password: novaSenha });
          if(updateError){ alert('Erro: '+updateError.message); }
          else { alert('✅ Senha criada com sucesso! Faça login agora.'); window.location.hash=''; window.location.href=window.location.origin+window.location.pathname; }
        }
      }
    }
  }
}

async function init(){
  await handleRecovery();
  sb.auth.onAuthStateChange(async(ev,sess)=>{
    if(ev==='PASSWORD_RECOVERY'){
      const novaSenha = prompt('🔑 Digite a NOVA SENHA:');
      if(novaSenha && novaSenha.length>=6){
        const { error } = await sb.auth.updateUser({ password: novaSenha });
        if(!error){ alert('Senha atualizada!'); window.location.hash=''; }
      }
      return;
    }
async function init(){
  sb.auth.onAuthStateChange(async(ev,sess)=>{
    if(sess){
      await user(); if(!profile) return;
      $('#authView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden');
      aplicarPermissoesUI();
      await loadSettings();
      if(isSuperAdmin()){ go('superadmin'); } else { go('dashboard'); }
    } else {
      profile=null; $('#authView')?.classList.remove('hidden'); $('#appView')?.classList.add('hidden');
    }
  });
  const{data:{session}}=await sb.auth.getSession();
  if(session){
    await user();
    if(profile){
      $('#authView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden');
      aplicarPermissoesUI(); await loadSettings();
      if(isSuperAdmin()){ go('superadmin'); } else { go('dashboard'); }
    }
  }
}
init();
const mPlanoEl=$('#mShopPlano');
if(mPlanoEl){
  mPlanoEl.addEventListener('change',()=>{
    const v=getPlanoValor(mPlanoEl.value,0);
    const valorInput=$('#mShopPlanoValor'); if(valorInput) valorInput.value=v;
  });
}
