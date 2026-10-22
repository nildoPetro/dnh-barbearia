// FILTROS DO DASHBOARD NOVO
function applyDashboardFilters(){
  const search = ($('#searchBarbearia')?.value||'').toLowerCase();
  const statusFilter = $('#filterStatus')?.value||'';
  const planoFilter = $('#filterPlano')?.value||'';
  const rows = $$('#barbershopTableBody tr');
  let visible=0;
  rows.forEach(row=>{
    const text=row.textContent.toLowerCase();
    const status=row.dataset.status||'';
    const plano=row.dataset.plano||'';
    let show=true;
    if(search && !text.includes(search)) show=false;
    if(statusFilter && status!==statusFilter) show=false;
    if(planoFilter && plano!==planoFilter) show=false;
    row.style.display=show?'':'none';
    if(show) visible++;
  });
  const info=$('#tableInfo'); if(info) info.textContent=`Mostrando ${visible} de ${rows.length} resultados`;
}

async function loadBarbershopsTable(){
  if(!isSuperAdmin()) return;
  const {data:shops, error} = await sb.from('barbershops').select('*').order('created_at',{ascending:false});
  if(error){ $('#barbershopTableBody').innerHTML=`<tr><td colspan="6">Erro: ${escapeHtml(error.message)}</td></tr>`; return; }
  const listShops = shops||[];
  const todayStr=today();
  const in7Days=new Date(); in7Days.setDate(in7Days.getDate()+7); const in7Str=in7Days.toISOString().slice(0,10);
  const ativas=listShops.filter(s=>s.active!==false).length;
  const trial=listShops.filter(s=> (s.plano||'trial')==='trial').length;
  const mrr=listShops.filter(s=>s.active!==false && s.plano!=='trial').reduce((a,b)=>a+Number(b.plano_valor||0),0);
  const atraso=listShops.filter(s=> s.data_vencimento && s.data_vencimento < todayStr && s.status_pagamento!=='pago').length;
  const trialExpiring=listShops.filter(s=> s.data_vencimento && s.data_vencimento >= todayStr && s.data_vencimento <= in7Str && (s.plano||'trial')==='trial').length;
  if($('#metricAtivas')) $('#metricAtivas').textContent=ativas;
  if($('#metricTrial')) $('#metricTrial').textContent=trial;
  if($('#metricMRR')) $('#metricMRR').textContent='R$ '+mrr.toLocaleString('pt-BR',{minimumFractionDigits:0});
  if($('#metricAtraso')) $('#metricAtraso').textContent=atraso;
  if($('#metricTrialSub')) $('#metricTrialSub').textContent=`${trialExpiring} expiram em 7 dias`;
  if($('#metricAtivas2')) $('#metricAtivas2').textContent=ativas;
  if($('#metricMRR2')) $('#metricMRR2').textContent='R$ '+mrr.toLocaleString('pt-BR');
  const tbody=$('#barbershopTableBody'); if(!tbody) return;
  if(listShops.length===0){ tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px">Nenhuma barbearia</td></tr>`; return; }
  tbody.innerHTML=listShops.map((b,idx)=>{
    const isAtraso = b.data_vencimento && b.data_vencimento < todayStr;
    const planoClass=(b.plano||'trial').toLowerCase();
    const statusVal = isAtraso ? 'atraso' : (b.active===false?'inativo':'ativo');
    const statusLabel = isAtraso ? 'em atraso' : (b.active===false?'inativo':'ativo');
    const pagStatus = isAtraso ? 'em atraso' : (b.status_pagamento||'trial');
    const pagClass = pagStatus==='pago'?'pago':(pagStatus==='em atraso'?'atraso':'trial');
    const responsavel = b.owner_email ? b.owner_email.split('@')[0] : 'Sem responsável';
    const icon = idx%3===0?'💈':(idx%3===1?'✂️':'💇');
    return `<tr data-status="${statusVal}" data-plano="${planoClass}">
      <td><div class="barbearia-cell"><span>${icon}</span><b>${escapeHtml(b.name)}</b></div></td>
      <td>${escapeHtml(b.owner_email||responsavel)}</td>
      <td><span class="badge-plano ${planoClass}">${escapeHtml((b.plano||'TRIAL').toUpperCase())}</span></td>
      <td><span class="status-dot ${statusVal}">${statusLabel}</span></td>
      <td><span class="pag-badge ${pagClass}">${escapeHtml(pagStatus)}</span></td>
      <td><div class="action-btns"><button data-manage-shop="${b.slug}">✏️ Editar</button><button data-view-shop="${b.slug}">👁️ Ver</button></div></td>
    </tr>`;
  }).join('');
  const info=$('#tableInfo'); if(info) info.textContent=`Mostrando 1-${listShops.length} de ${listShops.length} resultados`;
}

// Substitui loadBarbershops antigo
async function loadBarbershops(){ await loadBarbershopsTable(); }
